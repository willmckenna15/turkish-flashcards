import { useEffect, useState } from "react";

// Tracks which card is being studied, plus a shuffle-able study order —
// both keyed by each card's stable id rather than its raw array index.
//
// This matters because the underlying card list can shrink out from under
// an active study session: e.g. grading a "missed" word right removes it
// from the "words I've gotten wrong" scope's deck. Tracking position by key
// means the current/next card is resolved by identity, so studying
// continues naturally onto the next card instead of resetting back to the
// first card just because the list's length changed.
//
// Options:
// - `storageKey` persists the order and position in localStorage, so leaving
//   the deck (switching tabs, closing the app) and coming back resumes on
//   the same card. Changing the key mid-session (e.g. switching study scope)
//   swaps to that key's saved state, so each scope keeps its own place.
// - `isVisible` narrows the deck without disturbing it: hidden cards keep
//   their slot in the saved order (so relaxing the filter puts them back
//   where they were, unlike removing them from `cards`), they're just
//   skipped when stepping through and left out of `order` and the count.
//   If the current card itself is hidden, the position settles on the next
//   visible card after it rather than jumping back to the start.
// - `canonicalKey` maps the current key to the key that stands in for it in
//   this view of the deck (a word → the representative of its meaning
//   group), so a position saved by one view resolves to the same place in
//   another instead of being lost.

interface SavedDeckPosition {
  keyOrder: string[];
  currentKey: string | null;
}

export interface DeckPositionOptions<T> {
  storageKey?: string;
  isVisible?: (card: T) => boolean;
  canonicalKey?: (key: string) => string;
}

function loadSaved(storageKey: string | undefined): SavedDeckPosition | null {
  if (!storageKey) return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedDeckPosition>;
    if (!Array.isArray(parsed.keyOrder)) return null;
    return {
      keyOrder: parsed.keyOrder.filter((k): k is string => typeof k === "string"),
      currentKey: typeof parsed.currentKey === "string" ? parsed.currentKey : null,
    };
  } catch {
    return null;
  }
}

function saveSaved(storageKey: string, value: SavedDeckPosition): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Storage full, disabled, or unavailable — resuming is a convenience,
    // never let it break studying.
  }
}

export function useDeckPosition<T>(
  cards: T[],
  getKey: (card: T) => string,
  { storageKey, isVisible, canonicalKey }: DeckPositionOptions<T> = {}
) {
  function initialState(): SavedDeckPosition {
    return (
      loadSaved(storageKey) ?? {
        keyOrder: cards.map(getKey),
        currentKey: cards.length > 0 ? getKey(cards[0]) : null,
      }
    );
  }

  const [initial] = useState<SavedDeckPosition>(initialState);
  const [keyOrder, setKeyOrder] = useState<string[]>(initial.keyOrder);
  const [currentKey, setCurrentKey] = useState<string | null>(initial.currentKey);

  // When the storage key changes, swap to that key's saved state (or a
  // fresh deck if it has none). Done synchronously during render, like the
  // flip-state reset in FlashcardDeck, so the persist effect below never
  // sees the old scope's state paired with the new key.
  const [loadedKey, setLoadedKey] = useState(storageKey);
  if (storageKey !== loadedKey) {
    setLoadedKey(storageKey);
    const next = initialState();
    setKeyOrder(next.keyOrder);
    setCurrentKey(next.currentKey);
  }

  useEffect(() => {
    if (!storageKey || storageKey !== loadedKey) return;
    saveSaved(storageKey, { keyOrder, currentKey });
  }, [storageKey, loadedKey, keyOrder, currentKey]);

  // Keep the persisted key order in sync with the live card list: preserve
  // the relative order of cards still present, append newly-appeared ones
  // at the end, and drop ones that disappeared — all without touching
  // `currentKey`, so an in-progress session doesn't jump back to the start
  // just because a card left the list. A transiently-empty list (cards
  // still loading) is left alone rather than wiping a saved order.
  useEffect(() => {
    if (cards.length === 0) return;
    const liveKeys = cards.map(getKey);
    setKeyOrder((prev) => {
      const kept = prev.filter((k) => liveKeys.includes(k));
      const added = liveKeys.filter((k) => !prev.includes(k));
      if (kept.length === prev.length && added.length === 0) return prev;
      return [...kept, ...added];
    });
    // Re-run only when the card list itself changes — `getKey` is a fresh
    // closure per render at most call sites, and including it here would
    // defeat the point (and risk extra churn) without changing behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards]);

  // Resolve `keyOrder` into concrete indices into the *current* `cards` for
  // this render. Doing this inline (not just relying on the effect above)
  // keeps `order` correct immediately, even on the same render where
  // `cards` just changed and the effect hasn't caught up yet.
  const keyToCardIndex = new Map(cards.map((c, i) => [getKey(c), i]));
  const liveKeys = cards.map(getKey);
  const keptKeys = keyOrder.filter((k) => keyToCardIndex.has(k));
  const newKeys = liveKeys.filter((k) => !keyOrder.includes(k));
  const fullOrder = [...keptKeys, ...newKeys].map((k) => keyToCardIndex.get(k)!);
  const order = isVisible ? fullOrder.filter((i) => isVisible(cards[i])) : fullOrder;

  const wantedKey =
    currentKey !== null ? (canonicalKey ? canonicalKey(currentKey) : currentKey) : null;
  let currentPos = wantedKey !== null ? order.findIndex((i) => getKey(cards[i]) === wantedKey) : -1;
  if (currentPos < 0 && wantedKey !== null && order.length > 0) {
    // In the deck but hidden: settle on the next visible card at or after
    // it (wrapping to the first if there's none after).
    const fullPos = fullOrder.findIndex((i) => getKey(cards[i]) === wantedKey);
    if (fullPos >= 0) {
      const posInFull = new Map(fullOrder.map((i, p) => [i, p]));
      const after = order.findIndex((i) => posInFull.get(i)! >= fullPos);
      currentPos = after >= 0 ? after : 0;
    }
  }
  const index = currentPos >= 0 ? currentPos : 0;

  function firstVisibleKey(keys: string[]): string | null {
    const key = keys.find((k) => {
      const card = cards[keyToCardIndex.get(k)!];
      return !isVisible || isVisible(card);
    });
    return key ?? null;
  }

  function goTo(newIndex: number) {
    if (order.length === 0) return;
    const idx = ((newIndex % order.length) + order.length) % order.length;
    setCurrentKey(getKey(cards[order[idx]]));
  }

  // Jump straight to a card by key — e.g. back to the one just graded, for
  // an undo. Set even if the key isn't in `cards` right now (a card an undo
  // is about to bring back into a filtered scope): the position resolves to
  // it as soon as it appears, and falls back to the first card until then.
  function goToKey(key: string) {
    setCurrentKey(key);
  }

  // Shuffles the whole deck, hidden cards included, so the order stays a
  // single consistent permutation whatever the filter is later set to.
  function shuffle() {
    if (fullOrder.length === 0) return;
    const keys = fullOrder.map((i) => getKey(cards[i]));
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    setKeyOrder(keys);
    setCurrentKey(firstVisibleKey(keys));
  }

  // Back to the first card in the deck's natural (unshuffled) order.
  function reset() {
    const keys = cards.map(getKey);
    setKeyOrder(keys);
    setCurrentKey(firstVisibleKey(keys));
  }

  return { order, index, goTo, goToKey, shuffle, reset };
}

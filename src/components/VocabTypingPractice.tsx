import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import type { FrontSide, Word } from "../types";

interface VocabTypingPracticeProps {
  cards: Word[];
  frontSide: FrontSide;
  order: number[];
  index: number;
  onGoTo: (index: number) => void;
  onShuffle: () => void;
  onReset?: () => void;
  // Called once per finished card with every word it graded, so the whole
  // answer can be undone as a unit.
  onAnswered: (card: Word, grades: { word: Word; correct: boolean }[]) => void;
  // Every word that counts as a correct answer for a card, the card itself
  // included. More than one when several Turkish words share an English
  // meaning — the user is then asked for each in turn. Defaults to just the
  // card.
  variantsFor?: (card: Word) => Word[];
  emptyMessage?: string;
}

// How a card ended: which answers the user produced, and which they didn't
// (revealed, and graded as missed).
interface Outcome {
  found: Word[];
  missed: Word[];
  // What the learner typed when the card ended, when it ended on a wrong
  // answer rather than on giving up. Present means "there's an attempt here
  // that could have been a typo".
  attempted?: string;
}

// An attempt that matches the answer once Turkish diacritics are ignored
// ("cocuk" for "çocuk"). Rather than marking it wrong outright, the user is
// asked whether it was a typo.
interface NearMiss {
  word: Word;
  typed: string;
}

function normalize(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[.,!?;:"'’«»]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Folds the letters a Turkish learner most often drops or can't type on a
// non-Turkish keyboard onto their plain ASCII neighbours. Applied after
// normalize(), so only lowercase forms need covering.
const ACCENT_FOLD: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
};

function stripAccents(text: string): string {
  return text.replace(/[çğıöşüâîû]/g, (ch) => ACCENT_FOLD[ch]);
}

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = row;
  }
  return prev[b.length];
}

// Which of the outstanding answers a typed attempt was most likely aiming at.
function closestTo(typed: string, candidates: Word[], answerOf: (w: Word) => string): Word {
  const target = stripAccents(normalize(typed));
  let best = candidates[0];
  let bestScore = Infinity;
  for (const candidate of candidates) {
    const score = editDistance(target, stripAccents(normalize(answerOf(candidate))));
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

export function VocabTypingPractice({
  cards,
  frontSide,
  order,
  index: safeIndex,
  onGoTo,
  onShuffle,
  onReset,
  onAnswered,
  variantsFor = (card) => [card],
  emptyMessage = "No cards to practice right now.",
}: VocabTypingPracticeProps) {
  const [attempt, setAttempt] = useState("");
  // Ids of the variants answered correctly so far on this card.
  const [foundIds, setFoundIds] = useState<string[]>([]);
  // Feedback after an attempt that didn't end the card ("1 more to go").
  const [notice, setNotice] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [nearMiss, setNearMiss] = useState<NearMiss | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentCard = order.length > 0 ? cards[order[safeIndex]] : undefined;
  const currentKey = currentCard?.id ?? null;

  // Reset per-card state synchronously during render (not via a useEffect,
  // which only runs after that render has already painted) so the previous
  // card's typed attempt / correct-answer banner never flashes onto the new
  // card for a frame before clearing. Compared by card identity, not the
  // numeric index — grading a word out of the "missed" scope shrinks the
  // deck, and the next card can land on the exact same index the graded
  // one occupied, so an index-only comparison would miss the change.
  const [prevKey, setPrevKey] = useState(currentKey);
  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    setAttempt("");
    setFoundIds([]);
    setNotice(null);
    setOutcome(null);
    setNearMiss(null);
  }

  // Keeps the cursor in the answer box from one card to the next, so answers
  // can be typed back to back without clicking into it each time. Only pulls
  // focus back from inside the card (or from nowhere), so dragging a filter
  // slider above, which can move the deck onto a new card, isn't interrupted.
  // Left alone when it's already there: re-focusing a focused input makes
  // iOS Safari scroll the page to reveal it again, on every answer.
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const input = inputRef.current;
    const active = document.activeElement;
    if (!input || active === input) return;
    if (!active || active === document.body || cardRef.current?.contains(active)) {
      input.focus({ preventScroll: true });
    }
  }, [currentKey, outcome, nearMiss]);

  // The card grows when an answer is marked (the result opens under the
  // input) and would shrink back on the next card. Scrolled to the bottom of
  // the page — as you are on a phone with the keyboard up — that shrink drags
  // the whole screen down each time, so the card is never let shrink while
  // you're practising.
  const [cardMinHeight, setCardMinHeight] = useState(0);
  useLayoutEffect(() => {
    const height = cardRef.current?.offsetHeight ?? 0;
    if (height > cardMinHeight) setCardMinHeight(height);
  });

  // Once a card is over, Enter should move on to the next one, so the input
  // stays focused and editable rather than going read-only or disabled — a
  // read-only field drops a phone's on-screen keyboard. Typing is ignored
  // instead (see onChange).
  const locked = !!outcome || !!nearMiss;

  const variants = currentCard ? variantsFor(currentCard) : [];
  const answerOf = (word: Word) => (frontSide === "turkish" ? word.meaning : word.term);
  const prompt = currentCard ? (frontSide === "turkish" ? currentCard.term : currentCard.meaning) : "";
  const found = variants.filter((v) => foundIds.includes(v.id));
  const remaining = variants.filter((v) => !foundIds.includes(v.id));

  // Credits `hit` as answered: ends the card if it was the last one
  // outstanding, otherwise clears the input for the next variation.
  function acceptHit(hit: Word) {
    const left = remaining.length - 1;
    if (left === 0) {
      setOutcome({ found: [...found, hit], missed: [] });
    } else {
      setFoundIds([...foundIds, hit.id]);
      setAttempt("");
      setNotice(
        `Correct — ${left} more ${left === 1 ? "variation" : "variations"} you know. Type another.`
      );
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!currentCard || nearMiss) return;
    if (outcome) {
      handleNext();
      return;
    }
    if (!attempt.trim()) return;

    const typed = normalize(attempt);
    const matches = (v: Word) => normalize(answerOf(v)) === typed;
    const nearlyMatches = (v: Word) => stripAccents(normalize(answerOf(v))) === stripAccents(typed);

    const hit = remaining.find(matches);
    if (hit) {
      acceptHit(hit);
      return;
    }
    if (found.some(matches) || found.some(nearlyMatches)) {
      setAttempt("");
      setNotice(`You've already entered that one — ${remaining.length} more to go.`);
      return;
    }
    const near = remaining.find(nearlyMatches);
    if (near) {
      setNearMiss({ word: near, typed: attempt.trim() });
      return;
    }
    setOutcome({ found, missed: remaining, attempted: attempt.trim() });
  }

  function resolveNearMiss(wasTypo: boolean) {
    if (!nearMiss) return;
    const { word } = nearMiss;
    setNearMiss(null);
    if (wasTypo) acceptHit(word);
    else setOutcome({ found, missed: remaining, attempted: nearMiss.typed });
  }

  // Accepts a wrong answer as a slip of the fingers: credits the answer the
  // attempt was reaching for, without making the learner type it out again.
  function acceptTypo() {
    if (!outcome?.attempted || outcome.missed.length === 0) return;
    const target = closestTo(outcome.attempted, outcome.missed, answerOf);
    // Cleared first so a card with variations left reopens for the next one;
    // acceptHit sets it again when this was the last one outstanding.
    setOutcome(null);
    acceptHit(target);
  }

  // Keys that answer the card once it's over, wherever focus is within it.
  // Only live while the input is locked, so they never eat a letter the
  // learner is still typing.
  function handleCardKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const key = e.key.toLowerCase();
    if (nearMiss) {
      if (key === "t" || key === "y") {
        e.preventDefault();
        resolveNearMiss(true);
      } else if (key === "n") {
        e.preventDefault();
        resolveNearMiss(false);
      }
      return;
    }
    if (outcome?.attempted && outcome.missed.length > 0 && key === "t") {
      e.preventDefault();
      acceptTypo();
    }
  }

  // Put on every button here so tapping one doesn't pull focus out of the
  // answer box — on a phone that would drop the keyboard between cards.
  function keepInputFocus(e: MouseEvent) {
    e.preventDefault();
  }

  function giveUp() {
    if (!currentCard || outcome) return;
    setOutcome({ found, missed: remaining });
  }

  function handleNext() {
    if (!currentCard || !outcome) return;
    onAnswered(currentCard, [
      ...outcome.found.map((word) => ({ word, correct: true })),
      ...outcome.missed.map((word) => ({ word, correct: false })),
    ]);
    onGoTo(safeIndex + 1);
  }

  if (order.length === 0 || !currentCard) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white/60 p-10 text-center text-neutral-500">
        {emptyMessage}
      </div>
    );
  }

  const allCorrect = outcome !== null && outcome.missed.length === 0;
  const multi = variants.length > 1;

  return (
    <div className="flex flex-col items-center gap-3 sm:gap-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
        Card {safeIndex + 1} of {order.length}
      </p>

      <div
        ref={cardRef}
        style={{ minHeight: cardMinHeight || undefined }}
        className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-md shadow-neutral-900/5 sm:p-6"
        onKeyDown={handleCardKeyDown}
      >
        <p className="mb-3 text-center text-lg text-neutral-800 sm:mb-4">{prompt}</p>

        {found.length > 0 && (
          <ul className="mb-3 flex flex-wrap justify-center gap-1.5" aria-label="Answers you've got so far">
            {found.map((v) => (
              <li
                key={v.id}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-sm text-emerald-800"
              >
                ✓ {answerOf(v)}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            ref={inputRef}
            autoFocus
            value={attempt}
            onChange={(e) => {
              if (locked) return;
              setAttempt(e.target.value);
              setNotice(null);
            }}
            aria-readonly={locked}
            placeholder={
              found.length > 0
                ? "Type another…"
                : frontSide === "turkish"
                  ? "Type the English meaning…"
                  : "Type the Turkish word…"
            }
            className={`rounded-md border border-neutral-300 px-3 py-2 text-base outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-600/20 ${locked ? "bg-neutral-50 text-neutral-400" : ""}`}
          />
          {notice && !outcome && !nearMiss && (
            <p role="status" className="text-sm font-medium text-emerald-700">
              {notice}
            </p>
          )}
          {nearMiss && (
            <div
              role="alertdialog"
              aria-label="Was that a typo?"
              className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
            >
              <p>
                Almost — you typed <span className="font-medium">{nearMiss.typed}</span>, it's spelled{" "}
                <span className="font-semibold">{answerOf(nearMiss.word)}</span>. Was that a typo?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onMouseDown={keepInputFocus}
                  onClick={() => resolveNearMiss(true)}
                  className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-amber-800"
                >
                  Yes, a typo <span className="opacity-70">(T)</span>
                </button>
                <button
                  type="button"
                  onMouseDown={keepInputFocus}
                  onClick={() => resolveNearMiss(false)}
                  className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 transition hover:bg-amber-100"
                >
                  No, mark it wrong <span className="opacity-60">(N)</span>
                </button>
              </div>
            </div>
          )}
          {!outcome && !nearMiss && (
            <div className="flex gap-2">
              <button
                type="submit"
                onMouseDown={keepInputFocus}
                disabled={!attempt.trim()}
                className="flex-1 rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-red-900/20 transition hover:bg-red-800 disabled:opacity-50"
              >
                Check answer
              </button>
              {found.length > 0 && (
                <button
                  type="button"
                  onMouseDown={keepInputFocus}
                  onClick={giveUp}
                  className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
                >
                  Can't remember the rest
                </button>
              )}
            </div>
          )}
        </form>

        {outcome && (
          <div className="mt-4 flex flex-col gap-3">
            <p
              className={`text-sm font-medium ${allCorrect ? "text-emerald-700" : "text-neutral-700"}`}
            >
              {allCorrect
                ? multi
                  ? `Correct — all ${variants.length} variations.`
                  : "Correct."
                : "Not quite."}
            </p>

            {outcome.missed.length > 0 && (
              <div>
                <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">
                  {outcome.found.length > 0
                    ? "Also correct"
                    : outcome.missed.length > 1
                      ? "Correct answers"
                      : "Correct answer"}
                </h3>
                <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-neutral-50 text-neutral-800">
                  {outcome.missed.map((v) => (
                    <li key={v.id} className="px-3 py-2.5">
                      {answerOf(v)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onMouseDown={keepInputFocus}
                onClick={handleNext}
                className="flex-1 rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-red-900/20 transition hover:bg-red-800"
              >
                Next
              </button>
              {outcome.attempted && outcome.missed.length > 0 && (
                <button
                  type="button"
                  onMouseDown={keepInputFocus}
                  onClick={acceptTypo}
                  title="Credit the answer you were going for, without retyping it"
                  className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
                >
                  It was a typo <span className="opacity-60">(T)</span>
                </button>
              )}
            </div>
            <p className="-mt-1 text-center text-xs text-neutral-400">
              {outcome.attempted && outcome.missed.length > 0
                ? "Enter to carry on · T if that was just a typo"
                : "or press Enter"}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onMouseDown={keepInputFocus}
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
          onClick={() => onGoTo(safeIndex - 1)}
        >
          Prev
        </button>
        <button
          type="button"
          onMouseDown={keepInputFocus}
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
          onClick={onShuffle}
        >
          Shuffle
        </button>
        <button
          type="button"
          onMouseDown={keepInputFocus}
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
          onClick={() => onGoTo(safeIndex + 1)}
        >
          Next
        </button>
        {onReset && (
          <button
            type="button"
            onMouseDown={keepInputFocus}
            title="Back to the first card, in the original order"
            className="ml-2 rounded-md px-3 py-1.5 text-sm text-neutral-400 transition hover:bg-neutral-50 hover:text-neutral-600"
            onClick={onReset}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

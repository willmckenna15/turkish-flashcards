import type { UserSettings, Word, WordEvent } from "../types";

// Local-storage mirror of the current user's word list, plus a queue of
// writes that couldn't reach Supabase yet. This is what lets Vocab Study
// keep working with zero connectivity: the word list renders from this
// cache instantly, and any add/remove/grade made while offline is recorded
// here and replayed against Supabase once the network is back — see
// flushPendingWrites in WordsContext.tsx.
//
// Grammar Practice deliberately does NOT go through this cache — sentence
// generation is a live Gemini call, so there's no offline mode for it to
// support, and keeping the offline surface limited to `words` keeps this
// mechanism simple.

const WORDS_KEY_PREFIX = "turkish-flashcards:words:";
const WORD_EVENTS_KEY_PREFIX = "turkish-flashcards:word-events:";
const PENDING_KEY_PREFIX = "turkish-flashcards:pending-writes:";
const SETTINGS_KEY_PREFIX = "turkish-flashcards:settings:";
// Set when a settings write didn't reach Supabase, so the next load pushes
// the local copy up instead of pulling the server's older row over it.
const SETTINGS_UNSYNCED_KEY_PREFIX = "turkish-flashcards:settings-unsynced:";

// A word created while offline doesn't have a real Supabase row/id yet, so
// it's given a temporary id of this shape. flushPendingWrites resolves it to
// the real id once the "add" write successfully reaches the server, and
// rewrites any other still-queued writes that reference the temp id.
const LOCAL_ID_PREFIX = "local-";

export type PendingWrite =
  | { type: "add"; tempId: string; term: string; meaning: string; createdAt: string }
  | { type: "edit"; id: string; term: string; meaning: string }
  | { type: "remove"; id: string }
  | { type: "grade"; id: string; correct: boolean; createdAt: string }
  // Reverses a "grade" that already reached the server: drops that event
  // (matched by its timestamp) and puts the review flag back.
  | { type: "ungrade"; id: string; createdAt: string; needsReview: boolean }
  // Superseded by "grade" — still replayed so a queue written by an older
  // build drains cleanly after an update.
  | { type: "needsReview"; id: string; needsReview: boolean };

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full, disabled, or unavailable (e.g. private browsing) — the
    // cache is a best-effort convenience, never let it break the live app.
  }
}

export function loadCachedWords(userId: string): Word[] {
  return safeParse<Word[]>(localStorage.getItem(WORDS_KEY_PREFIX + userId), []);
}

export function saveCachedWords(userId: string, words: Word[]): void {
  safeSet(WORDS_KEY_PREFIX + userId, words);
}

// Word grade events are mirrored too, so the "words I've got wrong N times"
// deck filter and the vocab stats keep working offline.
export function loadCachedWordEvents(userId: string): WordEvent[] {
  return safeParse<WordEvent[]>(localStorage.getItem(WORD_EVENTS_KEY_PREFIX + userId), []);
}

export function saveCachedWordEvents(userId: string, events: WordEvent[]): void {
  safeSet(WORD_EVENTS_KEY_PREFIX + userId, events);
}

export function loadPendingWrites(userId: string): PendingWrite[] {
  return safeParse<PendingWrite[]>(localStorage.getItem(PENDING_KEY_PREFIX + userId), []);
}

export function savePendingWrites(userId: string, writes: PendingWrite[]): void {
  safeSet(PENDING_KEY_PREFIX + userId, writes);
}

// Settings are mirrored locally as well as stored in Supabase: it's what
// makes a grammar-concept selection survive closing the app even when the
// write couldn't reach the server, and it lets the picker render the right
// boxes ticked before the network round-trip finishes.
export function loadCachedSettings(userId: string): UserSettings | null {
  return safeParse<UserSettings | null>(
    localStorage.getItem(SETTINGS_KEY_PREFIX + userId),
    null
  );
}

export function saveCachedSettings(userId: string, settings: UserSettings): void {
  safeSet(SETTINGS_KEY_PREFIX + userId, settings);
}

export function loadSettingsUnsynced(userId: string): boolean {
  return safeParse<boolean>(localStorage.getItem(SETTINGS_UNSYNCED_KEY_PREFIX + userId), false);
}

export function saveSettingsUnsynced(userId: string, unsynced: boolean): void {
  safeSet(SETTINGS_UNSYNCED_KEY_PREFIX + userId, unsynced);
}

export function isLocalId(id: string): boolean {
  return id.startsWith(LOCAL_ID_PREFIX);
}

export function makeLocalId(): string {
  return `${LOCAL_ID_PREFIX}${crypto.randomUUID()}`;
}

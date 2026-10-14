import type { StatsTimeFilter, Word, WordEvent } from "../types";

// Time windows shared by the stats sections and the vocab deck's
// "words I've got wrong" filter.

export const timeFilterOptions: { value: StatsTimeFilter; label: string }[] = [
  { value: "all", label: "All-Time" },
  { value: "month", label: "Previous Month" },
  { value: "week", label: "Previous Week" },
  { value: "2days", label: "Past 2 Days" },
  { value: "today", label: "Today" },
  { value: "session", label: "This Session" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

// Earliest timestamp (ms) an event may have to fall inside the window, or
// null for no limit.
export function timeFilterCutoff(filter: StatsTimeFilter, sessionStart: string): number | null {
  const now = Date.now();
  switch (filter) {
    case "month":
      return now - 30 * DAY_MS;
    case "week":
      return now - 7 * DAY_MS;
    case "2days":
      return now - 2 * DAY_MS;
    case "today":
      return now - DAY_MS;
    case "session":
      return new Date(sessionStart).getTime();
    case "all":
    default:
      return null;
  }
}

export interface WordTally {
  wrong: number;
  correct: number;
}

// Per-word grade tallies within a window, keyed by word id. Words with no
// events in the window are simply absent.
export function tallyWordEvents(events: WordEvent[], cutoff: number | null): Map<string, WordTally> {
  const tallies = new Map<string, WordTally>();
  for (const event of events) {
    if (cutoff !== null && new Date(event.createdAt).getTime() < cutoff) continue;
    const tally = tallies.get(event.wordId) ?? { wrong: 0, correct: 0 };
    if (event.correct) tally.correct += 1;
    else tally.wrong += 1;
    tallies.set(event.wordId, tally);
  }
  return tallies;
}

// "How recently did I add this word" — the stops on the Vocab Study slider,
// newest first so sliding right widens the net, ending at everything.
export type AddedWindow = "today" | "week" | "month" | "3months" | "year" | "all";

export const addedWindowOptions: { value: AddedWindow; label: string; days: number | null }[] = [
  { value: "today", label: "Added today", days: 1 },
  { value: "week", label: "Added in the last week", days: 7 },
  { value: "month", label: "Added in the last month", days: 30 },
  { value: "3months", label: "Added in the last 3 months", days: 90 },
  { value: "year", label: "Added in the last year", days: 365 },
  { value: "all", label: "Added any time", days: null },
];

// Earliest addedAt (ms) a word may have to fall inside the window, or null
// for no limit.
export function addedWindowCutoff(window: AddedWindow): number | null {
  const option = addedWindowOptions.find((o) => o.value === window);
  if (!option || option.days === null) return null;
  return Date.now() - option.days * DAY_MS;
}

export function isWithinAddedWindow(word: Word, cutoff: number | null): boolean {
  if (cutoff === null) return true;
  const added = new Date(word.addedAt).getTime();
  // An unparseable date shouldn't make a word disappear from every window.
  return Number.isNaN(added) ? true : added >= cutoff;
}

// Whether each word's most recent graded attempt was wrong, keyed by word id.
// Words never graded are absent.
export function latestGradeWrong(events: WordEvent[]): Map<string, boolean> {
  const latest = new Map<string, { at: number; wrong: boolean }>();
  for (const event of events) {
    const at = new Date(event.createdAt).getTime();
    const prev = latest.get(event.wordId);
    // Events aren't stored sorted, and an undo removes one from the middle,
    // so compare timestamps rather than trusting position.
    if (!prev || at >= prev.at) latest.set(event.wordId, { at, wrong: !event.correct });
  }
  return new Map([...latest].map(([id, v]) => [id, v.wrong]));
}

// The review list, read from the grade log rather than the stored
// `needsReview` flag. The flag is a single boolean overwritten on every
// grade — including, until recently, by grammar practice, which cleared it
// for every list word in a sentence it marked correct — so it drifts out of
// step with the history it's meant to summarise. The log is the record that
// the stats are built from, so deriving from it keeps the two in agreement.
//
// A word with no logged attempt falls back to the flag: that's all the
// evidence there is for grades recorded before word_events existed.
export function isMissed(word: Word, latestWrong: Map<string, boolean>): boolean {
  return latestWrong.get(word.id) ?? word.needsReview;
}

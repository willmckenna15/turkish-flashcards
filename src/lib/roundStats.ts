import type { Word, WordEvent } from "../types";
import { tallyWordEvents } from "./statsFilter";

// How a round of flashcards is scored, as pure functions over the grade
// history — see useRound.ts for what counts as a "round" and RoundSummaryModal
// for how this is shown.

// What the history said about a word *before* the round started. This is the
// baseline every "you used to / now you do" stat is measured against, so it's
// snapshotted once when a round begins rather than re-read as the round's own
// grades land.
export type PriorStatus =
  // Never graded before — this round is its first outing.
  | "unseen"
  // Last attempt was correct.
  | "known"
  // Last attempt was wrong.
  | "shaky";

export interface PriorRecord {
  status: PriorStatus;
  wrong: number;
  total: number;
}

export function snapshotPriors(events: WordEvent[]): Map<string, PriorRecord> {
  const byWord = new Map<
    string,
    { wrong: number; total: number; lastAt: number; lastCorrect: boolean }
  >();

  for (const event of events) {
    const at = new Date(event.createdAt).getTime();
    const rec = byWord.get(event.wordId) ?? {
      wrong: 0,
      total: 0,
      lastAt: -Infinity,
      lastCorrect: true,
    };
    rec.total += 1;
    if (!event.correct) rec.wrong += 1;
    // Events arrive in insertion order rather than sorted, and an undo can
    // remove one from the middle, so pick the latest by timestamp instead of
    // trusting the last element.
    if (at >= rec.lastAt) {
      rec.lastAt = at;
      rec.lastCorrect = event.correct;
    }
    byWord.set(event.wordId, rec);
  }

  const priors = new Map<string, PriorRecord>();
  for (const [wordId, rec] of byWord) {
    priors.set(wordId, {
      status: rec.lastCorrect ? "known" : "shaky",
      wrong: rec.wrong,
      total: rec.total,
    });
  }
  return priors;
}

export interface RoundGrade {
  word: Word;
  correct: boolean;
}

export interface RoundAnswer {
  cardKey: string;
  grades: RoundGrade[];
}

export interface MissRow {
  word: Word;
  wrong: number;
  total: number;
}

export interface Rank {
  title: string;
  blurb: string;
}

export interface RoundSummary {
  correct: number;
  incorrect: number;
  total: number;
  // 0–100, rounded.
  percent: number;
  cards: number;
  // Longest run of correct answers in a row.
  bestStreak: number;
  durationMs: number;
  rank: Rank;
  // Words you'd missed last time and have now got right.
  comebackKids: Word[];
  // Words with a spotless record until this round.
  fumbles: Word[];
  // Missed this round, and not for the first time — with the running total.
  usualSuspects: MissRow[];
  // Right on their very first outing.
  firstTimers: Word[];
}

function priorStatusOf(word: Word, priors: Map<string, PriorRecord>): PriorStatus {
  const prior = priors.get(word.id);
  if (prior) return prior.status;
  // No logged attempts: either genuinely new, or graded before word_events
  // existed (migration 0005) — in which case the review flag is all we have.
  return word.needsReview ? "shaky" : "unseen";
}

function rankFor(percent: number, total: number): Rank {
  if (total === 0) return { title: "Boş", blurb: "Nothing graded this round." };
  if (percent === 100) return { title: "Mükemmel!", blurb: "A perfect round — not one slip." };
  if (percent >= 90) return { title: "Harika", blurb: "Nearly flawless." };
  if (percent >= 75) return { title: "Çok iyi", blurb: "A solid round." };
  if (percent >= 50) return { title: "Fena değil", blurb: "More right than wrong." };
  if (percent > 0) return { title: "Devam et", blurb: "Keep at it — this deck is still new." };
  return { title: "Olsun", blurb: "Everyone starts somewhere." };
}

export function summarizeRound(
  answers: RoundAnswer[],
  priors: Map<string, PriorRecord>,
  startedAt: number,
  endedAt: number
): RoundSummary {
  const grades = answers.flatMap((answer) => answer.grades);

  let correct = 0;
  let bestStreak = 0;
  let streak = 0;
  const comebackKids: Word[] = [];
  const fumbles: Word[] = [];
  const usualSuspects: MissRow[] = [];
  const firstTimers: Word[] = [];

  for (const { word, correct: wasRight } of grades) {
    const prior = priors.get(word.id);
    const status = priorStatusOf(word, priors);

    if (wasRight) {
      correct += 1;
      streak += 1;
      if (streak > bestStreak) bestStreak = streak;
      if (status === "shaky") comebackKids.push(word);
      else if (status === "unseen") firstTimers.push(word);
    } else {
      streak = 0;
      const priorWrong = prior?.wrong ?? 0;
      // A repeat offender and a broken clean record are graded on the same
      // answer, so they're kept exclusive: having missed the word before is
      // the stronger story, and a word in both lists at once reads like a bug.
      if (priorWrong > 0) {
        usualSuspects.push({
          word,
          wrong: priorWrong + 1,
          total: (prior?.total ?? 0) + 1,
        });
      } else if (status === "known") {
        fumbles.push(word);
      }
    }
  }

  const total = grades.length;
  const incorrect = total - correct;
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);

  const byTerm = (a: Word, b: Word) => a.term.localeCompare(b.term, "tr");
  comebackKids.sort(byTerm);
  fumbles.sort(byTerm);
  firstTimers.sort(byTerm);
  usualSuspects.sort((a, b) => b.wrong - a.wrong || byTerm(a.word, b.word));

  return {
    correct,
    incorrect,
    total,
    percent,
    cards: answers.length,
    bestStreak,
    durationMs: Math.max(0, endedAt - startedAt),
    rank: rankFor(percent, total),
    comebackKids,
    fumbles,
    usualSuspects,
    firstTimers,
  };
}

// The words you've got wrong most often, ever — the standing list the round's
// own stats are a snapshot of. Ties break on miss rate, so of two words missed
// four times the one you've had fewer chances at ranks higher.
export function topMissedWords(words: Word[], events: WordEvent[], limit = 10): MissRow[] {
  const tallies = tallyWordEvents(events, null);
  return words
    .map((word) => {
      const tally = tallies.get(word.id) ?? { wrong: 0, correct: 0 };
      return { word, wrong: tally.wrong, total: tally.wrong + tally.correct };
    })
    .filter((row) => row.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong || b.wrong / b.total - a.wrong / a.total)
    .slice(0, limit);
}

export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

import type { AttemptResult, SentenceCard, Word } from "../types";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function generateSentences(
  words: Word[],
  conceptIds: string[],
  focusConceptIds: string[],
  count: number,
  knownPercentage: number
): Promise<SentenceCard[]> {
  const res = await fetch("/api/generate-sentences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ words, conceptIds, focusConceptIds, count, knownPercentage }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status);
  }

  return res.json();
}

// The vocabulary-list words a sentence used, passed to the grader so it
// knows which words the learner was specifically expected to produce.
export interface KnownWordRef {
  term: string;
  meaning: string;
}

export async function gradeAttempt(
  targetSentence: string,
  userAttempt: string,
  conceptIds: string[],
  knownWords: KnownWordRef[]
): Promise<AttemptResult> {
  const res = await fetch("/api/grade-attempt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetSentence, userAttempt, conceptIds, knownWords }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status);
  }

  return res.json();
}

export interface GradeAttemptInput {
  targetSentence: string;
  userAttempt: string;
  conceptIds: string[];
  knownWords: KnownWordRef[];
}

// Grades several attempts in a single Gemini call — used to analyse a whole
// finished session's worth of answers at once instead of firing one request
// per card, which burns through the free-tier quota much faster.
export async function gradeAttemptsBatch(attempts: GradeAttemptInput[]): Promise<AttemptResult[]> {
  const res = await fetch("/api/grade-attempt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attempts }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status);
  }

  return res.json();
}

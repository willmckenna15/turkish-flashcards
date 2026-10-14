import { useEffect, useState, type FormEvent } from "react";
import { gradeAttempt, gradeAttemptsBatch, ApiError, type KnownWordRef } from "../lib/api";
import { knownWordsInSentence } from "../lib/sentenceWords";
import { gradeLocally } from "../lib/localGrade";
import { SentenceCard as SentenceCardView } from "./SentenceCard";
import { grammarConcepts } from "../data/grammarConcepts";
import type { AttemptIssue, AttemptResult, IssueType, SentenceCard, Token, Word } from "../types";

const conceptNameById = new Map(grammarConcepts.map((c) => [c.id, c.name]));

interface TypingPracticeProps {
  cards: SentenceCard[];
  words: Word[];
  order: number[];
  index: number;
  onGoTo: (index: number) => void;
  onShuffle: () => void;
  onGraded: (card: SentenceCard, result: AttemptResult) => void;
  emptyMessage?: string;
}

// Reduces a word to its letters, so punctuation and casing can't turn a
// matching word into a mismatch.
function normalizeWord(word: string): string {
  return word.toLocaleLowerCase("tr-TR").replace(/[^a-zçğıöşü]/gi, "");
}

// Shared-root match for English glosses (snow/snowing/snows).
function wordCovers(attemptWord: string, key: string): boolean {
  if (!attemptWord || !key) return false;
  if (attemptWord === key) return true;
  const shorter = attemptWord.length < key.length ? attemptWord : key;
  const longer = attemptWord.length < key.length ? key : attemptWord;
  return shorter.length >= 3 && longer.startsWith(shorter);
}

// Looks up which sentence token an English prompt word most likely translates,
// by matching against that token's dictionary-gloss "meaning" field.
function findTokenForEnglishWord(
  word: string,
  tokens: Token[]
): { token: Token; index: number } | undefined {
  const target = normalizeWord(word);
  if (!target) return undefined;

  const splitWords = (text: string) =>
    text
      .toLocaleLowerCase("tr-TR")
      .split(/[\s/,]+/)
      .map((w) => w.replace(/[^a-zçğıöşü]/gi, ""))
      .filter(Boolean);

  // First pass: the token's own alignment to this sentence's English wording.
  // That's the only thing that can connect a clicked word to its token when
  // the sentence translates idiomatically — "mind" never appears in the gloss
  // of "fikrimi", whose dictionary meaning is "idea".
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.isPunctuation || !token.english) continue;
    if (splitWords(token.english).some((w) => w === target)) {
      return { token, index: i };
    }
  }

  // Fall back to the dictionary gloss, which is all older cards carry.
  // English is inflected too (snow/snowing/snows), and the gloss only stores
  // the dictionary form, so allow a shared-root match rather than requiring
  // the clicked word to equal the gloss exactly.
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.isPunctuation || !token.meaning) continue;
    if (splitWords(token.meaning).some((w) => wordCovers(w, target))) {
      return { token, index: i };
    }
  }
  return undefined;
}

const toKnownWordRef = (w: Word): KnownWordRef => ({ term: w.term, meaning: w.meaning });

const issueStyles: Record<IssueType, string> = {
  spelling: "border-amber-200 bg-amber-50 text-amber-800",
  vocabulary: "border-rose-200 bg-rose-50 text-rose-800",
  grammar: "border-indigo-200 bg-indigo-50 text-indigo-800",
};

const issueLabels: Record<IssueType, string> = {
  spelling: "Spelling",
  vocabulary: "Vocabulary",
  grammar: "Grammar",
};

const POINTS_PER_CARD = 5;

interface CardResult {
  english: string;
  turkish: string;
  attempt: string;
  score: number;
  analysed: boolean;
  // Reference words the local check couldn't account for.
  missing: string[];
  issues?: AttemptIssue[];
  grammarIncorrect?: boolean;
  conceptsUsed: string[];
  // The list words the sentence used, for the grader's context.
  knownWords: KnownWordRef[];
}

export function TypingPractice({
  cards,
  words,
  order,
  index: safeIndex,
  onGoTo,
  onShuffle,
  onGraded,
  emptyMessage = "No cards to practice right now.",
}: TypingPracticeProps) {
  const [attempt, setAttempt] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openHint, setOpenHint] = useState<{ key: number; display: string } | null>(null);
  const [sessionResults, setSessionResults] = useState<CardResult[]>([]);
  const [finished, setFinished] = useState(false);
  const [analysingIndices, setAnalysingIndices] = useState<Set<number>>(new Set());

  const currentCard = cards.length > 0 ? cards[order[safeIndex]] : undefined;
  const currentKey = currentCard?.turkish ?? null;
  const knownWords = currentCard ? knownWordsInSentence(currentCard, words) : [];

  // Reset per-card state synchronously during render (not via a useEffect,
  // which only runs after that render has already painted) so the previous
  // card's submitted answer / revealed hints / correct-answer view never
  // flashes onto the new card for a frame before clearing. Compared by card
  // identity (the sentence text), not the numeric index — see
  // FlashcardDeck's identical fix for why an index-only check isn't enough.
  const [prevKey, setPrevKey] = useState(currentKey);
  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    resetCardState();
  }

  useEffect(() => {
    setSessionResults([]);
    setFinished(false);
    setAnalysingIndices(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards]);

  function resetCardState() {
    setAttempt("");
    setSubmitted(false);
    setResult(null);
    setAnalysing(false);
    setError(null);
    setOpenHint(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!currentCard || !attempt.trim() || submitted) return;
    setSubmitted(true);
  }

  async function handleAnalyse() {
    if (!currentCard || analysing || result) return;
    setAnalysing(true);
    setError(null);
    try {
      const res = await gradeAttempt(
        currentCard.turkish,
        attempt.trim(),
        currentCard.conceptsUsed,
        knownWords.map(toKnownWordRef)
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to grade attempt.");
    } finally {
      setAnalysing(false);
    }
  }

  // Runs the same AI grading call as the per-card "Analyse errors" button,
  // but targeted at an already-completed session-summary row by index.
  async function analyseCard(index: number, entry: CardResult) {
    setAnalysingIndices((prev) => new Set(prev).add(index));
    try {
      const res = await gradeAttempt(entry.turkish, entry.attempt, entry.conceptsUsed, entry.knownWords);
      setSessionResults((prev) =>
        prev.map((item, i) =>
          i === index
            ? {
                ...item,
                analysed: true,
                issues: res.issues,
                grammarIncorrect: res.grammarIncorrect,
                score: res.correct ? POINTS_PER_CARD : item.score,
              }
            : item
        )
      );
    } catch {
      // Best-effort — leave the row as "not analysed"; the user can retry it individually.
    } finally {
      setAnalysingIndices((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  }

  // Fetches the full AI breakdown for every answer that wasn't already
  // analysed mid-session — skipping only the ones that were an exact match
  // (already certainly correct, so there's nothing useful to analyse). This
  // is opt-in: it only runs when the user clicks "Analyse all" (or a per-row
  // "Analyse" button) on the session summary, never automatically, so
  // finishing a deck never silently burns API quota. All pending cards are
  // graded in a single batched Gemini call rather than one request per card.
  async function analyseAllPending(finalResults: CardResult[]) {
    const pending = finalResults
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => !entry.analysed && entry.score !== POINTS_PER_CARD);
    if (pending.length === 0) return;

    setAnalysingIndices((prev) => {
      const next = new Set(prev);
      pending.forEach(({ index }) => next.add(index));
      return next;
    });

    try {
      const results = await gradeAttemptsBatch(
        pending.map(({ entry }) => ({
          targetSentence: entry.turkish,
          userAttempt: entry.attempt,
          conceptIds: entry.conceptsUsed,
          knownWords: entry.knownWords,
        }))
      );

      setSessionResults((prev) => {
        const next = [...prev];
        pending.forEach(({ index }, i) => {
          const res = results[i];
          if (!res) return;
          next[index] = {
            ...next[index],
            analysed: true,
            issues: res.issues,
            grammarIncorrect: res.grammarIncorrect,
            // The AI's verdict outranks the word-overlap score: it's the only
            // one of the two that can tell "plajda" from "sahilde", or know
            // that "topla" is simply "top ile" contracted.
            score: res.correct ? POINTS_PER_CARD : next[index].score,
          };
        });
        return next;
      });
    } catch {
      // Best-effort — rows stay "not analysed"; the user can retry them individually
      // via the per-row "Analyse" button.
    } finally {
      setAnalysingIndices((prev) => {
        const next = new Set(prev);
        pending.forEach(({ index }) => next.delete(index));
        return next;
      });
    }
  }

  function handleWordClick(word: string, key: number) {
    if (!currentCard) return;
    const match = findTokenForEnglishWord(word, currentCard.tokens);
    if (!match) {
      setOpenHint({ key, display: "No translation found." });
      return;
    }
    setOpenHint({ key, display: match.token.lemma ?? match.token.text });
  }

  function handleNext() {
    if (!currentCard) return;
    // The local check understands synonyms from the learner's own list and
    // the instrumental clitic, so most correct answers are recognised here
    // without an AI call at all.
    const local = gradeLocally(attempt, currentCard, words);
    const score = result?.correct ? POINTS_PER_CARD : local.score;
    const newResult: CardResult = {
      english: currentCard.english,
      turkish: currentCard.turkish,
      attempt,
      score,
      analysed: !!result,
      missing: result?.correct ? [] : local.missing,
      issues: result?.issues,
      grammarIncorrect: result?.grammarIncorrect,
      conceptsUsed: currentCard.conceptsUsed,
      knownWords: knownWords.map(toKnownWordRef),
    };
    setSessionResults((prev) => [...prev, newResult]);

    if (result) {
      onGraded(currentCard, result);
    }

    if (safeIndex >= cards.length - 1) {
      setFinished(true);
    } else {
      onGoTo(safeIndex + 1);
    }
  }

  function handleRestart() {
    setSessionResults([]);
    setFinished(false);
    setAnalysingIndices(new Set());
    onShuffle();
  }

  function renderEnglishPrompt(text: string) {
    const parts = text.split(/(\s+)/);
    return parts.map((part, i) => {
      if (part === "" || /^\s+$/.test(part)) {
        return <span key={i}>{part}</span>;
      }
      return (
        <span
          key={i}
          className="cursor-pointer border-b border-dotted border-neutral-300 transition hover:text-red-600 hover:border-red-400"
          onClick={() => handleWordClick(part, i)}
        >
          {part}
        </span>
      );
    });
  }

  if (finished) {
    const score = sessionResults.reduce((sum, r) => sum + r.score, 0);
    const maxScore = sessionResults.length * POINTS_PER_CARD;
    const pendingCount = sessionResults.filter(
      (r) => !r.analysed && r.score !== POINTS_PER_CARD
    ).length;

    // A card can score below full marks for purely vocabulary/spelling
    // reasons (e.g. a missing word) while every grammar concept it
    // demonstrated was actually used correctly. Only blame a concept once we
    // have AI-analysed evidence (grammarIncorrect) that grammar specifically
    // was the problem — a non-perfect score alone isn't enough.
    const conceptTally = new Map<string, { total: number; missed: number }>();
    sessionResults.forEach((r) => {
      if (r.score === POINTS_PER_CARD) return;
      const grammarMissed = r.analysed && r.grammarIncorrect === true;
      r.conceptsUsed.forEach((conceptId) => {
        const entry = conceptTally.get(conceptId) ?? { total: 0, missed: 0 };
        entry.total += 1;
        if (grammarMissed) entry.missed += 1;
        conceptTally.set(conceptId, entry);
      });
    });
    const conceptRows = Array.from(conceptTally.entries())
      .map(([conceptId, stats]) => ({
        id: conceptId,
        name: conceptNameById.get(conceptId) ?? conceptId,
        ...stats,
      }))
      .filter((c) => c.missed > 0)
      .sort((a, b) => b.missed / b.total - a.missed / a.total || b.missed - a.missed);

    return (
      <div className="flex w-full max-w-md flex-col gap-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-md shadow-neutral-900/5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-400">
            Session complete
          </h2>
          <p className="mt-1 text-3xl font-semibold text-neutral-800">
            {score} / {maxScore}
          </p>
          <p className="mt-1 text-xs text-neutral-400">{POINTS_PER_CARD} marks per card</p>
        </div>

        {analysingIndices.size === 0 && pendingCount > 0 && (
          <button
            type="button"
            onClick={() => analyseAllPending(sessionResults)}
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm shadow-neutral-900/5 transition hover:bg-neutral-50"
          >
            Analyse all ({pendingCount})
          </button>
        )}

        {analysingIndices.size > 0 && (
          <p className="text-center text-xs text-neutral-400">Analysing answers…</p>
        )}

        {conceptRows.length > 0 && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm shadow-neutral-900/5">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
              Grammar concepts you struggled with
            </h3>
            <div className="flex flex-col gap-1.5">
              {conceptRows.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-neutral-700">{c.name}</span>
                  <span className="text-xs text-indigo-700">
                    missed {c.missed}/{c.total}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {sessionResults.map((r, i) => {
            const isAnalysing = analysingIndices.has(i);
            const needsAnalysis = !r.analysed && r.score !== POINTS_PER_CARD;
            // Until it's been checked, all we have is how many words overlap
            // with the reference — which says nothing about a synonym or an
            // equally valid construction. Say so rather than calling a
            // correct answer "Partially correct".
            const label =
              r.score === POINTS_PER_CARD
                ? "Correct"
                : r.score === 0
                  ? "Incorrect"
                  : "Partially correct";
            const styles =
              r.score === POINTS_PER_CARD
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : r.score === 0
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-amber-200 bg-amber-50 text-amber-800";
            return (
              <div key={i} className={`rounded-md border px-3 py-2 text-sm ${styles}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {label} · {r.score}/{POINTS_PER_CARD}
                  </span>
                  {isAnalysing && <span className="text-xs opacity-70">Analysing…</span>}
                  {!isAnalysing && needsAnalysis && (
                    <button
                      type="button"
                      onClick={() => analyseCard(i, r)}
                      className="text-xs font-medium underline underline-offset-2 opacity-80 transition hover:opacity-100"
                    >
                      Analyse
                    </button>
                  )}
                </div>
                <p className="mt-1 text-neutral-700">{r.english}</p>
                <p className="mt-1 text-xs">
                  Your answer: <span className="italic">{r.attempt || "(blank)"}</span>
                </p>
                <p className="text-xs">
                  Correct answer: <span className="italic">{r.turkish}</span>
                </p>

                {!r.analysed && r.missing.length > 0 && (
                  <p className="mt-1 text-xs opacity-80">
                    Missing: {r.missing.join(", ")}
                  </p>
                )}
                {r.analysed && r.issues && r.issues.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {r.issues.map((issue, idx) => (
                      <div
                        key={idx}
                        className={`rounded border px-2 py-1.5 text-xs ${issueStyles[issue.type]}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-medium uppercase tracking-wide">
                            {issueLabels[issue.type]}
                          </span>
                          <span>
                            "{issue.userText}" → "{issue.expectedText}"
                          </span>
                        </div>
                        <p className="mt-0.5">{issue.note}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleRestart}
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-red-900/20 transition hover:bg-red-800"
        >
          Practice again
        </button>
      </div>
    );
  }

  if (cards.length === 0 || !currentCard) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white/60 p-10 text-center text-neutral-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
        Card {safeIndex + 1} of {cards.length}
      </p>

      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-md shadow-neutral-900/5">
        <p className="mb-1 text-center text-lg text-neutral-800">
          {renderEnglishPrompt(currentCard.english)}
        </p>
        <p className="mb-4 text-center text-xs text-neutral-400">
          Click a word if you're unsure of its translation.
        </p>

        {openHint && (
          <div className="mb-4 flex items-center justify-center gap-2 rounded-md border border-red-100 bg-red-50/60 px-3 py-2 text-sm">
            <span className="text-neutral-700">{openHint.display}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            value={attempt}
            onChange={(e) => setAttempt(e.target.value)}
            disabled={submitted}
            placeholder="Type the Turkish sentence…"
            className="rounded-md border border-neutral-300 px-3 py-2 text-base outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-600/20 disabled:bg-neutral-50"
          />
          {!submitted && (
            <button
              type="submit"
              disabled={!attempt.trim()}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-red-900/20 transition hover:bg-red-800 disabled:opacity-50"
            >
              Check answer
            </button>
          )}
        </form>

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

        {submitted && (
          <div className="mt-4 flex flex-col gap-3">
            <div>
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">
                Correct answer
              </h3>
              <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3">
                <SentenceCardView card={currentCard} showTurkish />
              </div>
            </div>

            {!result && (
              <button
                type="button"
                onClick={handleAnalyse}
                disabled={analysing}
                className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                {analysing ? "Analysing…" : "Analyse errors"}
              </button>
            )}

            {result && (
              <>
                <p
                  className={`text-sm font-medium ${
                    result.correct ? "text-emerald-700" : "text-neutral-700"
                  }`}
                >
                  {result.correct ? "Correct." : "Not quite — see the notes below."}
                </p>

                {result.issues.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {result.issues.map((issue, i) => (
                      <div
                        key={i}
                        className={`rounded-md border px-3 py-2 text-sm ${issueStyles[issue.type]}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium uppercase tracking-wide">
                            {issueLabels[issue.type]}
                          </span>
                          <span className="text-xs">
                            "{issue.userText}" → "{issue.expectedText}"
                          </span>
                        </div>
                        <p className="mt-1 text-sm">{issue.note}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-red-900/20 transition hover:bg-red-800"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
          onClick={() => onGoTo(safeIndex - 1)}
        >
          Prev
        </button>
        <button
          type="button"
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
          onClick={handleRestart}
        >
          Shuffle
        </button>
        <button
          type="button"
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
          onClick={() => onGoTo(safeIndex + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

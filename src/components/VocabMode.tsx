import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { useWords, type GradeReceipt } from "../lib/WordsContext";
import { useDeckPosition } from "../lib/useDeckPosition";
import { useLocalStorageState } from "../lib/useLocalStorageState";
import { groupByMeaning } from "../lib/wordGroups";
import {
  addedWindowCutoff,
  addedWindowOptions,
  isMissed,
  isWithinAddedWindow,
  latestGradeWrong,
  tallyWordEvents,
  timeFilterCutoff,
  timeFilterOptions,
  type AddedWindow,
} from "../lib/statsFilter";
import { useRound } from "../lib/useRound";
import { topMissedWords } from "../lib/roundStats";
import { FlashcardDeck } from "./FlashcardDeck";
import { RoundSummaryModal } from "./RoundSummaryModal";
import { ScopeToggle } from "./ScopeToggle";
import { VocabTypingPractice } from "./VocabTypingPractice";
import type { PracticeMode, StatsTimeFilter, Word } from "../types";

// "Only words I've got wrong at least N times in the past <window>".
// minWrong 0 means off.
interface WrongFilter {
  minWrong: number;
  window: StatsTimeFilter;
}

const defaultWrongFilter: WrongFilter = { minWrong: 0, window: "week" };

function isWrongFilter(value: unknown): value is WrongFilter {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.minWrong === "number" &&
    v.minWrong >= 0 &&
    typeof v.window === "string" &&
    timeFilterOptions.some((opt) => opt.value === v.window)
  );
}

// The slider always offers at least this many steps, so the filter is
// usable before any word has been missed that often.
const MIN_SLIDER_MAX = 5;

function isAddedWindow(value: unknown): value is AddedWindow {
  return typeof value === "string" && addedWindowOptions.some((o) => o.value === value);
}

// The most recent answer, kept so it can be undone: the grades it recorded,
// which card to return to, and how to describe it.
interface LastAnswer {
  receipts: GradeReceipt[];
  cardKey: string;
  summary: string;
}

function describeAnswer(grades: { word: Word; correct: boolean }[]): string {
  const right = grades.filter((g) => g.correct).map((g) => g.word.term);
  const wrong = grades.filter((g) => !g.correct).map((g) => g.word.term);
  const parts: string[] = [];
  if (right.length > 0) parts.push(`${right.join(", ")} marked right`);
  if (wrong.length > 0) parts.push(`${wrong.join(", ")} marked wrong`);
  return parts.join(" · ");
}

export function VocabMode() {
  const { user } = useAuth();
  const { words, wordEvents, sessionStart, settings, updateSettings, gradeVocab, undoGrade } =
    useWords();
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("flip");
  const [lastAnswer, setLastAnswer] = useState<LastAnswer | null>(null);
  const [wrongFilter, setWrongFilter] = useLocalStorageState<WrongFilter>(
    `turkish-flashcards:wrong-filter:${user?.id ?? "anon"}`,
    defaultWrongFilter,
    isWrongFilter
  );

  const [addedWindow, setAddedWindow] = useLocalStorageState<AddedWindow>(
    `turkish-flashcards:added-window:${user?.id ?? "anon"}`,
    "all",
    isAddedWindow
  );
  const addedCutoff = useMemo(() => addedWindowCutoff(addedWindow), [addedWindow]);
  const addedFilterActive = addedWindow !== "all";
  const addedIndex = addedWindowOptions.findIndex((o) => o.value === addedWindow);

  // Derived from the grade log, not the stored flag — see isMissed.
  const latestWrong = useMemo(() => latestGradeWrong(wordEvents), [wordEvents]);
  const missedCount = useMemo(
    () => words.filter((w) => isMissed(w, latestWrong)).length,
    [words, latestWrong]
  );
  const deck = useMemo(
    () => (settings.studyScope === "missed" ? words.filter((w) => isMissed(w, latestWrong)) : words),
    [words, latestWrong, settings.studyScope]
  );
  // Typing English → Turkish collapses words that share a meaning into one
  // card with several accepted answers (see wordGroups.ts): only the
  // group's representative is shown, and any member is accepted. This is
  // done by hiding the other members rather than building a different deck,
  // so the saved order and position are the same ones every mode uses.
  //
  // Which word represents a group is decided within the scoped deck (so in
  // the "missed" scope the card shown is a missed word), but the answers a
  // card accepts come from the whole list — so a meaning still asks for
  // *every* Turkish word you have for it, even the ones you know. Grading
  // is per word, so getting them all right clears the card out of the
  // scope; missing one keeps it there.
  const grouped = practiceMode === "type" && settings.frontSide === "english";
  const deckGroups = useMemo(() => groupByMeaning(deck), [deck]);
  const allGroups = useMemo(() => groupByMeaning(words), [words]);
  const variantsFor = (card: Word) => (grouped ? (allGroups.members.get(card.id) ?? [card]) : [card]);

  // How many times each word has been got wrong within the chosen window.
  const wrongCounts = useMemo(() => {
    const cutoff = timeFilterCutoff(wrongFilter.window, sessionStart);
    const counts = new Map<string, number>();
    for (const [wordId, tally] of tallyWordEvents(wordEvents, cutoff)) counts.set(wordId, tally.wrong);
    return counts;
  }, [wordEvents, wrongFilter.window, sessionStart]);
  const maxWrong = useMemo(() => Math.max(0, ...wrongCounts.values()), [wrongCounts]);
  const filterActive = wrongFilter.minWrong > 0;

  // A grouped card counts if any of its variations has been missed enough.
  const isVisible = (card: Word) => {
    if (grouped && deckGroups.representativeOf.get(card.id) !== card.id) return false;
    if (addedFilterActive && !variantsFor(card).some((m) => isWithinAddedWindow(m, addedCutoff))) {
      return false;
    }
    if (!filterActive) return true;
    return variantsFor(card).some((m) => (wrongCounts.get(m.id) ?? 0) >= wrongFilter.minWrong);
  };

  // Per account and per scope, so "all" and "missed" each resume where they
  // left off (and switching between them doesn't scramble either one).
  // Grouping and the wrong-count filter are applied as visibility rather
  // than baked into the deck, so every mode shares one saved order and
  // position; a place saved on a word that's hidden in typing mode resolves
  // to its group's card.
  const { order, index, goTo, goToKey, shuffle, reset } = useDeckPosition(deck, (w) => w.id, {
    storageKey: user ? `turkish-flashcards:deck:${user.id}:${settings.studyScope}` : undefined,
    isVisible,
    canonicalKey: (key) => (grouped ? (deckGroups.representativeOf.get(key) ?? key) : key),
  });

  // A round covers the cards visible when you start answering, so it's
  // abandoned whenever the scope or the wrong-count filter changes the deck
  // out from under it.
  const deckKeys = useMemo(() => order.map((i) => deck[i].id), [order, deck]);
  const round = useRound({
    deckKeys,
    wordEvents,
    deckSignature: `${settings.studyScope}|${wrongFilter.minWrong}|${wrongFilter.window}|${addedWindow}`,
  });
  const [lastRoundPercent, setLastRoundPercent] = useLocalStorageState<number | null>(
    `turkish-flashcards:last-round:${user?.id ?? "anon"}`,
    null
  );
  // All-time, so this round's own misses are already counted in.
  const topMissed = useMemo(
    () => (round.view ? topMissedWords(words, wordEvents) : []),
    [round.view, words, wordEvents]
  );

  function recordAnswer(cardKey: string, grades: { word: Word; correct: boolean }[]) {
    const receipts = grades.map((g) => gradeVocab(g.word.id, g.correct));
    setLastAnswer({ receipts, cardKey, summary: describeAnswer(grades) });
    // `index` is the card being graded, so this is the last one in the order.
    round.recordAnswer(cardKey, grades, { reachedEnd: index >= order.length - 1 });
  }

  async function undoLastAnswer() {
    if (!lastAnswer) return;
    const { receipts, cardKey } = lastAnswer;
    setLastAnswer(null);
    round.undoLast();
    goToKey(cardKey);
    await Promise.all(receipts.map((r) => undoGrade(r)));
  }

  // Closing a partial view returns you to the round; closing a finished one
  // ends it, and only then is the score kept for the next round's delta.
  function closeSummary() {
    if (round.view && !round.view.partial) setLastRoundPercent(round.view.summary.percent);
    round.close();
  }

  function endRound() {
    if (round.view) setLastRoundPercent(round.view.summary.percent);
    round.endRound();
  }

  // ⌘Z / Ctrl+Z undoes the last answer — unless focus is in a field with
  // text in it, where it should keep meaning "undo my typing".
  useEffect(() => {
    if (!lastAnswer || round.view) return;
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
      const el = document.activeElement;
      if (
        (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
        el.value !== ""
      ) {
        return;
      }
      e.preventDefault();
      void undoLastAnswer();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAnswer, round.view]);

  const windowLabel =
    timeFilterOptions.find((opt) => opt.value === wrongFilter.window)?.label.toLowerCase() ?? "";
  const addedLabel = (addedWindowOptions[addedIndex]?.label ?? "").toLowerCase();
  const emptyMessage = filterActive
    ? `No words got wrong ${wrongFilter.minWrong}+ times (${windowLabel}) in this scope.`
    : addedFilterActive
      ? `No words ${addedLabel} in this scope.`
    : settings.studyScope === "missed"
      ? "No missed words right now — nice work."
      : "Add some words in the Words tab first.";

  const showTurkishFirst = settings.frontSide === "turkish";

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <ScopeToggle
          scope={settings.studyScope}
          missedCount={missedCount}
          onChange={(scope) => updateSettings({ studyScope: scope })}
        />

        <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5 text-sm shadow-sm shadow-neutral-900/5">
          <button
            type="button"
            onClick={() => updateSettings({ frontSide: "turkish" })}
            className={`rounded px-3 py-1.5 font-medium transition ${
              showTurkishFirst ? "bg-red-700 text-white shadow-sm" : "text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            Turkish → English
          </button>
          <button
            type="button"
            onClick={() => updateSettings({ frontSide: "english" })}
            className={`rounded px-3 py-1.5 font-medium transition ${
              !showTurkishFirst ? "bg-red-700 text-white shadow-sm" : "text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            English → Turkish
          </button>
        </div>

        <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5 text-sm shadow-sm shadow-neutral-900/5">
          <button
            type="button"
            onClick={() => setPracticeMode("flip")}
            className={`rounded px-3 py-1.5 font-medium transition ${
              practiceMode === "flip" ? "bg-red-700 text-white shadow-sm" : "text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            Flip cards
          </button>
          <button
            type="button"
            onClick={() => setPracticeMode("type")}
            className={`rounded px-3 py-1.5 font-medium transition ${
              practiceMode === "type" ? "bg-red-700 text-white shadow-sm" : "text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            Type answers
          </button>
        </div>
      </div>

      <div className="flex w-full max-w-md flex-col gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm shadow-sm shadow-neutral-900/5">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="wrong-filter-slider" className="font-medium text-neutral-700">
            {filterActive ? (
              <>
                Only words wrong{" "}
                <span className="text-red-700">
                  {wrongFilter.minWrong}+ {wrongFilter.minWrong === 1 ? "time" : "times"}
                </span>
              </>
            ) : (
              "All words"
            )}
          </label>
          {filterActive && (
            <button
              type="button"
              onClick={() => setWrongFilter({ ...wrongFilter, minWrong: 0 })}
              className="text-xs text-neutral-400 transition hover:text-neutral-600"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input
            id="wrong-filter-slider"
            type="range"
            min={0}
            max={Math.max(MIN_SLIDER_MAX, maxWrong, wrongFilter.minWrong)}
            step={1}
            value={wrongFilter.minWrong}
            onChange={(e) => setWrongFilter({ ...wrongFilter, minWrong: Number(e.target.value) })}
            aria-valuetext={filterActive ? `wrong at least ${wrongFilter.minWrong} times` : "all words"}
            className="flex-1 accent-red-700"
          />
          <select
            value={wrongFilter.window}
            onChange={(e) =>
              setWrongFilter({ ...wrongFilter, window: e.target.value as StatsTimeFilter })
            }
            aria-label="Time window for the wrong-count filter"
            className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
          >
            {timeFilterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {round.answered > 0 && (
        <div className="flex w-full max-w-md items-center justify-between gap-3 text-xs text-neutral-400">
          <span className="tabular-nums">
            {round.answered} answered this round
          </span>
          <button
            type="button"
            onClick={round.peek}
            title="See how this round is going so far"
            className="shrink-0 rounded-md border border-neutral-200 bg-white px-2.5 py-1 font-medium text-neutral-600 shadow-sm shadow-neutral-900/5 transition hover:border-neutral-300 hover:bg-neutral-50"
          >
            Round stats
          </button>
        </div>
      )}

      <div className="flex w-full max-w-md flex-col gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm shadow-sm shadow-neutral-900/5">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="added-window-slider" className="font-medium text-neutral-700">
            {addedFilterActive ? (
              <>
                Only words{" "}
                <span className="text-red-700">{addedLabel}</span>
              </>
            ) : (
              "Words added any time"
            )}
          </label>
          {addedFilterActive && (
            <button
              type="button"
              onClick={() => setAddedWindow("all")}
              className="text-xs text-neutral-400 transition hover:text-neutral-600"
            >
              Clear
            </button>
          )}
        </div>
        <input
          id="added-window-slider"
          type="range"
          min={0}
          max={addedWindowOptions.length - 1}
          step={1}
          value={addedIndex < 0 ? addedWindowOptions.length - 1 : addedIndex}
          onChange={(e) => setAddedWindow(addedWindowOptions[Number(e.target.value)].value)}
          aria-valuetext={addedLabel}
          className="w-full accent-red-700"
        />
        {/* Sliding right widens the window, so the newest words sit at the
            left-hand end where you start. */}
        <div className="flex justify-between text-[11px] text-neutral-400">
          <span>Today</span>
          <span>Week</span>
          <span>Month</span>
          <span>3 mo</span>
          <span>Year</span>
          <span>All</span>
        </div>
      </div>

      {practiceMode === "flip" ? (
        <FlashcardDeck<Word>
          cards={deck}
          order={order}
          index={index}
          onGoTo={goTo}
          onShuffle={shuffle}
          onReset={reset}
          getKey={(w) => w.id}
          renderFront={(w) => <span>{showTurkishFirst ? w.term : w.meaning}</span>}
          renderBack={(w) => <span>{showTurkishFirst ? w.meaning : w.term}</span>}
          onGrade={(word, correct) => recordAnswer(word.id, [{ word, correct }])}
          emptyMessage={emptyMessage}
        />
      ) : (
        <VocabTypingPractice
          cards={deck}
          frontSide={settings.frontSide}
          variantsFor={variantsFor}
          order={order}
          index={index}
          onGoTo={goTo}
          onShuffle={shuffle}
          onReset={reset}
          onAnswered={(card, grades) => recordAnswer(card.id, grades)}
          emptyMessage={emptyMessage}
        />
      )}

      {lastAnswer && (
        <div
          role="status"
          className="flex w-full max-w-md animate-pop-in items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm shadow-neutral-900/5"
        >
          <span className="min-w-0 flex-1 truncate text-neutral-600">{lastAnswer.summary}</span>
          <button
            type="button"
            onClick={() => void undoLastAnswer()}
            className="shrink-0 font-medium text-red-700 transition hover:text-red-800"
          >
            Undo
          </button>
          <kbd className="hidden shrink-0 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] text-neutral-400 sm:inline">
            ⌘Z
          </kbd>
        </div>
      )}

      {round.view && (
        <RoundSummaryModal
          summary={round.view.summary}
          partial={round.view.partial}
          topMissed={topMissed}
          previousPercent={lastRoundPercent}
          onClose={closeSummary}
          onEndRound={round.view.partial ? endRound : undefined}
          onDrillMisses={
            !round.view.partial &&
            round.view.summary.incorrect > 0 &&
            settings.studyScope !== "missed"
              ? () => {
                  closeSummary();
                  void updateSettings({ studyScope: "missed" });
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { useWords } from "../lib/WordsContext";
import { isMissed, latestGradeWrong } from "../lib/statsFilter";
import { useDeckPosition } from "../lib/useDeckPosition";
import { generateSentences, ApiError } from "../lib/api";
import { FlashcardDeck } from "./FlashcardDeck";
import { GrammarPicker } from "./GrammarPicker";
import { ConceptStats } from "./ConceptStats";
import { SentenceCard as SentenceCardView } from "./SentenceCard";
import { TypingPractice } from "./TypingPractice";
import type { AttemptResult, PracticeMode, SentenceCard } from "../types";
import type { SentenceGradeOutcome } from "../lib/grading";

const wrongReasons = [
  { value: "word", label: "Word" },
  { value: "grammar", label: "Grammar" },
  { value: "both", label: "Both" },
];

export function GrammarMode() {
  const { words, wordEvents, settings, updateSettings, gradeSentence, isOnline } = useWords();
  const [count, setCount] = useState(8);
  const [knownPercentage, setKnownPercentage] = useState(70);
  const [deck, setDeck] = useState<SentenceCard[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("flip");

  // Derived from the grade log, not the stored flag — see isMissed.
  const latestWrong = useMemo(() => latestGradeWrong(wordEvents), [wordEvents]);
  const missedCount = useMemo(
    () => words.filter((w) => isMissed(w, latestWrong)).length,
    [words, latestWrong]
  );
  const eligibleWords = useMemo(
    () => (settings.studyScope === "missed" ? words.filter((w) => isMissed(w, latestWrong)) : words),
    [words, latestWrong, settings.studyScope]
  );
  const { order, index, goTo, shuffle } = useDeckPosition(deck, (c) => c.turkish);

  function toggleConcept(id: string) {
    const isSelected = settings.selectedConceptIds.includes(id);
    const nextSelected = isSelected
      ? settings.selectedConceptIds.filter((c) => c !== id)
      : [...settings.selectedConceptIds, id];
    // Deselecting a concept can't leave it behind as a "focus" concept —
    // focus only makes sense for concepts that are actually in play.
    const nextFocus = isSelected
      ? settings.focusConceptIds.filter((c) => c !== id)
      : settings.focusConceptIds;
    updateSettings({ selectedConceptIds: nextSelected, focusConceptIds: nextFocus });
  }

  function toggleFocus(id: string) {
    const next = settings.focusConceptIds.includes(id)
      ? settings.focusConceptIds.filter((c) => c !== id)
      : [...settings.focusConceptIds, id];
    updateSettings({ focusConceptIds: next });
  }

  async function handleGenerate() {
    setError(null);

    if (!isOnline) {
      setError("You're offline — Grammar Practice needs a connection to generate sentences.");
      return;
    }
    if (settings.selectedConceptIds.length === 0) {
      setError("Pick at least one grammar concept to practice.");
      return;
    }
    if (eligibleWords.length === 0) {
      setError("No words available for the current scope — add words or switch scope.");
      return;
    }

    setGenerating(true);
    try {
      const sentences = await generateSentences(
        eligibleWords,
        settings.selectedConceptIds,
        settings.focusConceptIds,
        count,
        knownPercentage
      );
      setDeck(sentences);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate sentences.");
    } finally {
      setGenerating(false);
    }
  }

  // Grammar practice never touches the vocabulary review list — getting a
  // word wrong inside a sentence is a sentence-level slip, not evidence that
  // the word itself needs relearning, and having it quietly move words into
  // "words I got wrong" made that list untrustworthy. Only grammar-concept
  // stats are recorded from here; the word list is driven solely by Vocab
  // Study, where every grade is deliberate and undoable.
  function handleTypedGrade(card: SentenceCard, result: AttemptResult) {
    const outcome: SentenceGradeOutcome = result.grammarIncorrect ? "grammar" : "correct";
    gradeSentence([], card.conceptsUsed, outcome);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <GrammarPicker
        selectedConceptIds={settings.selectedConceptIds}
        onToggleConcept={toggleConcept}
        focusConceptIds={settings.focusConceptIds}
        onToggleFocus={toggleFocus}
        scope={settings.studyScope}
        onScopeChange={(scope) => updateSettings({ studyScope: scope })}
        missedCount={missedCount}
        count={count}
        onCountChange={setCount}
        knownPercentage={knownPercentage}
        onKnownPercentageChange={setKnownPercentage}
        frontSide={settings.frontSide}
        onFrontSideChange={(side) => updateSettings({ frontSide: side })}
        onGenerate={handleGenerate}
        generating={generating}
        error={error}
        isOnline={isOnline}
      />

      {deck.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="inline-flex self-center rounded-md border border-neutral-200 bg-white p-0.5 text-sm shadow-sm shadow-neutral-900/5">
            <button
              type="button"
              onClick={() => setPracticeMode("flip")}
              className={`rounded px-3 py-1.5 font-medium transition ${
                practiceMode === "flip"
                  ? "bg-red-700 text-white shadow-sm"
                  : "text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              Flip cards
            </button>
            <button
              type="button"
              onClick={() => setPracticeMode("type")}
              className={`rounded px-3 py-1.5 font-medium transition ${
                practiceMode === "type"
                  ? "bg-red-700 text-white shadow-sm"
                  : "text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              Type answers
            </button>
          </div>

          {practiceMode === "flip" ? (
            <FlashcardDeck<SentenceCard>
              cards={deck}
              order={order}
              index={index}
              onGoTo={goTo}
              onShuffle={shuffle}
              getKey={(c) => c.turkish}
              wrongReasons={wrongReasons}
              renderFront={(card) => (
                <SentenceCardView card={card} showTurkish={settings.frontSide === "turkish"} />
              )}
              renderBack={(card) => (
                <SentenceCardView card={card} showTurkish={settings.frontSide !== "turkish"} />
              )}
              // No word ids: the grade feeds the grammar-concept stats only.
              // "Word" vs "Grammar" still matters there — a sentence whose
              // only fault was the vocabulary shouldn't count against the
              // concept it was demonstrating.
              onGrade={(card, correct, reason) =>
                gradeSentence(
                  [],
                  card.conceptsUsed,
                  correct ? "correct" : ((reason ?? "both") as SentenceGradeOutcome)
                )
              }
            />
          ) : (
            <TypingPractice
              cards={deck}
              words={words}
              order={order}
              index={index}
              onGoTo={goTo}
              onShuffle={shuffle}
              onGraded={handleTypedGrade}
            />
          )}
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm shadow-neutral-900/5">
        <h2 className="mb-3 text-sm font-medium text-neutral-700">Grammar accuracy</h2>
        <ConceptStats />
      </div>
    </div>
  );
}

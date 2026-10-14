export type SentenceGradeOutcome = "correct" | "word" | "grammar" | "both";

export interface WordGradeEffect {
  needsReview: boolean | null; // null = leave unchanged
}

export interface ConceptGradeEffect {
  correctDelta: number;
  incorrectDelta: number;
}

export function vocabGradeEffect(correct: boolean): WordGradeEffect {
  return { needsReview: !correct };
}

export function sentenceGradeEffect(outcome: SentenceGradeOutcome): {
  word: WordGradeEffect;
  concept: ConceptGradeEffect;
} {
  switch (outcome) {
    case "correct":
      return { word: { needsReview: false }, concept: { correctDelta: 1, incorrectDelta: 0 } };
    case "word":
      return { word: { needsReview: true }, concept: { correctDelta: 1, incorrectDelta: 0 } };
    case "grammar":
      return { word: { needsReview: null }, concept: { correctDelta: 0, incorrectDelta: 1 } };
    case "both":
      return { word: { needsReview: true }, concept: { correctDelta: 0, incorrectDelta: 1 } };
  }
}

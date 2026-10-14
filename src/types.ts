export interface Word {
  id: string;
  term: string;
  meaning: string;
  addedAt: string;
  needsReview: boolean;
}

export interface GrammarConcept {
  id: string;
  name: string;
  category: string;
  description: string;
  // Grammar no Turkish sentence can avoid (word order, pronoun forms, sound
  // rules…). Selectable to practise, but never listed as something to steer
  // clear of when it isn't selected.
  pervasive?: boolean;
}

export interface Token {
  text: string;
  lemma?: string;
  meaning?: string;
  // The word(s) of the sentence's English translation that this token
  // actually renders. `meaning` is the dictionary gloss of the lemma, which
  // often isn't the wording the English sentence uses ("fikrimi" is glossed
  // "idea" in a sentence that reads "changed my mind"), so clicking an
  // English word needs this alignment to find its token. Optional: cards
  // generated before it existed simply fall back to gloss matching.
  english?: string;
  // Not on the learner's word list — the "new" share of the vocabulary mix.
  isNew?: boolean;
  isPunctuation?: boolean;
}

export interface SentenceCard {
  turkish: string;
  english: string;
  tokens: Token[];
  conceptsUsed: string[];
}

export interface ConceptEvent {
  conceptId: string;
  correct: boolean;
  createdAt: string;
}

// One graded attempt at a word, from vocab study or grammar practice.
export interface WordEvent {
  wordId: string;
  correct: boolean;
  createdAt: string;
}

export type StatsTimeFilter = "all" | "month" | "week" | "2days" | "today" | "session";

export type FrontSide = "turkish" | "english";
export type StudyScope = "all" | "missed";
export type PracticeMode = "flip" | "type";

export type IssueType = "spelling" | "vocabulary" | "grammar";

export interface AttemptIssue {
  type: IssueType;
  userText: string;
  expectedText: string;
  note: string;
}

export interface AttemptResult {
  correct: boolean;
  vocabIncorrect: boolean;
  grammarIncorrect: boolean;
  issues: AttemptIssue[];
}

export interface UserSettings {
  selectedConceptIds: string[];
  // Subset of selectedConceptIds. A "focus" concept must appear in EVERY
  // generated sentence (instead of just being eligible, like a plain
  // selected concept, where each sentence only needs at least one of them).
  focusConceptIds: string[];
  frontSide: FrontSide;
  studyScope: StudyScope;
}

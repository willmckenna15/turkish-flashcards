import { normalizeTerm } from "./normalizeTerm";
import type { SentenceCard, Token, Word } from "../types";

// With no single "target" word, every vocabulary-list word that appears in a
// generated sentence is what the sentence is practising. These helpers find
// them by matching each token's dictionary form against the saved terms.

export function findWordForToken(token: Token, words: Word[]): Word | undefined {
  if (token.isPunctuation) return undefined;
  const key = normalizeTerm(token.lemma ?? token.text);
  if (!key) return undefined;
  return words.find((w) => normalizeTerm(w.term) === key);
}

// The distinct list words used in a sentence, in order of first appearance.
export function knownWordsInSentence(card: SentenceCard, words: Word[]): Word[] {
  const seen = new Set<string>();
  const found: Word[] = [];
  for (const token of card.tokens) {
    const word = findWordForToken(token, words);
    if (word && !seen.has(word.id)) {
      seen.add(word.id);
      found.push(word);
    }
  }
  return found;
}

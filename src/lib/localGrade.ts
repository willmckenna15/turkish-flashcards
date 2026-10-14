import type { SentenceCard, Word } from "../types";

// Scores a typed sentence against the reference without calling the AI.
//
// The previous version compared raw word lists and counted the overlap,
// which fails on two things Turkish does constantly:
//
//   - the instrumental clitic: "top ile" and "topla" are the same thing,
//     but as word lists they share only one word out of two;
//   - synonyms: "plajda" and "sahilde" are both "at the beach", yet share
//     no letters at all.
//
// Both are answerable locally. The clitic is a fixed rule, and a synonym can
// be resolved through the learner's own vocabulary list: if the word they
// typed is on their list, and its meaning matches the meaning of the
// reference token, they've produced a word they know that means the same
// thing. That's a correct answer, not a partial one.

const POINTS = 5;

function lower(text: string): string {
  return text.toLocaleLowerCase("tr-TR");
}

function wordsOf(text: string): string[] {
  return lower(text)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// The learner's list keyed by meaning, so a typed word can be traced back to
// what it means and compared against the reference token's own gloss.
function meaningsByTerm(words: Word[]): Map<string, Set<string>> {
  const byTerm = new Map<string, Set<string>>();
  for (const word of words) {
    const key = lower(word.term.trim());
    const glosses = byTerm.get(key) ?? new Set<string>();
    for (const part of lower(word.meaning).split(/[\/,;]/)) {
      const gloss = part.trim();
      if (gloss) glosses.add(gloss);
    }
    byTerm.set(key, glosses);
  }
  return byTerm;
}

function glossesOf(text: string | undefined): Set<string> {
  const out = new Set<string>();
  if (!text) return out;
  for (const part of lower(text).split(/[\/,;]/)) {
    const gloss = part.trim();
    if (gloss) out.add(gloss);
  }
  return out;
}

// "topla" carries "top" + the instrumental; strip the clitic so the stem can
// be compared. Only used to satisfy a reference token, never to invent one,
// so an unrelated verb that merely ends in -la can't fake a match.
function withoutInstrumental(word: string): string | null {
  const match = /^(.{2,})(y?l[ae])$/u.exec(word);
  return match ? match[1] : null;
}

export interface LocalGrade {
  score: number;
  matched: number;
  total: number;
  // Reference words with nothing in the attempt to account for them.
  missing: string[];
  // True when every reference word was accounted for and nothing was left
  // over — as close to "correct" as can be judged without the AI.
  complete: boolean;
}

export function gradeLocally(attempt: string, card: SentenceCard, words: Word[]): LocalGrade {
  const attemptWords = wordsOf(attempt);
  const byTerm = meaningsByTerm(words);
  const tokens = card.tokens.filter((t) => !t.isPunctuation && t.text.trim());

  const reference = tokens.length > 0 ? tokens : null;
  const refWords = reference
    ? reference.map((t) => ({ surface: lower(t.text), lemma: lower(t.lemma ?? t.text), token: t }))
    : wordsOf(card.turkish).map((w) => ({ surface: w, lemma: w, token: undefined }));

  const unused = [...attemptWords];
  const missing: string[] = [];
  let matched = 0;

  const take = (predicate: (word: string) => boolean): boolean => {
    const at = unused.findIndex(predicate);
    if (at < 0) return false;
    unused.splice(at, 1);
    return true;
  };

  for (const ref of refWords) {
    const refGlosses = glossesOf(ref.token?.meaning);

    const hit =
      // Straight match on the surface or dictionary form.
      take((w) => w === ref.surface || w === ref.lemma) ||
      // The stem of an attempt word that has the instrumental attached.
      //
      // Deliberately NOT "the attempt word starts with the lemma": the
      // reference token is already inflected, so accepting any suffix on the
      // stem would wave through every suffix error there is — "torunleri"
      // for "torunları" is a vowel-harmony mistake, not a match, and
      // grammar practice exists to catch exactly that.
      take((w) => withoutInstrumental(w) === ref.lemma) ||
      // "ile" written separately where the attempt contracted it.
      (ref.lemma === "ile" &&
        attemptWords.some((w) => withoutInstrumental(w) !== null) &&
        true) ||
      // A different word the learner knows that means the same thing.
      (refGlosses.size > 0 &&
        take((w) => {
          const glosses = byTerm.get(w) ?? byTerm.get(withoutInstrumental(w) ?? "");
          if (glosses) {
            for (const gloss of glosses) if (refGlosses.has(gloss)) return true;
          }
          // Inflected: fall back to a list term this word begins with, so
          // "plajda" still resolves through "plaj". A term that IS the
          // reference's own stem is skipped — then the two words are the
          // same word and any difference between them is a suffix error,
          // which this path must not excuse.
          for (const [term, glosses2] of byTerm) {
            if (term === ref.lemma) continue;
            if (term.length >= 3 && w.startsWith(term)) {
              for (const gloss of glosses2) if (refGlosses.has(gloss)) return true;
            }
          }
          return false;
        }));

    if (hit) matched += 1;
    else missing.push(ref.surface);
  }

  const total = refWords.length;
  const complete = total > 0 && matched === total && unused.length === 0;
  const ratio = total === 0 ? 0 : matched / total;
  // No artificial ceiling: an answer that accounts for every reference word
  // with nothing left over earns full marks, which is what "correct" means.
  const score = complete ? POINTS : Math.round(ratio * POINTS * 2) / 2;

  return { score, matched, total, missing, complete };
}

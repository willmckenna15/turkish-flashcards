// Canonical form of a word's Turkish term, used to decide whether two
// entries are "the same word" for duplicate detection. Trims whitespace and
// lowercases with Turkish casing rules, so dotted/dotless I fold correctly
// (İ → i, I → ı) rather than the default I → i.
//
// Must stay in lockstep with `normalize_term()` in
// supabase/migrations/0004_unique_words.sql — that's the expression behind
// the unique index on `words`, so anything this function treats as distinct
// the database must too, and vice versa.
export function normalizeTerm(term: string): string {
  return term.trim().toLocaleLowerCase("tr-TR");
}

// Two entries are the same word only when the term AND the meaning match.
// A Turkish term often carries unrelated English meanings (yüz = "face" /
// "hundred" / "swim") and each needs its own card, so the term alone can't
// be the identity. The same rule is applied to both halves, matching the
// composite unique index in 0006_unique_word_meaning.sql.
export function sameWord(
  a: { term: string; meaning: string },
  b: { term: string; meaning: string }
): boolean {
  return (
    normalizeTerm(a.term) === normalizeTerm(b.term) &&
    normalizeTerm(a.meaning) === normalizeTerm(b.meaning)
  );
}

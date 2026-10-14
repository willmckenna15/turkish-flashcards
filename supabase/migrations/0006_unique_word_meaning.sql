-- A Turkish term can carry unrelated English meanings (yüz = "face" /
-- "hundred" / "swim"), and each deserves its own card. Duplicate detection
-- therefore keys on the term AND the meaning together: the same term may be
-- added as many times as it has distinct meanings, but the same term with
-- the same meaning still can't be added twice.
--
-- Replaces the term-only index from 0004. normalize_term() is reused for the
-- meaning so the client can apply one identical rule to both halves of the
-- key — see src/lib/normalizeTerm.ts.

drop index if exists words_user_term_unique;

create unique index if not exists words_user_term_meaning_unique
  on words (user_id, normalize_term(term), normalize_term(meaning));

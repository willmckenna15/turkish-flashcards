-- One entry per word per user: the same Turkish term (ignoring surrounding
-- whitespace and case) can't be added twice to one account.
--
-- Postgres' lower() uses default (non-Turkish) casing, so I → i rather than
-- I → ı and İ → i̇ (i + combining dot) rather than İ → i. Swapping those two
-- letters first makes the result match the client's
-- toLocaleLowerCase("tr-TR") exactly — see src/lib/normalizeTerm.ts.
create or replace function normalize_term(t text) returns text
language sql immutable strict
as $$ select lower(translate(btrim(t), 'Iİ', 'ıi')) $$;

-- Existing duplicates would block the index, so collapse them first: keep
-- the earliest-added row per word, but if any of the copies was flagged as
-- needing review, carry that over so the flag isn't lost.
update words w
set needs_review = true
where not w.needs_review
  and exists (
    select 1 from words d
    where d.user_id = w.user_id
      and d.id <> w.id
      and normalize_term(d.term) = normalize_term(w.term)
      and d.needs_review
  );

delete from words w
using words d
where d.user_id = w.user_id
  and normalize_term(d.term) = normalize_term(w.term)
  and (d.added_at < w.added_at or (d.added_at = w.added_at and d.id < w.id));

create unique index words_user_term_unique on words (user_id, normalize_term(term));

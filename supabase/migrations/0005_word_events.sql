-- One row per graded attempt at a word, across vocab study and grammar
-- practice, so "how often have I got this wrong in the past week" can be
-- answered for any window. Mirrors concept_events for grammar concepts.
create table word_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid not null references words(id) on delete cascade,
  correct boolean not null,
  created_at timestamptz not null default now()
);
alter table word_events enable row level security;
create policy "own word events" on word_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index word_events_user_word_idx on word_events (user_id, word_id, created_at);

-- Applies one grade atomically: flips the word's review flag and logs the
-- attempt. p_created_at is when the grade actually happened — a grade made
-- offline is replayed later, and should count towards the day it was made.
-- Runs as the caller (security invoker), so row-level security still limits
-- it to the caller's own words; a word deleted meanwhile is a no-op.
create or replace function record_word_grade(
  p_word_id uuid,
  p_correct boolean,
  p_created_at timestamptz default now()
)
returns void
language sql
set search_path = public
as $$
  update words set needs_review = not p_correct where id = p_word_id;
  insert into word_events (user_id, word_id, correct, created_at)
  select user_id, id, p_correct, p_created_at from words where id = p_word_id;
$$;

create table concept_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id text not null,
  correct boolean not null,
  created_at timestamptz not null default now()
);
alter table concept_events enable row level security;
create policy "own concept events" on concept_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index concept_events_user_concept_idx on concept_events (user_id, concept_id, created_at);

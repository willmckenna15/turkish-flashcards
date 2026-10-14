create table words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  term text not null,
  meaning text not null,
  added_at timestamptz not null default now(),
  needs_review boolean not null default false
);
alter table words enable row level security;
create policy "own words" on words for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_concept_ids text[] not null default '{}',
  front_side text not null default 'turkish', -- 'turkish' | 'english'
  study_scope text not null default 'all' -- 'all' | 'missed'
);
alter table user_settings enable row level security;
create policy "own settings" on user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table concept_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id text not null,
  correct_count int not null default 0,
  incorrect_count int not null default 0,
  primary key (user_id, concept_id)
);
alter table concept_stats enable row level security;
create policy "own concept stats" on concept_stats for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

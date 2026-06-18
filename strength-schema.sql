-- ===========================================================================
-- Strength Log — database schema
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query,
-- paste this whole file, then click "Run".
-- ===========================================================================

-- A single training session (a visit to the gym).
create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  performed_at timestamptz not null default now(),
  rating       int check (rating between 1 and 5),
  notes        text,
  created_at   timestamptz not null default now()
);

-- A single set of a single exercise, belonging to a session.
create table if not exists public.exercise_sets (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.sessions (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise     text not null,
  weight       numeric,
  reps         int,
  set_number   int,
  created_at   timestamptz not null default now()
);

create index if not exists exercise_sets_session_idx  on public.exercise_sets (session_id);
create index if not exists exercise_sets_exercise_idx on public.exercise_sets (user_id, exercise);
create index if not exists sessions_user_time_idx      on public.sessions (user_id, performed_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security: every user can only ever see/modify their own rows.
-- ---------------------------------------------------------------------------
alter table public.sessions      enable row level security;
alter table public.exercise_sets enable row level security;

drop policy if exists "own sessions" on public.sessions;
create policy "own sessions" on public.sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own sets" on public.exercise_sets;
create policy "own sets" on public.exercise_sets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

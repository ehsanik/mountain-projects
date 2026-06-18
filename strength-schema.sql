-- ===========================================================================
-- Workout Logger — database schema (Supabase / Postgres)
-- Run once: Dashboard → SQL Editor → New query → paste all → Run.
--
-- Adapted from the build-guide spec to this stack:
--   * user_id is uuid referencing auth.users(id), default auth.uid()
--   * security is enforced by Row Level Security (not an app server)
--   * every user-data table carries user_id so RLS stays simple and fast
--   * weight unit is a per-user setting on the profiles table
-- ===========================================================================

-- --- Replace v1 ------------------------------------------------------------
-- The original simple Strength Log used these two tables. They are empty and
-- unused; drop them so the names are free for the richer model below.
drop table if exists public.exercise_sets cascade;
-- (v1 also had public.sessions; it is recreated below with the new shape.)
drop table if exists public.sessions cascade;

-- --- Per-user settings -----------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  weight_unit text not null default 'lb' check (weight_unit in ('lb','kg')),
  created_at  timestamptz not null default now()
);

-- --- Exercise library (shared seeds + user-created) ------------------------
-- user_id NULL  = built-in seed exercise (readable by everyone)
-- user_id set   = custom exercise owned by that user
create table if not exists public.exercises (
  id           bigint generated always as identity primary key,
  user_id      uuid references auth.users (id) on delete cascade,
  name         text not null,
  muscle_group text,
  equipment    text,
  description  text,
  created_at   timestamptz not null default now()
);

create table if not exists public.templates (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  phase      text,
  created_at timestamptz not null default now()
);

create table if not exists public.template_exercises (
  id          bigint generated always as identity primary key,
  template_id bigint not null references public.templates (id) on delete cascade,
  exercise_id bigint not null references public.exercises (id) on delete restrict,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  section     text,
  position    integer not null,
  target_sets text,
  target_reps text,
  target_rest text,
  unique (template_id, position)
);

create table if not exists public.sessions (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  template_id  bigint references public.templates (id) on delete set null,
  performed_on date not null default current_date,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  notes        text
);

create table if not exists public.set_logs (
  id          bigint generated always as identity primary key,
  session_id  bigint not null references public.sessions (id) on delete cascade,
  exercise_id bigint not null references public.exercises (id) on delete restrict,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  set_number  integer not null,
  weight      numeric(6,2),
  reps        integer,
  completed   boolean not null default false,
  unique (session_id, exercise_id, set_number)
);

-- --- Indexes the app's queries actually use --------------------------------
create index if not exists idx_sessions_user_date on public.sessions (user_id, performed_on desc);
create index if not exists idx_setlogs_session    on public.set_logs (session_id);
create index if not exists idx_setlogs_exercise   on public.set_logs (user_id, exercise_id);
create index if not exists idx_tmplex_template    on public.template_exercises (template_id, position);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.profiles           enable row level security;
alter table public.exercises          enable row level security;
alter table public.templates          enable row level security;
alter table public.template_exercises enable row level security;
alter table public.sessions           enable row level security;
alter table public.set_logs           enable row level security;

-- profiles: a user sees/edits only their own row
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- exercises: everyone can read seeds + their own; can only write their own
drop policy if exists "read exercises" on public.exercises;
create policy "read exercises" on public.exercises
  for select using (user_id is null or auth.uid() = user_id);

drop policy if exists "insert own exercises" on public.exercises;
create policy "insert own exercises" on public.exercises
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own exercises" on public.exercises;
create policy "update own exercises" on public.exercises
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own exercises" on public.exercises;
create policy "delete own exercises" on public.exercises
  for delete using (auth.uid() = user_id);

-- the remaining tables are strictly owner-scoped
drop policy if exists "own templates" on public.templates;
create policy "own templates" on public.templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own template_exercises" on public.template_exercises;
create policy "own template_exercises" on public.template_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own sessions" on public.sessions;
create policy "own sessions" on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own set_logs" on public.set_logs;
create policy "own set_logs" on public.set_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===========================================================================
-- Seed exercises (built-in, user_id = NULL).
-- The 7 from the guide plus standard core moves the starter templates use.
-- ===========================================================================
insert into public.exercises (user_id, name, muscle_group, equipment, description)
select * from (values
  (null::uuid, 'Dumbbell Bench Press', 'Chest', 'Dumbbell',
   'Lie flat on a bench, a dumbbell in each hand at chest level, palms forward. Press straight up until arms are nearly extended, then lower slowly to chest level. Chest with shoulders and triceps assisting.'),
  (null, 'Bent Over Tricep Kickbacks', 'Triceps', 'Dumbbell',
   'Hinge forward at the hips with a flat back, elbows bent ~90 degrees and tucked to your sides. Extend the forearms straight back until arms are straight, squeeze the triceps, then return. Upper arms stay still.'),
  (null, 'Dumbbell Overhead Press', 'Shoulders', 'Dumbbell',
   'Seated or standing, dumbbells at shoulder height, palms forward. Press overhead until arms are nearly straight, then lower under control. Brace the core, avoid arching the lower back.'),
  (null, 'Front to Lateral Raise', 'Shoulders', 'Dumbbell',
   'Raise both arms straight in front to shoulder height, lower, then raise out to the sides to shoulder height. Slight elbow bend, no swinging. Front and side delts.'),
  (null, 'Cable Chest Flys', 'Chest', 'Cable',
   'Stand between two cable stations, a handle in each hand, slight elbow bend. Bring the handles together in front of the chest in a wide arc, squeeze, then return slowly. Constant cable tension.'),
  (null, 'Cable Tricep Extension', 'Triceps', 'Cable',
   'Face the machine, attachment set high, elbows bent and tucked. Push down by straightening the arms fully, squeeze the triceps, then return under control. Upper arms pinned.'),
  (null, 'Hanging Leg Raises', 'Core', 'Bodyweight',
   'Hang from a pull-up bar, arms extended. Keeping legs straight (or bent for easier), raise them to about hip height or higher, then lower slowly without swinging. Lower abs and hip flexors.'),
  (null, 'Plank', 'Core', 'Bodyweight',
   'Forearms and toes on the floor, body in a straight line from head to heels. Brace the core and hold without letting the hips sag or pike.'),
  (null, 'Russian Twist', 'Core', 'Bodyweight',
   'Sit with knees bent and heels light on the floor, lean back slightly. Rotate the torso side to side, tapping the floor by each hip. Add a weight for difficulty.'),
  (null, 'Leg Raise', 'Core', 'Bodyweight',
   'Lie on your back, legs straight. Raise them to vertical keeping the lower back pressed down, then lower slowly without letting the heels touch.'),
  (null, 'Bird Dog', 'Core', 'Bodyweight',
   'On hands and knees, extend the opposite arm and leg until level with the torso, hold briefly, then switch. Keep the hips square and core braced.'),
  (null, 'Hollow Body Hold', 'Core', 'Bodyweight',
   'Lie on your back, press the lower back into the floor, then lift the shoulders and legs into a shallow banana shape. Hold while breathing.'),
  (null, 'Side Plank', 'Core', 'Bodyweight',
   'On one forearm and the side of the foot, lift the hips so the body is a straight line. Hold, then switch sides.'),
  (null, 'Sit Ups', 'Core', 'Bodyweight',
   'Lie on your back, knees bent. Curl all the way up to a seated position then lower under control.')
) as v(user_id, name, muscle_group, equipment, description)
where not exists (
  select 1 from public.exercises e where e.user_id is null and e.name = v.name
);

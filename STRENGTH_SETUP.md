# Workout Logger — setup

The Workout Logger lives at **`strength.html`** on your GitHub Pages site and
uses a free [Supabase](https://supabase.com) project (`strength-log`) for login
and data, so your history syncs across every device behind an email/password
login.

The Supabase project and keys are already wired in (see `strength-config.js`).
If you ever rebuild the database, re-run the schema below.

## Database

In Supabase: **SQL Editor → New query**, paste all of
[`strength-schema.sql`](strength-schema.sql), and **Run**. It:

- drops the old v1 tables (`sessions`, `exercise_sets`) if present — they were
  empty placeholders,
- creates the v2 model: `profiles`, `exercises`, `templates`,
  `template_exercises`, `sessions`, `set_logs`,
- enables **Row Level Security** so every row is visible only to its owner
  (built-in seed exercises, `user_id = NULL`, are readable by everyone),
- seeds the built-in exercise library.

Running it shows a "destructive operations" warning because it `drop`s the old
tables and replaces policies — expected and safe on the empty project.

## Data model (adapted to Supabase)

The build-guide schema assumed a generic `users` table with `BIGINT` ids. Here
it's mapped to the Supabase reality:

- `user_id` is **`uuid`** referencing `auth.users(id)`, default `auth.uid()`.
- Access is enforced by **RLS policies**, not an app server.
- `weight_unit` (lb/kg) is a per-user setting on the **`profiles`** table.
- Every user-owned table carries `user_id` so RLS stays simple and fast.

Everything else from the guide is preserved: text ranges for targets, `weight`
as `NUMERIC(6,2)`, `finished_at IS NULL` = in-progress (powers resume), the
unique constraints that make autosave idempotent, and the indexes.

## Login

1. Open `strength.html`, click **"Need an account? Sign up"**, enter email +
   password. Supabase emails a confirmation link by default — click it, then
   sign in.
2. **To keep it private to you:** in Supabase → **Authentication → Providers →
   Email**, turn **off** "Allow new users to sign up" after your account exists.

## Features

- **Workouts** — your templates as cards (name, phase, exercise count). Start a
  template or a freeform session. Create/edit templates (sections, targets,
  reorder). On first login, two starter templates are created from the seed
  library.
- **Active session** — exercises grouped by section, each with set rows
  (weight + reps steppers, tap-to-type, large done checkbox). Shows the
  "last time" value inline, marks a PR with ▲, autosaves every change, and
  resumes exactly where you left off if the tab closes. Optional rest timer
  from the target rest.
- **History** — finished sessions by month with a one-line summary; tap for a
  read-only detail.
- **Progress** — per exercise: best/last/sessions stats, a top-set-weight line
  chart, a volume chart, and the raw history.
- **Exercises** — searchable library grouped by muscle group, with an
  "Add exercise" form for custom movements.
- **Settings** (⚙️) — switch weight unit (lb/kg) and sign out.

## Note on starter data

The seed library is the guide's 7 exercises plus common core moves. The two
starter templates ("Full Body Split", "Upper / Core Split") use those. Lower-
body exercises aren't seeded yet — add them in the **Exercises** tab and build
your own splits with the template editor.

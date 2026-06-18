# Strength Log — setup (≈5 minutes, one time)

Your training log lives at **`strength.html`** on your existing GitHub Pages
site. It uses a free [Supabase](https://supabase.com) project for login and
data storage, so your history syncs across every device behind a real
email/password login.

## 1. Create a free Supabase project
1. Go to <https://supabase.com> → **Start your project** → sign in with GitHub.
2. **New project** → give it a name (e.g. `strength-log`), set a database
   password (save it somewhere), pick a region near you, **Create**.
3. Wait ~1 minute for it to provision.

## 2. Create the database tables
1. In the project, open **SQL Editor** → **New query**.
2. Copy the entire contents of [`strength-schema.sql`](strength-schema.sql),
   paste it in, and click **Run**. You should see "Success".

## 3. Plug in your keys
1. In Supabase, open **Project Settings → API**.
2. Copy two values:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon / public** API key (a long string)
3. Open [`strength-config.js`](strength-config.js) and paste them in:
   ```js
   window.STRENGTH_CONFIG = {
     SUPABASE_URL: "https://abcd1234.supabase.co",
     SUPABASE_ANON_KEY: "eyJ...your-anon-key..."
   };
   ```
   The anon key is **safe to commit publicly** — Row Level Security (set up by
   the schema) means it can only ever read/write rows owned by the logged-in
   user.
4. Commit and push the change. GitHub Pages redeploys automatically.

## 4. Create your login
You want this limited to just you. Two options:

- **Easiest:** open `strength.html`, click **"Need an account? Sign up"**,
  enter your email + a password. (By default Supabase emails a confirmation
  link — click it, then sign in.)
- **Or** create the user directly in Supabase: **Authentication → Users →
  Add user**.

**To keep it private to you:** in Supabase go to **Authentication → Providers
→ Email** and turn **off** "Allow new users to sign up" after your account
exists. From then on, only you can log in.

## Done
Visit `…/strength.html`, sign in, and start logging. Features:
- **Log Session** — date/time (defaults to now), a 1–5 star session rating,
  any number of exercises with weight / reps / set number, and notes.
- **History** — every past session, newest first, with date, timestamp,
  rating, and all lifts.
- **By Exercise** — pick a lift to see its full weight history, your best
  weight (PR), and when you last did it.

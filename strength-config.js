// ---------------------------------------------------------------------------
// Strength Log – Supabase configuration
// ---------------------------------------------------------------------------
// Paste your Supabase project's URL and PUBLIC anon key below.
// Find them in your Supabase dashboard under: Project Settings → API.
//
// The anon key is safe to commit publicly — your data is protected by
// Row Level Security (see strength-schema.sql), so it only ever exposes
// rows that belong to the logged-in user.
// ---------------------------------------------------------------------------
window.STRENGTH_CONFIG = {
  SUPABASE_URL: "YOUR_SUPABASE_URL",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY"
};

// Supabase connection, supplied at build time via Vite env vars.
// Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Netlify → Site settings →
// Environment variables (and in a local .env for `npm run dev`). The anon key is
// public by design — Row Level Security in schema.sql is what actually protects data.
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// True only when both values are present and look real (guards a half-wired deploy
// from rendering as a broken login screen).
export const configured =
  /^https?:\/\/.+\.supabase\.co/.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20;

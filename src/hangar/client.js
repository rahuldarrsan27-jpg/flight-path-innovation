import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, configured } from './config.js';

// One client for the module. Null when the env vars aren't set, so the pages can
// show a "connect your database" notice instead of throwing. Session is persisted
// in localStorage by supabase-js (default), so a returning device stays signed in.
export const sb = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

/**
 * Supabase client for server (Node / Vercel).
 * Set SUPABASE_URL and SUPABASE_ANON_KEY in env.
 */

import { createClient } from '@supabase/supabase-js';

let client = null;

export function getSupabase() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
    client = createClient(url, key);
  }
  return client;
}

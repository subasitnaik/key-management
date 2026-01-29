/**
 * Supabase client. Use project URL + anon key (or service_role key for full access).
 * Tables are created by running schema.pg.sql in Supabase SQL Editor — we don't run schema here.
 */

import { createClient } from '@supabase/supabase-js';

let client = null;

export function getSupabase() {
  if (!client) {
    const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
    if (!url || !key) {
      throw new Error(
        'Set SUPABASE_URL and SUPABASE_ANON_KEY in .env (or SUPABASE_SERVICE_ROLE_KEY for full access). See .env.example.'
      );
    }
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}

/**
 * Telegraf session store backed by Supabase telegram_sessions table.
 */

import { getSupabase } from '../db/supabase.js';

export function createSupabaseSessionStore() {
  return {
    get: async (key) => {
      const { data } = await getSupabase().from('telegram_sessions').select('value').eq('key', key).maybeSingle();
      return data?.value ?? undefined;
    },
    set: async (key, value) => {
      await getSupabase().from('telegram_sessions').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    },
    delete: async (key) => {
      await getSupabase().from('telegram_sessions').delete().eq('key', key);
    },
  };
}

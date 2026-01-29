/**
 * Telegraf session store backed by Supabase (telegram_sessions table).
 * Used for webhook mode so session persists across serverless invocations.
 */

import { getSupabase } from '../db/supabase.js';

export function createSupabaseSessionStore() {
  return {
    get: async (key) => {
      const { data, error } = await getSupabase()
        .from('telegram_sessions')
        .select('value')
        .eq('key', key)
        .maybeSingle();
      if (error) throw error;
      return data?.value ?? undefined;
    },
    set: async (key, value) => {
      const { error } = await getSupabase()
        .from('telegram_sessions')
        .upsert({ key, value: value ?? {}, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
    },
    delete: async (key) => {
      await getSupabase().from('telegram_sessions').delete().eq('key', key);
    },
  };
}

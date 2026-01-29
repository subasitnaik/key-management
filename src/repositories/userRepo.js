import { getSupabase } from '../db/supabase.js';

export async function findOrCreateUserByTelegram(telegram_user_id, telegram_username) {
  const supabase = getSupabase();
  const { data: existing } = await supabase.from('users').select('*').eq('telegram_user_id', String(telegram_user_id)).maybeSingle();
  if (existing) {
    if (telegram_username && existing.telegram_username !== telegram_username) {
      await supabase.from('users').update({ telegram_username }).eq('id', existing.id);
    }
    return existing;
  }
  const { data: created, error } = await supabase.from('users').insert({ telegram_user_id: String(telegram_user_id), telegram_username: telegram_username || null }).select().single();
  if (error) throw error;
  return created;
}

export async function getUserById(id) {
  const { data } = await getSupabase().from('users').select('*').eq('id', id).maybeSingle();
  return data;
}

export async function getUserByTelegramId(telegram_user_id) {
  const { data } = await getSupabase().from('users').select('*').eq('telegram_user_id', String(telegram_user_id)).maybeSingle();
  return data;
}

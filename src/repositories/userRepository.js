/**
 * User (end buyer) repository.
 */

import { getSupabase } from '../db/supabase.js';

export async function findByTelegramId(telegramUserId) {
  const { data, error } = await getSupabase()
    .from('users')
    .select('*')
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findOrCreate(telegramUserId, telegramUsername) {
  let user = await findByTelegramId(telegramUserId);
  if (!user) {
    const { error } = await getSupabase()
      .from('users')
      .insert({ telegram_user_id: telegramUserId, telegram_username: telegramUsername || null });
    if (error) throw error;
    user = await findByTelegramId(telegramUserId);
  } else if (telegramUsername && user.telegram_username !== telegramUsername) {
    const { error } = await getSupabase()
      .from('users')
      .update({ telegram_username: telegramUsername })
      .eq('id', user.id);
    if (error) throw error;
    user = await findByTelegramId(telegramUserId);
  }
  return user;
}

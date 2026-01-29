/**
 * Seller repository.
 */

import { getSupabase } from '../db/supabase.js';

export async function findBySlug(slug) {
  const { data, error } = await getSupabase()
    .from('sellers')
    .select('*')
    .eq('slug', slug)
    .eq('suspended', 0)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findByPrivateGroupChatId(chatId) {
  const { data, error } = await getSupabase()
    .from('sellers')
    .select('*')
    .eq('private_group_chat_id', String(chatId))
    .eq('suspended', 0)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findById(id) {
  const { data, error } = await getSupabase()
    .from('sellers')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findByUsername(username) {
  const { data, error } = await getSupabase()
    .from('sellers')
    .select('*')
    .eq('username', username)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function create(seller) {
  const { data, error } = await getSupabase()
    .from('sellers')
    .insert({
      slug: seller.slug,
      username: seller.username,
      password_hash: seller.passwordHash,
      telegram_username: seller.telegramUsername || null,
      telegram_bot_token: seller.telegramBotToken || null,
      ccpu: seller.ccpu ?? 30,
      query_channel_enabled: seller.queryChannelEnabled ? 1 : 0,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data?.id;
}

export async function updateCredits(sellerId, amount, reason, createdBy) {
  const { data: seller, error: e1 } = await getSupabase()
    .from('sellers')
    .select('credits_balance')
    .eq('id', sellerId)
    .single();
  if (e1 || !seller) return null;
  const newBalance = seller.credits_balance + amount;
  const { error: e2 } = await getSupabase()
    .from('sellers')
    .update({ credits_balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', sellerId);
  if (e2) throw e2;
  const { error: e3 } = await getSupabase()
    .from('credit_ledger')
    .insert({ seller_id: sellerId, amount, reason, created_by: createdBy });
  if (e3) throw e3;
  return newBalance;
}

export async function setMaintenanceMode(sellerId, enabled) {
  const { error } = await getSupabase()
    .from('sellers')
    .update({ maintenance_mode: enabled ? 1 : 0, updated_at: new Date().toISOString() })
    .eq('id', sellerId);
  if (error) throw error;
}

export async function update(sellerId, updates) {
  const seller = await findById(sellerId);
  if (!seller) return null;
  const payload = {
    telegram_username: updates.telegramUsername !== undefined ? updates.telegramUsername : seller.telegram_username,
    telegram_bot_token: updates.telegramBotToken !== undefined ? updates.telegramBotToken : seller.telegram_bot_token,
    ccpu: updates.ccpu !== undefined ? updates.ccpu : seller.ccpu,
    query_channel_enabled: updates.queryChannelEnabled !== undefined ? (updates.queryChannelEnabled ? 1 : 0) : seller.query_channel_enabled,
    updated_at: new Date().toISOString(),
  };
  const { error } = await getSupabase().from('sellers').update(payload).eq('id', sellerId);
  if (error) throw error;
  return findById(sellerId);
}

export async function getAll() {
  const { data, error } = await getSupabase().from('sellers').select('*').order('id');
  if (error) throw error;
  return data || [];
}

export async function setSuspended(sellerId, suspended) {
  const { error } = await getSupabase()
    .from('sellers')
    .update({ suspended: suspended ? 1 : 0, updated_at: new Date().toISOString() })
    .eq('id', sellerId);
  if (error) throw error;
}

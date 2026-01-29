/**
 * Blocked user repository.
 */

import { getSupabase } from '../db/supabase.js';

export async function isBlocked(userId, sellerId) {
  const { data, error } = await getSupabase()
    .from('blocked_users')
    .select('id')
    .eq('user_id', userId)
    .eq('seller_id', sellerId)
    .is('unblocked_at', null)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function block(userId, sellerId) {
  const { error } = await getSupabase().from('blocked_users').insert({ user_id: userId, seller_id: sellerId });
  if (error) throw error;
}

export async function unblock(userId, sellerId) {
  const { error } = await getSupabase()
    .from('blocked_users')
    .update({ unblocked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('seller_id', sellerId)
    .is('unblocked_at', null);
  if (error) throw error;
}

export async function unblockAllBySeller(sellerId) {
  const { error } = await getSupabase()
    .from('blocked_users')
    .update({ unblocked_at: new Date().toISOString() })
    .eq('seller_id', sellerId)
    .is('unblocked_at', null);
  if (error) throw error;
}

export async function findBlockedBySeller(sellerId) {
  const { data, error } = await getSupabase()
    .from('blocked_users')
    .select('*, users!user_id(telegram_user_id, telegram_username)')
    .eq('seller_id', sellerId)
    .is('unblocked_at', null)
    .order('blocked_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((bu) => ({
    ...bu,
    telegram_user_id: bu.users?.telegram_user_id,
    telegram_username: bu.users?.telegram_username,
  }));
}

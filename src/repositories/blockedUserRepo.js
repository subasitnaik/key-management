/**
 * Blocked users: isBlocked, blockUser, getBlockedBySeller, unblockUser, unblockAllBySeller.
 */

import { getSupabase } from '../db/supabase.js';

export async function isBlocked(userId, sellerId) {
  const { data } = await getSupabase()
    .from('blocked_users')
    .select('id')
    .eq('user_id', userId)
    .eq('seller_id', sellerId)
    .is('unblocked_at', null)
    .maybeSingle();
  return !!data;
}

export async function blockUser(userId, sellerId) {
  const { error } = await getSupabase()
    .from('blocked_users')
    .insert({ user_id: userId, seller_id: sellerId });
  if (error) throw error;
}

export async function getBlockedBySeller(sellerId) {
  const { data: rows, error } = await getSupabase()
    .from('blocked_users')
    .select('id, user_id, blocked_at')
    .eq('seller_id', sellerId)
    .is('unblocked_at', null)
    .order('blocked_at', { ascending: false });
  if (error) throw error;
  if (!rows?.length) return [];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: users } = await getSupabase()
    .from('users')
    .select('id, telegram_user_id, telegram_username')
    .in('id', userIds);
  const userMap = Object.fromEntries((users || []).map((u) => [u.id, u]));
  return rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    blocked_at: row.blocked_at,
    telegram_user_id: userMap[row.user_id]?.telegram_user_id,
    telegram_username: userMap[row.user_id]?.telegram_username || '—',
  }));
}

export async function unblockUser(userId, sellerId) {
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

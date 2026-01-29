import { getSupabase } from '../db/supabase.js';

export async function isBlocked(userId, sellerId) {
  const { data } = await getSupabase().from('blocked_users').select('id').eq('user_id', userId).eq('seller_id', sellerId).is('unblocked_at', null).maybeSingle();
  return !!data;
}

export async function blockUser(userId, sellerId) {
  const { data, error } = await getSupabase().from('blocked_users').insert({ user_id: userId, seller_id: sellerId }).select().single();
  if (error) throw error;
  return data;
}

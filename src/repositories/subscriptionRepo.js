/**
 * Subscription repository: keys/subscriptions for sellers.
 */

import { getSupabase } from '../db/supabase.js';

export async function getSubscriptionsBySeller(sellerId) {
  if (!sellerId) return [];
  const { data, error } = await getSupabase()
    .from('subscriptions')
    .select('id, key, uuid, max_devices, expires_at, maintenance_paused_at, created_at')
    .eq('seller_id', parseInt(sellerId, 10))
    .order('created_at', { ascending: false });
  if (error) {
    console.error('getSubscriptionsBySeller error:', error);
    return [];
  }
  return data || [];
}

export async function getActiveSubscriptionsCount(sellerId) {
  if (!sellerId) return 0;
  const now = new Date().toISOString();
  const { count, error } = await getSupabase()
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', parseInt(sellerId, 10))
    .gt('expires_at', now);
  if (error) {
    console.error('getActiveSubscriptionsCount error:', error);
    return 0;
  }
  return count ?? 0;
}

export async function createSubscription({ user_id, seller_id, key, max_devices, expires_at }) {
  const { data, error } = await getSupabase()
    .from('subscriptions')
    .insert({
      user_id,
      seller_id: parseInt(seller_id, 10),
      key: String(key).trim(),
      max_devices: Math.max(1, parseInt(max_devices, 10) || 1),
      expires_at: expires_at || new Date(Date.now() + 86400000).toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSubscription(id, sellerId) {
  const { error } = await getSupabase()
    .from('subscriptions')
    .delete()
    .eq('id', parseInt(id, 10))
    .eq('seller_id', parseInt(sellerId, 10));
  if (error) throw error;
}

export async function resetSubscriptionDevices(id, sellerId) {
  const { data, error } = await getSupabase()
    .from('subscriptions')
    .update({ uuid: '' })
    .eq('id', parseInt(id, 10))
    .eq('seller_id', parseInt(sellerId, 10))
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateSubscription(id, sellerId, updates) {
  const allowed = ['max_devices', 'expires_at'];
  const safe = {};
  for (const k of allowed) {
    if (updates[k] !== undefined) safe[k] = updates[k];
  }
  if (Object.keys(safe).length === 0) return null;
  const { data, error } = await getSupabase()
    .from('subscriptions')
    .update(safe)
    .eq('id', parseInt(id, 10))
    .eq('seller_id', parseInt(sellerId, 10))
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteExpiredBySeller(sellerId) {
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from('subscriptions')
    .delete()
    .eq('seller_id', parseInt(sellerId, 10))
    .lt('expires_at', now)
    .select('id');
  if (error) throw error;
  return (data || []).length;
}

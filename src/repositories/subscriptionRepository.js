/**
 * Subscription and key repository.
 */

import { getSupabase } from '../db/supabase.js';

export async function findByKey(key, sellerId) {
  const { data, error } = await getSupabase()
    .from('subscriptions')
    .select('*, users!user_id(telegram_username)')
    .eq('key', key)
    .eq('seller_id', sellerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, user_username: data.users?.telegram_username };
}

export async function findByUserAndSeller(userId, sellerId) {
  const { data, error } = await getSupabase()
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('seller_id', sellerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function create(subscription) {
  const maxDevices = subscription.maxDevices ?? 1;
  const { data, error } = await getSupabase()
    .from('subscriptions')
    .insert({
      user_id: subscription.userId,
      seller_id: subscription.sellerId,
      key: subscription.key,
      expires_at: subscription.expiresAt,
      max_devices: maxDevices,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data?.id;
}

export async function updateUuid(subscriptionId, uuid) {
  const { error } = await getSupabase().from('subscriptions').update({ uuid }).eq('id', subscriptionId);
  if (error) throw error;
}

export async function addUuidToList(subscriptionId, uuid) {
  const { data: sub, error: e1 } = await getSupabase()
    .from('subscriptions')
    .select('uuid')
    .eq('id', subscriptionId)
    .single();
  if (e1 || !sub) return null;
  const list = (sub.uuid || '').split(',').filter(Boolean);
  if (list.includes(uuid)) return list;
  list.push(uuid);
  const { error: e2 } = await getSupabase()
    .from('subscriptions')
    .update({ uuid: list.join(',') })
    .eq('id', subscriptionId);
  if (e2) throw e2;
  return list;
}

export async function extendExpiry(subscriptionId, newExpiresAt) {
  const { error } = await getSupabase()
    .from('subscriptions')
    .update({ expires_at: newExpiresAt })
    .eq('id', subscriptionId);
  if (error) throw error;
}

export async function setMaintenancePaused(subscriptionId, pausedAt) {
  const { error } = await getSupabase()
    .from('subscriptions')
    .update({ maintenance_paused_at: pausedAt })
    .eq('id', subscriptionId);
  if (error) throw error;
}

export async function clearMaintenancePaused(subscriptionId, additionalDays) {
  const { data: sub, error: e1 } = await getSupabase()
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single();
  if (e1 || !sub) return null;
  const baseExpiry = new Date(sub.maintenance_paused_at || sub.expires_at);
  const newExpiry = new Date(baseExpiry);
  newExpiry.setDate(newExpiry.getDate() + additionalDays);
  const { error: e2 } = await getSupabase()
    .from('subscriptions')
    .update({ maintenance_paused_at: null, expires_at: newExpiry.toISOString().slice(0, 19).replace('T', ' ') })
    .eq('id', subscriptionId);
  if (e2) throw e2;
  return newExpiry;
}

export async function deleteBySeller(sellerId) {
  const { error } = await getSupabase().from('subscriptions').delete().eq('seller_id', sellerId);
  if (error) throw error;
}

export async function hasActiveSubscription(userId, sellerId) {
  const sub = await findByUserAndSeller(userId, sellerId);
  if (!sub) return false;
  return new Date(sub.expires_at) > new Date();
}

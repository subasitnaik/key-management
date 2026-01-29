import { getSupabase } from '../db/supabase.js';

/**
 * Validate key for /connect. Lazy expiry: check now, respect maintenance_paused_at.
 * Returns { status: 'ok'|'expired'|'maintenance'|'notfound' }.
 */
export async function validateKeyForConnect(key, sellerId) {
  const supabase = getSupabase();
  let q = supabase.from('subscriptions').select('*').eq('key', key);
  if (sellerId != null) q = q.eq('seller_id', sellerId);
  const { data: sub, error } = await q.maybeSingle();
  if (error) throw error;
  if (!sub) return { status: 'notfound' };

  const { data: seller } = await supabase.from('sellers').select('maintenance_mode, suspended').eq('id', sub.seller_id).maybeSingle();
  if (seller?.suspended) return { status: 'notfound' };

  let expiresAt = sub.expires_at ? new Date(sub.expires_at) : null;
  if (sub.maintenance_paused_at && seller?.maintenance_mode) {
    const pausedAt = new Date(sub.maintenance_paused_at);
    const pauseDurationMs = Date.now() - pausedAt.getTime();
    expiresAt = expiresAt ? new Date(expiresAt.getTime() + pauseDurationMs) : null;
  }

  if (expiresAt && expiresAt.getTime() <= Date.now()) return { status: 'expired' };
  if (seller?.maintenance_mode) return { status: 'maintenance' };
  return { status: 'ok' };
}

export async function getSubscriptionByKey(key, sellerId) {
  const supabase = getSupabase();
  let q = supabase.from('subscriptions').select('*').eq('key', key);
  if (sellerId != null) q = q.eq('seller_id', sellerId);
  const { data } = await q.maybeSingle();
  return data;
}

export async function getSubscriptionsBySeller(sellerId) {
  const { data, error } = await getSupabase().from('subscriptions').select('*').eq('seller_id', sellerId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createSubscription(row) {
  const { data, error } = await getSupabase().from('subscriptions').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateSubscription(id, updates) {
  const { data, error } = await getSupabase().from('subscriptions').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

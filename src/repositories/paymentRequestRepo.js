import { getSupabase } from '../db/supabase.js';

export async function createPaymentRequest(row) {
  const { data, error } = await getSupabase().from('payment_requests').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function getPaymentRequestById(id) {
  const { data } = await getSupabase().from('payment_requests').select('*').eq('id', id).maybeSingle();
  return data;
}

export async function getPendingBySeller(sellerId) {
  const { data, error } = await getSupabase().from('payment_requests').select('*').eq('seller_id', sellerId).eq('status', 'pending').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updatePaymentRequest(id, updates) {
  const { data, error } = await getSupabase().from('payment_requests').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

/** Sum of plan prices for accepted payment requests only (auto-generated keys via bot; excludes manual keys). */
export async function getEarnedAmountBySeller(sellerId) {
  const { data: requests, error } = await getSupabase()
    .from('payment_requests')
    .select('plan_id')
    .eq('seller_id', sellerId)
    .eq('status', 'accepted');
  if (error) throw error;
  if (!requests?.length) return 0;
  const planIds = [...new Set(requests.map((r) => r.plan_id))];
  const { data: plans, error: plansError } = await getSupabase()
    .from('plans')
    .select('id, price')
    .in('id', planIds);
  if (plansError) throw plansError;
  const priceByPlan = Object.fromEntries((plans || []).map((p) => [p.id, p.price ?? 0]));
  return requests.reduce((sum, r) => sum + (priceByPlan[r.plan_id] ?? 0), 0);
}

/**
 * Payment requests: create, get by id, update; earned amount by seller (this cycle).
 */

import { getSupabase } from '../db/supabase.js';

export async function createPaymentRequest(row) {
  const { data, error } = await getSupabase()
    .from('payment_requests')
    .insert(row)
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

export async function getPaymentRequestById(id) {
  const { data, error } = await getSupabase()
    .from('payment_requests')
    .select('*')
    .eq('id', id)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updatePaymentRequest(id, updates) {
  const { error } = await getSupabase()
    .from('payment_requests')
    .update(updates)
    .eq('id', id);
  if (error) {
    // If accepted_at column doesn't exist yet (migration not run), retry without it
    if (updates.accepted_at !== undefined) {
      const { accepted_at: _, ...rest } = updates;
      const { error: err2 } = await getSupabase()
        .from('payment_requests')
        .update(rest)
        .eq('id', id);
      if (err2) throw err2;
      return;
    }
    throw error;
  }
}

/**
 * Sum of plan prices for accepted payment requests in the current cycle.
 * Cycle = since seller.cycle_started_at; if cycle_started_at is null, all time (backward compatible).
 * If DB columns cycle_started_at/accepted_at are missing (migration not run), falls back to all-time sum.
 */
export async function getEarnedAmountBySeller(sellerId) {
  try {
    const seller = await getSupabase()
      .from('sellers')
      .select('cycle_started_at')
      .eq('id', sellerId)
      .single()
      .then((r) => r.data);
    const cycleStart = seller?.cycle_started_at || null;

    const { data: list, error } = await getSupabase()
      .from('payment_requests')
      .select('id, plan_id, accepted_at')
      .eq('seller_id', sellerId)
      .eq('status', 'accepted');
    if (error) throw error;
    if (!list?.length) return 0;

    const inCycle = cycleStart
      ? list.filter((pr) => pr.accepted_at && new Date(pr.accepted_at) >= new Date(cycleStart))
      : list;
    if (!inCycle.length) return 0;

    const planIds = [...new Set(inCycle.map((pr) => pr.plan_id))];
    const { data: plans, error: plansErr } = await getSupabase()
      .from('plans')
      .select('id, price')
      .in('id', planIds);
    if (plansErr) throw plansErr;
    const priceByPlan = Object.fromEntries((plans || []).map((p) => [p.id, p.price]));

    let sum = 0;
    for (const pr of inCycle) {
      const price = priceByPlan[pr.plan_id];
      if (price != null) sum += Number(price);
    }
    return sum;
  } catch (err) {
    // Fallback when cycle_started_at or accepted_at columns don't exist yet (migration not run)
    const { data: list, error } = await getSupabase()
      .from('payment_requests')
      .select('id, plan_id')
      .eq('seller_id', sellerId)
      .eq('status', 'accepted');
    if (error) throw error;
    if (!list?.length) return 0;
    const planIds = [...new Set(list.map((pr) => pr.plan_id))];
    const { data: plans, error: plansErr } = await getSupabase()
      .from('plans')
      .select('id, price')
      .in('id', planIds);
    if (plansErr) throw plansErr;
    const priceByPlan = Object.fromEntries((plans || []).map((p) => [p.id, p.price]));
    return list.reduce((s, pr) => s + (Number(priceByPlan[pr.plan_id]) || 0), 0);
  }
}

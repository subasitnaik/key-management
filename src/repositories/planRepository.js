/**
 * Plan repository.
 */

import { getSupabase } from '../db/supabase.js';

export async function findBySeller(sellerId) {
  const { data, error } = await getSupabase()
    .from('plans')
    .select('*')
    .eq('seller_id', sellerId)
    .order('days');
  if (error) throw error;
  return data || [];
}

export async function findById(planId) {
  const { data, error } = await getSupabase()
    .from('plans')
    .select('*')
    .eq('id', planId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function create(plan) {
  const { data, error } = await getSupabase()
    .from('plans')
    .insert({ seller_id: plan.sellerId, name: plan.name, days: plan.days, price: plan.price })
    .select('id')
    .single();
  if (error) throw error;
  return data?.id;
}

export async function update(planId, sellerId, data) {
  const plan = await getSupabase().from('plans').select('*').eq('id', planId).eq('seller_id', sellerId).maybeSingle();
  if (plan.error || !plan.data) return false;
  const { error } = await getSupabase()
    .from('plans')
    .update({ name: data.name, days: data.days, price: data.price })
    .eq('id', planId);
  if (error) throw error;
  return true;
}

export async function remove(planId, sellerId) {
  const plan = await getSupabase().from('plans').select('*').eq('id', planId).eq('seller_id', sellerId).maybeSingle();
  if (plan.error || !plan.data) return false;
  const inUse = await getSupabase().from('payment_requests').select('id').eq('plan_id', planId).limit(1).maybeSingle();
  if (inUse.data) return false;
  const { error } = await getSupabase().from('plans').delete().eq('id', planId);
  if (error) throw error;
  return true;
}

import { getSupabase } from '../db/supabase.js';

export async function getPlansBySeller(sellerId) {
  const { data, error } = await getSupabase().from('plans').select('*').eq('seller_id', sellerId).order('days');
  if (error) throw error;
  return data || [];
}

export async function getPlanById(id) {
  const { data } = await getSupabase().from('plans').select('*').eq('id', id).maybeSingle();
  return data;
}

export async function createPlan(row) {
  const { data, error } = await getSupabase().from('plans').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updatePlan(id, updates) {
  const { data, error } = await getSupabase().from('plans').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deletePlan(id) {
  const { error } = await getSupabase().from('plans').delete().eq('id', id);
  if (error) throw error;
}

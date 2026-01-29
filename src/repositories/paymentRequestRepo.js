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

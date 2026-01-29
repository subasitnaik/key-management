import { getSupabase } from '../db/supabase.js';

export async function addLedgerEntry(sellerId, amount, reason, createdBy) {
  const { data, error } = await getSupabase().from('credit_ledger').insert({ seller_id: sellerId, amount, reason, created_by: createdBy }).select().single();
  if (error) throw error;
  return data;
}

export async function getLedgerBySeller(sellerId, limit = 50) {
  const { data, error } = await getSupabase().from('credit_ledger').select('*').eq('seller_id', sellerId).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

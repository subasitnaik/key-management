/**
 * Sellers: verify (login), get by id, update, getAll, create.
 */

import bcrypt from 'bcryptjs';
import { getSupabase } from '../db/supabase.js';

export async function verifySeller(username, password) {
  if (!username || !password) return null;
  const { data: seller, error } = await getSupabase()
    .from('sellers')
    .select('*')
    .eq('username', String(username).trim())
    .eq('suspended', 0)
    .maybeSingle();
  if (error || !seller) return null;
  const ok = await bcrypt.compare(String(password), seller.password_hash || '');
  return ok ? seller : null;
}

export async function getSellerById(id) {
  const { data, error } = await getSupabase()
    .from('sellers')
    .select('*')
    .eq('id', id)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updateSeller(id, updates) {
  const payload = { ...updates, updated_at: new Date().toISOString() };
  const { error } = await getSupabase()
    .from('sellers')
    .update(payload)
    .eq('id', id);
  if (error) {
    // If cycle_started_at (or other new column) doesn't exist yet (migration not run), retry without it
    if (payload.cycle_started_at !== undefined) {
      const { cycle_started_at: _, ...rest } = payload;
      const { error: err2 } = await getSupabase()
        .from('sellers')
        .update(rest)
        .eq('id', id);
      if (err2) throw err2;
      return;
    }
    throw error;
  }
}

export async function getAllSellers() {
  const { data, error } = await getSupabase()
    .from('sellers')
    .select('*')
    .order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createSeller(row) {
  const { data, error } = await getSupabase()
    .from('sellers')
    .insert(row)
    .select('id, slug, username')
    .single();
  if (error) throw error;
  return data;
}

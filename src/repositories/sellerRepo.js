import { getSupabase } from '../db/supabase.js';
import bcrypt from 'bcryptjs';

export async function getSellerBySlug(slug) {
  const { data } = await getSupabase().from('sellers').select('*').eq('slug', slug).eq('suspended', 0).maybeSingle();
  return data;
}

export async function getSellerById(id) {
  const { data } = await getSupabase().from('sellers').select('*').eq('id', id).maybeSingle();
  return data;
}

export async function updateSeller(id, updates) {
  const { data, error } = await getSupabase().from('sellers').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function getAllSellers() {
  const { data, error } = await getSupabase().from('sellers').select('*').order('id');
  if (error) throw error;
  return data || [];
}

export async function createSeller(row) {
  const { data, error } = await getSupabase().from('sellers').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function verifySeller(username, password) {
  const { data: seller } = await getSupabase().from('sellers').select('*').eq('username', username).eq('suspended', 0).maybeSingle();
  if (!seller || !bcrypt.compareSync(password, seller.password_hash)) return null;
  return seller;
}

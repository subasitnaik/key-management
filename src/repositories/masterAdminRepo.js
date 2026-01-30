import { getSupabase } from '../db/supabase.js';
import bcrypt from 'bcryptjs';

export async function findMasterAdminByUsername(username) {
  const { data } = await getSupabase().from('master_admin').select('*').eq('username', username).maybeSingle();
  return data;
}

export async function getMasterAdminById(id) {
  const { data } = await getSupabase().from('master_admin').select('id, username').eq('id', id).maybeSingle();
  return data;
}

export async function verifyMasterAdmin(username, password) {
  const admin = await findMasterAdminByUsername(username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) return null;
  return admin;
}

export async function updateMasterAdminCredentials(id, updates) {
  const supabase = getSupabase();
  const { username, password_hash } = updates;
  const row = {};
  if (username !== undefined) row.username = username;
  if (password_hash !== undefined) row.password_hash = password_hash;
  if (Object.keys(row).length === 0) return null;
  const { data, error } = await supabase.from('master_admin').update(row).eq('id', id).select('id, username').single();
  if (error) throw error;
  return data;
}

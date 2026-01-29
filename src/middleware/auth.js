/**
 * Auth middleware for Seller and Master Admin panels.
 */

import bcrypt from 'bcryptjs';
import * as sellerRepository from '../repositories/sellerRepository.js';
import * as masterAdminRepository from '../repositories/masterAdminRepository.js';

export function requireSeller(req, res, next) {
  if (!req.session?.sellerId) {
    return res.redirect('/panel/seller/login');
  }
  next();
}

export function requireMasterAdmin(req, res, next) {
  if (!req.session?.masterAdminId) {
    return res.redirect('/panel/admin/login');
  }
  next();
}

export async function authenticateSeller(username, password) {
  const seller = await sellerRepository.findByUsername(username);
  if (!seller || seller.suspended) return null;
  const ok = await bcrypt.compare(password, seller.password_hash);
  return ok ? seller : null;
}

export async function authenticateMasterAdmin(username, password) {
  const admin = await masterAdminRepository.findByUsername(username);
  if (!admin) return null;
  const ok = await bcrypt.compare(password, admin.password_hash);
  return ok ? admin : null;
}

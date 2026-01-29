/**
 * Auth middleware: requireMasterAdmin (session), requireSeller (session).
 */

export function requireMasterAdmin(req, res, next) {
  if (req.session?.masterAdminId) return next();
  res.redirect('/panel/admin/login');
}

export function requireSeller(req, res, next) {
  if (req.session?.sellerId) return next();
  res.redirect('/panel/seller/login');
}

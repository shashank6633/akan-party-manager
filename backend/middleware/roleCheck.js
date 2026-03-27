/**
 * Role hierarchy: ADMIN > MANAGER > SALES > GRE
 * ADMIN has implicit access to everything.
 */
const ROLES = {
  GRE: 'GRE',
  CASHIER: 'CASHIER',
  SALES: 'SALES',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
};

/**
 * Role-based access control middleware factory.
 * Usage: router.get('/path', authenticate, roleCheck('SALES', 'MANAGER'), handler)
 *
 * @param {...string} allowedRoles - Roles that are permitted (ADMIN is always allowed)
 * @returns {Function} Express middleware
 */
function roleCheck(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. No role assigned.',
      });
    }

    const userRole = req.user.role.toUpperCase();

    // ADMIN always has access
    if (userRole === ROLES.ADMIN) {
      return next();
    }

    // Check if user's role is in the allowed list
    const allowed = allowedRoles.map((r) => r.toUpperCase());
    if (allowed.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. Required role(s): ${allowedRoles.join(', ')}. Your role: ${req.user.role}.`,
    });
  };
}

module.exports = { roleCheck, ROLES };

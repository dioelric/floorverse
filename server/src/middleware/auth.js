const jwt = require('jsonwebtoken');
const db  = require('../config/db');

// ── Verify JWT access token ──────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user data
    const [rows] = await db.query(
      'SELECT id, tenant_id, email, first_name, last_name, role, is_active FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ── Role-based guard ─────────────────────────────────────
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Insufficient permissions' });
  }
  next();
};

// ── Tenant scope guard ───────────────────────────────────
// Attaches req.tenantId for all roles.
// super_admin always passes through; other roles must have a tenant_id.
const scopeToTenant = (req, res, next) => {
  // Always populate req.tenantId from the authenticated user
  req.tenantId = req.user.tenant_id || null;

  if (req.user.role === 'super_admin') {
    // Super-admin may act on their own tenant OR any tenant (tenantId can be null
    // only if the seed hasn't been run yet — controllers that write data require it).
    return next();
  }

  if (!req.tenantId) {
    return res.status(403).json({ success: false, message: 'No tenant associated with this account' });
  }
  next();
};

module.exports = { authenticate, authorize, scopeToTenant };

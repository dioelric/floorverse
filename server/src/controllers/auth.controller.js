const bcrypt      = require('bcrypt');
const jwt         = require('jsonwebtoken');
const { randomUUID: uuid } = require('crypto');
const db          = require('../config/db');

// ── Helper: generate tokens ──────────────────────────────
const generateTokens = (userId, role, tenantId) => {
  const accessToken = jwt.sign(
    { userId, role, tenantId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  return { accessToken, refreshToken };
};

// ── POST /api/auth/register ──────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, companyName, role = 'tenant_admin' } = req.body;

    // Check email exists
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuid();

    // If registering as a business, create a tenant first
    let tenantId = null;
    if (role === 'tenant_admin' && companyName) {
      tenantId = uuid();
      const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 50)
                  + '-' + Math.random().toString(36).slice(2, 6);

      await db.query(
        `INSERT INTO tenants (id, name, slug, plan, status, trial_ends_at)
         VALUES (?, ?, ?, 'starter', 'trial', DATE_ADD(NOW(), INTERVAL 30 DAY))`,
        [tenantId, companyName, slug]
      );
    }

    await db.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [userId, tenantId, email, passwordHash, firstName, lastName, role]
    );

    const { accessToken, refreshToken } = generateTokens(userId, role, tenantId);

    // Store refresh token
    const rtExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.query(
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [uuid(), userId, refreshToken, rtExpiry]
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: { id: userId, firstName, lastName, email, role, tenantId },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/login ─────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const [rows] = await db.query(
      `SELECT u.*, t.name AS tenant_name, t.slug AS tenant_slug, t.status AS tenant_status
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email = ?`,
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = rows[0];
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Update last login
    await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const { accessToken, refreshToken } = generateTokens(user.id, user.role, user.tenant_id);

    // Delete old refresh tokens for this user, store new one
    await db.query('DELETE FROM refresh_tokens WHERE user_id = ?', [user.id]);
    const rtExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.query(
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [uuid(), user.id, refreshToken, rtExpiry]
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          role: user.role,
          tenantId: user.tenant_id,
          tenantName: user.tenant_name,
          tenantSlug: user.tenant_slug,
          avatarUrl: user.avatar_url,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/refresh ───────────────────────────────
exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const [tokenRows] = await db.query(
      'SELECT * FROM refresh_tokens WHERE token = ? AND user_id = ? AND expires_at > NOW()',
      [refreshToken, decoded.userId]
    );

    if (!tokenRows.length) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    const [userRows] = await db.query(
      'SELECT id, role, tenant_id FROM users WHERE id = ? AND is_active = 1',
      [decoded.userId]
    );

    if (!userRows.length) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const user = userRows[0];
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id, user.role, user.tenant_id);

    // Rotate refresh token
    await db.query('DELETE FROM refresh_tokens WHERE user_id = ?', [user.id]);
    const rtExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.query(
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [uuid(), user.id, newRefreshToken, rtExpiry]
    );

    res.json({
      success: true,
      data: { accessToken, refreshToken: newRefreshToken },
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }
    next(err);
  }
};

// ── POST /api/auth/logout ────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await db.query('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/auth/me ─────────────────────────────────────
exports.me = async (req, res) => {
  const [rows] = await db.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.avatar_url, u.phone,
            t.id AS tenant_id, t.name AS tenant_name, t.slug AS tenant_slug,
            t.plan, t.status AS tenant_status, t.logo_url, t.brand_color
     FROM users u
     LEFT JOIN tenants t ON t.id = u.tenant_id
     WHERE u.id = ?`,
    [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ success: false, message: 'User not found' });

  const u = rows[0];
  res.json({
    success: true,
    data: {
      id: u.id, email: u.email,
      firstName: u.first_name, lastName: u.last_name,
      role: u.role, avatarUrl: u.avatar_url, phone: u.phone,
      tenant: u.tenant_id ? {
        id: u.tenant_id, name: u.tenant_name, slug: u.tenant_slug,
        plan: u.plan, status: u.tenant_status,
        logoUrl: u.logo_url, brandColor: u.brand_color,
      } : null,
    },
  });
};

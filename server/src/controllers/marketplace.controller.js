const { randomUUID: uuid } = require('crypto');
const db = require('../config/db');

// ── GET /api/marketplace  (public) ──────────────────────
exports.listPublic = async (req, res, next) => {
  try {
    const { city, unitType, minPrice, maxPrice, search, page = 1, limit = 12 } = req.query;
    const offset = (page - 1) * limit;

    let where = 'WHERE fp.is_published = 1 AND b.status = "active"';
    const params = [];

    if (city)     { where += ' AND b.city = ?';         params.push(city); }
    if (unitType) { where += ' AND fp.unit_type = ?';   params.push(unitType); }
    if (minPrice) { where += ' AND fp.price_min >= ?';  params.push(minPrice); }
    if (maxPrice) { where += ' AND fp.price_max <= ?';  params.push(maxPrice); }
    if (search)   {
      where += ' AND (b.name LIKE ? OR b.city LIKE ? OR fp.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [rows] = await db.query(
      `SELECT fp.id, fp.name, fp.unit_type, fp.area_sqft, fp.price_min, fp.price_max,
              fp.thumbnail_url, fp.view_count, fp.published_at,
              b.id AS building_id, b.name AS building_name,
              b.address, b.city, b.state, b.cover_image_url,
              t.name AS developer_name, t.logo_url AS developer_logo
       FROM floor_plans fp
       JOIN buildings b ON b.id = fp.building_id
       JOIN tenants t ON t.id = fp.tenant_id
       ${where}
       ORDER BY fp.published_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM floor_plans fp
       JOIN buildings b ON b.id = fp.building_id
       ${where}`,
      params
    );

    res.json({
      success: true,
      data: rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
};

// ── GET /api/marketplace/:id  (public) ──────────────────
exports.getPublic = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT fp.*, b.name AS building_name, b.address, b.city, b.state,
              b.latitude, b.longitude, b.description AS building_description,
              b.cover_image_url, t.name AS developer_name, t.logo_url AS developer_logo,
              t.brand_color
       FROM floor_plans fp
       JOIN buildings b ON b.id = fp.building_id
       JOIN tenants t ON t.id = fp.tenant_id
       WHERE fp.id = ? AND fp.is_published = 1`,
      [id]
    );

    if (!rows.length) return res.status(404).json({ success: false, message: 'Listing not found' });

    // Increment view count
    await db.query('UPDATE floor_plans SET view_count = view_count + 1 WHERE id = ?', [id]);

    // Get rooms
    const [rooms] = await db.query(
      'SELECT id, name, room_type, area_sqft, x, y, width, height, color, notes FROM rooms WHERE floor_plan_id = ?',
      [id]
    );

    res.json({ success: true, data: { ...rows[0], rooms } });
  } catch (err) { next(err); }
};

// ── POST /api/marketplace/:id/inquire  (public) ─────────
exports.inquire = async (req, res, next) => {
  try {
    const { id: floorPlanId } = req.params;
    const { name, email, phone, message, preferredVisitDate, budget } = req.body;

    // Get tenant_id from floor plan
    const [fpRows] = await db.query(
      'SELECT tenant_id FROM floor_plans WHERE id = ? AND is_published = 1',
      [floorPlanId]
    );
    if (!fpRows.length) return res.status(404).json({ success: false, message: 'Listing not found' });

    const tenantId = fpRows[0].tenant_id;
    const leadId = uuid();

    await db.query(
      `INSERT INTO leads (id, tenant_id, floor_plan_id, consumer_id, name, email, phone, message, preferred_visit_date, budget)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [leadId, tenantId, floorPlanId, req.user?.id || null,
       name, email, phone || null, message || null, preferredVisitDate || null, budget || null]
    );

    // Increment inquiry count on listing
    await db.query(
      'UPDATE floor_plans SET view_count = view_count WHERE id = ?', [floorPlanId]
    );

    res.status(201).json({ success: true, message: 'Inquiry submitted successfully', data: { leadId } });
  } catch (err) { next(err); }
};

// ── GET /api/leads  (tenant protected) ──────────────────
exports.listLeads = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let where = 'WHERE l.tenant_id = ?';
    const params = [tenantId];

    if (status) { where += ' AND l.status = ?'; params.push(status); }

    const [rows] = await db.query(
      `SELECT l.*, fp.name AS floor_plan_name, fp.unit_type, b.name AS building_name
       FROM leads l
       LEFT JOIN floor_plans fp ON fp.id = l.floor_plan_id
       LEFT JOIN buildings b ON b.id = fp.building_id
       ${where}
       ORDER BY l.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM leads l ${where}`, params
    );

    res.json({
      success: true,
      data: rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
};

// ── PATCH /api/leads/:id  (tenant protected) ────────────
exports.updateLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const tenantId = req.tenantId;

    const [result] = await db.query(
      'UPDATE leads SET status = COALESCE(?, status), notes = COALESCE(?, notes) WHERE id = ? AND tenant_id = ?',
      [status, notes, id, tenantId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Lead not found' });

    res.json({ success: true, message: 'Lead updated' });
  } catch (err) { next(err); }
};

const { randomUUID: uuid } = require('crypto');
const db = require('../config/db');

// ── GET /api/floor-plans  ────────────────────────────────
exports.list = async (req, res, next) => {
  try {
    const tenantId   = req.tenantId || req.query.tenantId;
    const buildingId = req.query.buildingId;
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let where = 'WHERE fp.tenant_id = ?';
    const params = [tenantId];

    if (buildingId) {
      where += ' AND fp.building_id = ?';
      params.push(buildingId);
    }

    const [rows] = await db.query(
      `SELECT fp.*, b.name AS building_name, b.city,
              u.first_name, u.last_name
       FROM floor_plans fp
       JOIN buildings b ON b.id = fp.building_id
       LEFT JOIN users u ON u.id = fp.created_by
       ${where}
       ORDER BY fp.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM floor_plans fp ${where}`,
      params
    );

    res.json({
      success: true,
      data: rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
};

// ── GET /api/floor-plans/:id ─────────────────────────────
exports.getOne = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const [rows] = await db.query(
      `SELECT fp.*, b.name AS building_name, b.address, b.city,
              u.first_name, u.last_name
       FROM floor_plans fp
       JOIN buildings b ON b.id = fp.building_id
       LEFT JOIN users u ON u.id = fp.created_by
       WHERE fp.id = ? ${tenantId ? 'AND fp.tenant_id = ?' : ''}`,
      tenantId ? [id, tenantId] : [id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Floor plan not found' });
    }

    // Increment view count for published plans
    if (rows[0].is_published) {
      await db.query('UPDATE floor_plans SET view_count = view_count + 1 WHERE id = ?', [id]);
    }

    // Fetch rooms
    const [rooms] = await db.query(
      'SELECT * FROM rooms WHERE floor_plan_id = ? ORDER BY created_at ASC',
      [id]
    );

    res.json({ success: true, data: { ...rows[0], rooms } });
  } catch (err) { next(err); }
};

// ── POST /api/floor-plans ────────────────────────────────
exports.create = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    // Check tenant plan limits
    const [[{ count }]] = await db.query(
      'SELECT COUNT(*) AS count FROM floor_plans WHERE tenant_id = ?',
      [tenantId]
    );
    const [[tenant]] = await db.query(
      'SELECT max_floor_plans FROM tenants WHERE id = ?',
      [tenantId]
    );
    if (count >= tenant.max_floor_plans) {
      return res.status(403).json({
        success: false,
        message: `Plan limit reached (${tenant.max_floor_plans} floor plans). Please upgrade your subscription.`,
      });
    }

    const { buildingId, name, floorNumber = 1, unitType, areaSqft, priceMin, priceMax } = req.body;

    // Validate building belongs to tenant
    const [bldRows] = await db.query(
      'SELECT id FROM buildings WHERE id = ? AND tenant_id = ?',
      [buildingId, tenantId]
    );
    if (!bldRows.length) {
      return res.status(404).json({ success: false, message: 'Building not found' });
    }

    const id = uuid();
    await db.query(
      `INSERT INTO floor_plans (id, tenant_id, building_id, name, floor_number, unit_type, area_sqft, price_min, price_max, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, buildingId, name, floorNumber, unitType, areaSqft, priceMin, priceMax, req.user.id]
    );

    const [[fp]] = await db.query('SELECT * FROM floor_plans WHERE id = ?', [id]);
    res.status(201).json({ success: true, message: 'Floor plan created', data: fp });
  } catch (err) { next(err); }
};

// ── PUT /api/floor-plans/:id ─────────────────────────────
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { name, floorNumber, unitType, areaSqft, priceMin, priceMax, canvasData, sceneData } = req.body;

    const [existing] = await db.query(
      'SELECT id FROM floor_plans WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Floor plan not found' });
    }

    await db.query(
      `UPDATE floor_plans
       SET name = COALESCE(?, name),
           floor_number = COALESCE(?, floor_number),
           unit_type = COALESCE(?, unit_type),
           area_sqft = COALESCE(?, area_sqft),
           price_min = COALESCE(?, price_min),
           price_max = COALESCE(?, price_max),
           canvas_data = COALESCE(?, canvas_data),
           scene_data = COALESCE(?, scene_data),
           updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [name, floorNumber, unitType, areaSqft, priceMin, priceMax,
       canvasData ? JSON.stringify(canvasData) : null,
       sceneData  ? JSON.stringify(sceneData)  : null,
       id, tenantId]
    );

    const [[fp]] = await db.query('SELECT * FROM floor_plans WHERE id = ?', [id]);
    res.json({ success: true, message: 'Floor plan updated', data: fp });
  } catch (err) { next(err); }
};

// ── POST /api/floor-plans/:id/publish ───────────────────
exports.publish = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { publish = true } = req.body;

    const [existing] = await db.query(
      'SELECT id FROM floor_plans WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Floor plan not found' });
    }

    await db.query(
      `UPDATE floor_plans SET is_published = ?, published_at = ${publish ? 'NOW()' : 'NULL'} WHERE id = ?`,
      [publish ? 1 : 0, id]
    );

    res.json({ success: true, message: publish ? 'Floor plan published' : 'Floor plan unpublished' });
  } catch (err) { next(err); }
};

// ── DELETE /api/floor-plans/:id ──────────────────────────
exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const [result] = await db.query(
      'DELETE FROM floor_plans WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Floor plan not found' });
    }

    res.json({ success: true, message: 'Floor plan deleted' });
  } catch (err) { next(err); }
};

// ── POST /api/floor-plans/:id/rooms ─────────────────────
exports.saveRooms = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { rooms } = req.body;

    // Validate floor plan ownership
    const [existing] = await db.query(
      'SELECT id FROM floor_plans WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Floor plan not found' });
    }

    // Delete existing rooms and re-insert (full replace)
    await db.query('DELETE FROM rooms WHERE floor_plan_id = ?', [id]);

    if (rooms && rooms.length > 0) {
      const values = rooms.map(r => [
        uuid(), id, tenantId, r.name, r.roomType || 'other',
        r.areaSqft || null, r.x || 0, r.y || 0,
        r.width || 100, r.height || 100, r.color || '#E8F0FB', r.notes || null,
        r.metadata ? JSON.stringify(r.metadata) : null,
      ]);
      await db.query(
        `INSERT INTO rooms (id, floor_plan_id, tenant_id, name, room_type, area_sqft, x, y, width, height, color, notes, metadata)
         VALUES ?`,
        [values]
      );
    }

    res.json({ success: true, message: 'Rooms saved', count: rooms?.length || 0 });
  } catch (err) { next(err); }
};

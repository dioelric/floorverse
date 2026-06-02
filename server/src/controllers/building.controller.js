const { randomUUID: uuid } = require('crypto');
const db = require('../config/db');

exports.list = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const [rows] = await db.query(
      `SELECT b.*, u.first_name, u.last_name,
              COUNT(fp.id) AS floor_plan_count
       FROM buildings b
       LEFT JOIN users u ON u.id = b.created_by
       LEFT JOIN floor_plans fp ON fp.building_id = b.id
       WHERE b.tenant_id = ?
       GROUP BY b.id
       ORDER BY b.created_at DESC`,
      [tenantId]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const [rows] = await db.query(
      'SELECT * FROM buildings WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Building not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { name, address, city, state, pincode, description, totalFloors = 1 } = req.body;

    const id = uuid();
    await db.query(
      `INSERT INTO buildings (id, tenant_id, name, address, city, state, pincode, total_floors, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, name, address, city, state, pincode, totalFloors, description, req.user.id]
    );

    const [[building]] = await db.query('SELECT * FROM buildings WHERE id = ?', [id]);
    res.status(201).json({ success: true, message: 'Building created', data: building });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { name, address, city, state, pincode, description, totalFloors, status } = req.body;

    const [result] = await db.query(
      `UPDATE buildings
       SET name = COALESCE(?, name),
           address = COALESCE(?, address),
           city = COALESCE(?, city),
           state = COALESCE(?, state),
           pincode = COALESCE(?, pincode),
           description = COALESCE(?, description),
           total_floors = COALESCE(?, total_floors),
           status = COALESCE(?, status)
       WHERE id = ? AND tenant_id = ?`,
      [name, address, city, state, pincode, description, totalFloors, status, id, tenantId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Building not found' });

    const [[building]] = await db.query('SELECT * FROM buildings WHERE id = ?', [id]);
    res.json({ success: true, message: 'Building updated', data: building });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [result] = await db.query(
      'DELETE FROM buildings WHERE id = ? AND tenant_id = ?',
      [id, req.tenantId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Building not found' });
    res.json({ success: true, message: 'Building deleted' });
  } catch (err) { next(err); }
};

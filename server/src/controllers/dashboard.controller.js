const db = require('../config/db');

exports.getTenantStats = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    const [[fpStats]] = await db.query(
      `SELECT
        COUNT(*) AS total_floor_plans,
        SUM(is_published) AS published_floor_plans,
        SUM(view_count) AS total_views
       FROM floor_plans WHERE tenant_id = ?`,
      [tenantId]
    );

    const [[leadStats]] = await db.query(
      `SELECT
        COUNT(*) AS total_leads,
        SUM(status = 'new') AS new_leads,
        SUM(status = 'converted') AS converted_leads
       FROM leads WHERE tenant_id = ?`,
      [tenantId]
    );

    const [[buildingStats]] = await db.query(
      `SELECT COUNT(*) AS total_buildings FROM buildings WHERE tenant_id = ?`,
      [tenantId]
    );

    // Recent leads
    const [recentLeads] = await db.query(
      `SELECT l.id, l.name, l.email, l.phone, l.status, l.created_at,
              fp.name AS floor_plan_name, b.name AS building_name
       FROM leads l
       LEFT JOIN floor_plans fp ON fp.id = l.floor_plan_id
       LEFT JOIN buildings b ON b.id = fp.building_id
       WHERE l.tenant_id = ?
       ORDER BY l.created_at DESC LIMIT 5`,
      [tenantId]
    );

    // Monthly views (last 6 months)
    const [monthlyViews] = await db.query(
      `SELECT DATE_FORMAT(published_at, '%Y-%m') AS month, SUM(view_count) AS views
       FROM floor_plans
       WHERE tenant_id = ? AND published_at IS NOT NULL
       GROUP BY DATE_FORMAT(published_at, '%Y-%m')
       ORDER BY month DESC LIMIT 6`,
      [tenantId]
    );

    res.json({
      success: true,
      data: {
        floorPlans: {
          total: fpStats.total_floor_plans || 0,
          published: fpStats.published_floor_plans || 0,
          totalViews: fpStats.total_views || 0,
        },
        leads: {
          total: leadStats.total_leads || 0,
          new: leadStats.new_leads || 0,
          converted: leadStats.converted_leads || 0,
        },
        buildings: {
          total: buildingStats.total_buildings || 0,
        },
        recentLeads,
        monthlyViews: monthlyViews.reverse(),
      },
    });
  } catch (err) { next(err); }
};

const router = require('express').Router();
const ctrl   = require('../controllers/dashboard.controller');
const { authenticate, authorize, scopeToTenant } = require('../middleware/auth');

router.get('/stats',
  authenticate,
  authorize('super_admin','tenant_admin','sales_manager'),
  scopeToTenant,
  ctrl.getTenantStats
);

module.exports = router;

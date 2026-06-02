const router = require('express').Router();
const ctrl   = require('../controllers/marketplace.controller');
const { authenticate, authorize, scopeToTenant } = require('../middleware/auth');

// Public routes
router.get('/listings',         ctrl.listPublic);
router.get('/listings/:id',     ctrl.getPublic);
router.post('/listings/:id/inquire', ctrl.inquire);

// Tenant protected routes (lead management)
router.get('/leads', authenticate, authorize('super_admin','tenant_admin','sales_manager'), scopeToTenant, ctrl.listLeads);
router.patch('/leads/:id', authenticate, authorize('super_admin','tenant_admin','sales_manager'), scopeToTenant, ctrl.updateLead);

module.exports = router;

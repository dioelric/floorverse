const router = require('express').Router();
const ctrl   = require('../controllers/building.controller');
const { authenticate, authorize, scopeToTenant } = require('../middleware/auth');

const guard = [authenticate, authorize('super_admin','tenant_admin','designer'), scopeToTenant];

router.get('/',     [...guard], ctrl.list);
router.get('/:id',  [...guard], ctrl.getOne);
router.post('/',    [...guard], ctrl.create);
router.put('/:id',  [...guard], ctrl.update);
router.delete('/:id', [authenticate, authorize('super_admin','tenant_admin'), scopeToTenant], ctrl.remove);

module.exports = router;

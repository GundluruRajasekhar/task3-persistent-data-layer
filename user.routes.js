'use strict';

const router = require('express').Router();
const c = require('../controllers/user.controller');
const validate = require('../middleware/validate');
const { uuidParam } = require('../validators/common');
const v = require('../validators/user.validator');

router.post('/', validate({ body: v.createUser }), c.createUser);
router.get('/', validate({ query: v.userQuery }), c.listUsers);
router.get('/:id', validate({ params: uuidParam() }), c.getUser);
router.put('/:id', validate({ params: uuidParam(), body: v.updateUser }), c.updateUser);
router.patch('/:id', validate({ params: uuidParam(), body: v.updateUser }), c.updateUser);
router.delete('/:id', validate({ params: uuidParam() }), c.deleteUser);

module.exports = router;

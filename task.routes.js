'use strict';

const router = require('express').Router();
const c = require('../controllers/task.controller');
const validate = require('../middleware/validate');
const { uuidParam } = require('../validators/common');
const v = require('../validators/task.validator');

router.get('/stats', c.taskStats);

router.post('/', validate({ body: v.createTask }), c.createTask);
router.get('/', validate({ query: v.taskQuery }), c.listTasks);
router.get('/:id', validate({ params: uuidParam() }), c.getTask);
router.put('/:id', validate({ params: uuidParam(), body: v.updateTask }), c.updateTask);
router.patch('/:id', validate({ params: uuidParam(), body: v.updateTask }), c.updateTask);
router.patch('/:id/status', validate({ params: uuidParam(), body: v.updateStatus }), c.updateStatus);
router.delete('/:id', validate({ params: uuidParam() }), c.deleteTask);

module.exports = router;

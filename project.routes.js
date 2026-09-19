'use strict';

const { z } = require('zod');
const router = require('express').Router();
const c = require('../controllers/project.controller');
const validate = require('../middleware/validate');
const { uuidParam } = require('../validators/common');
const v = require('../validators/project.validator');

const memberParams = z.object({
  id: z.string().uuid('id must be a valid UUID'),
  userId: z.string().uuid('userId must be a valid UUID'),
});

router.post('/', validate({ body: v.createProject }), c.createProject);
router.get('/', validate({ query: v.projectQuery }), c.listProjects);
router.get('/:id', validate({ params: uuidParam() }), c.getProject);
router.put('/:id', validate({ params: uuidParam(), body: v.updateProject }), c.updateProject);
router.patch('/:id', validate({ params: uuidParam(), body: v.updateProject }), c.updateProject);
router.delete('/:id', validate({ params: uuidParam() }), c.deleteProject);

// Nested resources
router.get('/:id/tasks', validate({ params: uuidParam() }), c.listProjectTasks);
router.post('/:id/members', validate({ params: uuidParam(), body: v.addMember }), c.addMember);
router.delete('/:id/members/:userId', validate({ params: memberParams }), c.removeMember);

module.exports = router;

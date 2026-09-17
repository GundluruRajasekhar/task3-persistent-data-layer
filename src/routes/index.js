'use strict';

const router = require('express').Router();
const { prisma } = require('../db/prisma');

router.use('/users', require('./user.routes'));
router.use('/projects', require('./project.routes'));
router.use('/tasks', require('./task.routes'));

// Liveness + database readiness in one call - handy for the demo video.
router.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, status: 'ok', database: 'connected', uptime: process.uptime() });
  } catch (err) {
    res.status(503).json({ success: false, status: 'degraded', database: 'unreachable' });
  }
});

module.exports = router;

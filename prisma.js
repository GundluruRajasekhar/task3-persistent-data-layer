'use strict';

const { PrismaClient } = require('@prisma/client');
const env = require('../config/env');

// Single shared client. Prisma manages the connection pool; creating one
// client per request would exhaust Postgres connections.
const prisma = new PrismaClient({
  log: env.isProd ? ['warn', 'error'] : ['query', 'warn', 'error'],
});

async function connectDatabase() {
  await prisma.$connect();
  const rows = await prisma.$queryRaw`SELECT version() as version`;
  console.log('Database connected: ' + String(rows[0].version).split(',')[0]);
}

async function disconnectDatabase() {
  await prisma.$disconnect();
}

module.exports = { prisma, connectDatabase, disconnectDatabase };

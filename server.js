'use strict';

const app = require('./app');
const env = require('./config/env');
const { connectDatabase, disconnectDatabase } = require('./db/prisma');

async function start() {
  await connectDatabase();

  const server = app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`);
  });

  // Close the HTTP server and the connection pool cleanly so in-flight
  // queries are not cut off mid-transaction.
  const shutdown = async (signal) => {
    console.log(`\n${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  ['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => shutdown(s)));
}

start().catch(async (err) => {
  console.error('Failed to start server:', err.message);
  await disconnectDatabase();
  process.exit(1);
});

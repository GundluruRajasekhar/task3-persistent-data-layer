'use strict';

const { Prisma } = require('@prisma/client');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');

// Maps database-level failures to the right HTTP status. This is what makes
// the DB constraints usable from a client: a UNIQUE violation becomes 409,
// a missing FK target becomes 400, a missing row becomes 404.
function translatePrismaError(err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const target = Array.isArray(err.meta?.target)
      ? err.meta.target.join(', ')
      : err.meta?.target;

    switch (err.code) {
      case 'P2002': // unique constraint
        return new ApiError(409, `A record with this ${target || 'value'} already exists`);
      case 'P2003': // foreign key constraint
        return new ApiError(400, `Referenced record does not exist (${err.meta?.field_name || 'foreign key'})`);
      case 'P2011': // null constraint
        return new ApiError(422, `Missing required field: ${target || 'unknown'}`);
      case 'P2014': // relation violation
        return new ApiError(409, 'This change would break a required relation');
      case 'P2025': // record not found
        return new ApiError(404, err.meta?.cause || 'Record not found');
      default:
        return new ApiError(400, `Database request failed (${err.code})`);
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return new ApiError(422, 'Invalid data shape sent to the database layer');
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    // Never echo the connection string.
    return new ApiError(503, 'Database is unavailable');
  }

  // CHECK constraints surface as raw Postgres errors (SQLSTATE 23514).
  if (err.code === '23514' || /violates check constraint/i.test(err.message || '')) {
    const name = (err.message.match(/"([^"]*_chk)"/) || [])[1];
    return new ApiError(422, `Database rule violated${name ? `: ${name}` : ''}`);
  }

  return null;
}

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  let error = err instanceof ApiError ? err : translatePrismaError(err);

  if (!error) {
    error = new ApiError(500, 'Internal server error');
    error.isOperational = false;
  }

  if (!error.isOperational || error.statusCode >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
  }

  res.status(error.statusCode).json({
    success: false,
    error: {
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
      // Stack traces are development-only; they can leak paths and config.
      ...(env.isProd ? {} : { stack: err.stack }),
    },
  });
};

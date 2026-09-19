'use strict';

// Loads .env, then validates it. The process refuses to start if a required
// secret is missing or malformed - a misconfigured deploy fails loudly at
// boot instead of silently at the first query.

require('dotenv').config();
const { z } = require('zod');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine(
      (v) => v.startsWith('postgresql://') || v.startsWith('postgres://'),
      'DATABASE_URL must be a PostgreSQL connection string'
    ),
  CORS_ORIGIN: z.string().default('*'),
  MAX_PAGE_SIZE: z.coerce.number().int().positive().max(500).default(100),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error('Invalid environment configuration:\n' + details);
}

const env = parsed.data;

module.exports = {
  ...env,
  isProd: env.NODE_ENV === 'production',
  corsOrigins: env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean),
};

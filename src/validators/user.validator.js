'use strict';

const { z } = require('zod');
const { listQuery } = require('./common');

// Mirrors the column definitions and CHECK constraints in the schema:
// email lower-cased and trimmed, names non-blank, lengths bounded.
const createUser = z.object({
  email: z.string().trim().toLowerCase().email('Must be a valid email').max(255),
  fullName: z.string().trim().min(2, 'Name is too short').max(120),
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER']).optional(),
  isActive: z.boolean().optional(),
});

const updateUser = createUser.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Provide at least one field to update' }
);

const userQuery = listQuery.extend({
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

module.exports = { createUser, updateUser, userQuery };

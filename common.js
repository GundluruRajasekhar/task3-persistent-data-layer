'use strict';

const { z } = require('zod');

const uuidParam = (name = 'id') =>
  z.object({ [name]: z.string().uuid(`${name} must be a valid UUID`) });

const listQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  search: z.string().trim().min(1).max(120).optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'name', 'title']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

module.exports = { uuidParam, listQuery };

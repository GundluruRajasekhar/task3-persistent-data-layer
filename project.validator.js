'use strict';

const { z } = require('zod');
const { listQuery } = require('./common');

const STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'];

const base = z.object({
  name: z.string().trim().min(3, 'Name is too short').max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(STATUSES).optional(),
  startDate: z.coerce.date().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  ownerId: z.string().uuid('ownerId must be a valid UUID'),
});

// Mirrors the projects_date_order_chk constraint in the database.
const dateOrder = (data) =>
  !data.startDate || !data.dueDate || data.dueDate >= data.startDate;

const createProject = base.refine(dateOrder, {
  message: 'dueDate cannot be earlier than startDate',
  path: ['dueDate'],
});

const updateProject = base
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' })
  .refine(dateOrder, { message: 'dueDate cannot be earlier than startDate', path: ['dueDate'] });

const projectQuery = listQuery.extend({
  status: z.enum(STATUSES).optional(),
  ownerId: z.string().uuid().optional(),
});

const addMember = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
  role: z.enum(['OWNER', 'MAINTAINER', 'CONTRIBUTOR', 'VIEWER']).optional(),
});

module.exports = { createProject, updateProject, projectQuery, addMember, STATUSES };

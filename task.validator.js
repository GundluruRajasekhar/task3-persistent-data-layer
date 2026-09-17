'use strict';

const { z } = require('zod');
const { listQuery } = require('./common');

const STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const base = z.object({
  title: z.string().trim().min(3, 'Title is too short').max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueDate: z.coerce.date().optional().nullable(),
  projectId: z.string().uuid('projectId must be a valid UUID'),
  assigneeId: z.string().uuid('assigneeId must be a valid UUID').optional().nullable(),
});

const createTask = base;

// projectId is intentionally omitted: moving a task between projects is a
// separate concern, and allowing it here would silently break the
// project-scoped unique title constraint.
const updateTask = base
  .omit({ projectId: true })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' });

const updateStatus = z.object({ status: z.enum(STATUSES) });

const taskQuery = listQuery.extend({
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  projectId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
});

module.exports = { createTask, updateTask, updateStatus, taskQuery, STATUSES, PRIORITIES };

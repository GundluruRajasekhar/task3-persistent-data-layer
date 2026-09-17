'use strict';

const { prisma } = require('../db/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { paginate, meta } = require('../utils/pagination');

const personSelect = { select: { id: true, fullName: true, email: true } };
const projectSelect = { select: { id: true, name: true, status: true } };

// tasks_completed_at_matches_status_chk requires completed_at to be set
// exactly when status is DONE. Keep the app in step with that rule.
function completionFor(status) {
  if (!status) return {};
  return status === 'DONE' ? { completedAt: new Date() } : { completedAt: null };
}

// An assignee must actually belong to the project the task lives in.
// This is a cross-row rule, so it belongs in application logic rather than
// a CHECK constraint.
async function assertAssigneeIsMember(tx, projectId, assigneeId) {
  if (!assigneeId) return;
  const membership = await tx.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: assigneeId } },
  });
  if (!membership) {
    throw ApiError.badRequest('Assignee must be a member of the project');
  }
}

exports.createTask = asyncHandler(async (req, res) => {
  const { projectId, assigneeId, status, ...rest } = req.body;

  const task = await prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) throw ApiError.badRequest('Referenced project does not exist');

    await assertAssigneeIsMember(tx, projectId, assigneeId);

    return tx.task.create({
      data: {
        ...rest,
        ...(status ? { status } : {}),
        ...completionFor(status),
        project: { connect: { id: projectId } },
        ...(assigneeId ? { assignee: { connect: { id: assigneeId } } } : {}),
      },
      include: { project: projectSelect, assignee: personSelect },
    });
  });

  res.status(201).json({ success: true, data: task });
});

exports.listTasks = asyncHandler(async (req, res) => {
  const q = req.validatedQuery || {};
  const { page, limit, skip, take } = paginate(q);

  const where = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.priority ? { priority: q.priority } : {}),
    ...(q.projectId ? { projectId: q.projectId } : {}),
    ...(q.assigneeId ? { assigneeId: q.assigneeId } : {}),
    ...(q.search ? { title: { contains: q.search, mode: 'insensitive' } } : {}),
  };

  const [total, tasks] = await prisma.$transaction([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      include: { project: projectSelect, assignee: personSelect },
      orderBy: { [q.sort || 'createdAt']: q.order || 'desc' },
      skip,
      take,
    }),
  ]);

  res.json({ success: true, data: tasks, meta: meta(total, page, limit) });
});

exports.getTask = asyncHandler(async (req, res) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: { project: projectSelect, assignee: personSelect },
  });
  if (!task) throw ApiError.notFound('Task not found');
  res.json({ success: true, data: task });
});

exports.updateTask = asyncHandler(async (req, res) => {
  const { assigneeId, status, ...rest } = req.body;

  const task = await prisma.$transaction(async (tx) => {
    const existing = await tx.task.findUnique({
      where: { id: req.params.id },
      select: { projectId: true },
    });
    if (!existing) throw ApiError.notFound('Task not found');

    if (assigneeId !== undefined) {
      await assertAssigneeIsMember(tx, existing.projectId, assigneeId);
    }

    return tx.task.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(status ? { status, ...completionFor(status) } : {}),
        ...(assigneeId !== undefined
          ? assigneeId === null
            ? { assignee: { disconnect: true } }
            : { assignee: { connect: { id: assigneeId } } }
          : {}),
      },
      include: { project: projectSelect, assignee: personSelect },
    });
  });

  res.json({ success: true, data: task });
});

// PATCH /tasks/:id/status - the board-drag endpoint from Task 2.
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: { status, ...completionFor(status) },
    include: { project: projectSelect, assignee: personSelect },
  });
  res.json({ success: true, data: task });
});

exports.deleteTask = asyncHandler(async (req, res) => {
  await prisma.task.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// Aggregate query, useful for the DevPulse dashboard.
exports.taskStats = asyncHandler(async (req, res) => {
  const [byStatus, byPriority, overdue] = await prisma.$transaction([
    prisma.task.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.task.groupBy({ by: ['priority'], _count: { _all: true } }),
    prisma.task.count({ where: { status: { not: 'DONE' }, dueDate: { lt: new Date() } } }),
  ]);

  res.json({
    success: true,
    data: {
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
      byPriority: byPriority.map((r) => ({ priority: r.priority, count: r._count._all })),
      overdue,
    },
  });
});

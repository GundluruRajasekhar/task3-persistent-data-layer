'use strict';

const { prisma } = require('../db/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { paginate, meta } = require('../utils/pagination');

const ownerSelect = { select: { id: true, fullName: true, email: true } };

exports.createProject = asyncHandler(async (req, res) => {
  const { ownerId, ...rest } = req.body;

  // Creating the project and its owner membership must both succeed or
  // neither should - that is what a transaction is for.
  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: { ...rest, owner: { connect: { id: ownerId } } },
      include: { owner: ownerSelect },
    });
    await tx.projectMember.create({
      data: { projectId: created.id, userId: ownerId, role: 'OWNER' },
    });
    return created;
  });

  res.status(201).json({ success: true, data: project });
});

exports.listProjects = asyncHandler(async (req, res) => {
  const q = req.validatedQuery || {};
  const { page, limit, skip, take } = paginate(q);

  const where = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.ownerId ? { ownerId: q.ownerId } : {}),
    ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}),
  };

  const [total, projects] = await prisma.$transaction([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      include: { owner: ownerSelect, _count: { select: { tasks: true, members: true } } },
      orderBy: { [q.sort || 'createdAt']: q.order || 'desc' },
      skip,
      take,
    }),
  ]);

  res.json({ success: true, data: projects, meta: meta(total, page, limit) });
});

exports.getProject = asyncHandler(async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      owner: ownerSelect,
      members: { include: { user: ownerSelect } },
      tasks: {
        select: {
          id: true, title: true, status: true, priority: true, dueDate: true,
          assignee: ownerSelect,
        },
        orderBy: [{ status: 'asc' }, { priority: 'desc' }],
      },
    },
  });

  if (!project) throw ApiError.notFound('Project not found');
  res.json({ success: true, data: project });
});

exports.updateProject = asyncHandler(async (req, res) => {
  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: req.body,
    include: { owner: ownerSelect },
  });
  res.json({ success: true, data: project });
});

exports.deleteProject = asyncHandler(async (req, res) => {
  await prisma.project.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ---- membership (the many-to-many side of the relation) --------------------

exports.addMember = asyncHandler(async (req, res) => {
  const member = await prisma.projectMember.create({
    data: {
      projectId: req.params.id,
      userId: req.body.userId,
      role: req.body.role || 'CONTRIBUTOR',
    },
    include: { user: ownerSelect },
  });
  res.status(201).json({ success: true, data: member });
});

exports.removeMember = asyncHandler(async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    select: { ownerId: true },
  });
  if (!project) throw ApiError.notFound('Project not found');
  if (project.ownerId === req.params.userId) {
    throw ApiError.conflict('The project owner cannot be removed from its own project');
  }

  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId: req.params.id, userId: req.params.userId } },
  });
  res.status(204).send();
});

exports.listProjectTasks = asyncHandler(async (req, res) => {
  const exists = await prisma.project.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });
  if (!exists) throw ApiError.notFound('Project not found');

  const tasks = await prisma.task.findMany({
    where: { projectId: req.params.id },
    include: { assignee: ownerSelect },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: tasks });
});

'use strict';

const { prisma } = require('../db/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { paginate, meta } = require('../utils/pagination');

// Never select columns the client has no business seeing.
const userSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

exports.createUser = asyncHandler(async (req, res) => {
  // A duplicate email raises P2002 from the UNIQUE index and the error
  // handler turns it into 409 - the database is the source of truth.
  const user = await prisma.user.create({ data: req.body, select: userSelect });
  res.status(201).json({ success: true, data: user });
});

exports.listUsers = asyncHandler(async (req, res) => {
  const q = req.validatedQuery || {};
  const { page, limit, skip, take } = paginate(q);

  const where = {
    ...(q.role ? { role: q.role } : {}),
    ...(q.isActive ? { isActive: q.isActive === 'true' } : {}),
    ...(q.search
      ? {
          OR: [
            { fullName: { contains: q.search, mode: 'insensitive' } },
            { email: { contains: q.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: { ...userSelect, _count: { select: { ownedProjects: true, assignedTasks: true } } },
      orderBy: { [q.sort || 'createdAt']: q.order || 'desc' },
      skip,
      take,
    }),
  ]);

  res.json({ success: true, data: users, meta: meta(total, page, limit) });
});

exports.getUser = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      ...userSelect,
      ownedProjects: { select: { id: true, name: true, status: true } },
      memberships: {
        select: { role: true, joinedAt: true, project: { select: { id: true, name: true } } },
      },
      assignedTasks: {
        select: { id: true, title: true, status: true, priority: true, dueDate: true },
        orderBy: { dueDate: 'asc' },
      },
    },
  });

  if (!user) throw ApiError.notFound('User not found');
  res.json({ success: true, data: user });
});

exports.updateUser = asyncHandler(async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: req.body,
    select: userSelect,
  });
  res.json({ success: true, data: user });
});

exports.deleteUser = asyncHandler(async (req, res) => {
  // ON DELETE CASCADE removes owned projects (and their tasks);
  // ON DELETE SET NULL un-assigns tasks assigned to this user.
  await prisma.user.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

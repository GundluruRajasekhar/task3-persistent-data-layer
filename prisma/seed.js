'use strict';

// Deterministic demo data. Run `npm run db:seed` before recording the video
// so there is something to read, update and delete on camera.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Order matters: children first, because of the foreign keys.
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  const [rajasekhar, priya, arjun] = await Promise.all([
    prisma.user.create({
      data: { email: 'raja@example.com', fullName: 'Rajasekhar G', role: 'ADMIN' },
    }),
    prisma.user.create({
      data: { email: 'priya@example.com', fullName: 'Priya Nair', role: 'MANAGER' },
    }),
    prisma.user.create({
      data: { email: 'arjun@example.com', fullName: 'Arjun Reddy', role: 'MEMBER' },
    }),
  ]);

  const project = await prisma.project.create({
    data: {
      name: 'DevPulse Dashboard',
      description: 'Developer productivity dashboard powered by this API.',
      status: 'ACTIVE',
      startDate: new Date('2026-09-01'),
      dueDate: new Date('2026-10-15'),
      ownerId: rajasekhar.id,
      members: {
        create: [
          { userId: rajasekhar.id, role: 'OWNER' },
          { userId: priya.id, role: 'MAINTAINER' },
          { userId: arjun.id, role: 'CONTRIBUTOR' },
        ],
      },
    },
  });

  const secondProject = await prisma.project.create({
    data: {
      name: 'Internal Tooling',
      description: 'Scripts and utilities for the team.',
      status: 'PLANNING',
      ownerId: priya.id,
      members: { create: [{ userId: priya.id, role: 'OWNER' }] },
    },
  });

  await prisma.task.createMany({
    data: [
      {
        title: 'Design the database schema',
        description: 'Users, projects, tasks and the membership join table.',
        status: 'DONE',
        priority: 'HIGH',
        
# Task 3 — Persistent Data Layer

PostgreSQL persistence for the Users / Projects / Tasks REST API built in
Task 2. Data survives restarts, relationships are enforced by real foreign
keys, validation runs at both the API edge and the database, and no
credential is committed to the repository.

**Stack:** Node.js · Express · PostgreSQL 16 · Prisma ORM · Zod

- Architecture and ER diagrams: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Schema: [`prisma/schema.prisma`](prisma/schema.prisma)
- Database-level business rules: [`prisma/constraints.sql`](prisma/constraints.sql)

---

## Architecture

```
Frontend  ──HTTP/JSON──▶  REST API  ──▶  Backend logic  ──▶  PostgreSQL
(DevPulse)                (Express)      (controllers,        (users, projects,
                          routes +        transactions,        project_members,
                          Zod)            Prisma Client)       tasks)
```

---

## Quick start

```bash
# 1. install
npm install

# 2. configure - copy the template and fill in your own values
cp .env.example .env

# 3. start Postgres (or point DATABASE_URL at Neon / Supabase / RDS)
docker compose up -d

# 4. create the schema
npx prisma migrate dev --name init

# 5. add the CHECK constraints
npx prisma migrate dev --create-only --name add_check_constraints
#    paste prisma/constraints.sql into the generated migration.sql, then:
npx prisma migrate dev

# 6. demo data + run
npm run db:seed
npm run dev
```

API base URL: `http://localhost:4000/api/v1`
Health check: `GET /api/v1/health` — returns database connectivity too.

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start with auto-reload |
| `npm start` | Start for production |
| `npm run db:migrate` | Create/apply a migration in development |
| `npm run db:deploy` | Apply migrations in production (no prompts) |
| `npm run db:studio` | Open Prisma Studio — a GUI over the live tables |
| `npm run db:seed` | Load demo users, projects and tasks |
| `npm run db:reset` | Drop, re-migrate and re-seed |

---

## Data model

Four tables. Three entities plus an explicit join table so membership can
carry its own role.

| Relationship | Type | On delete |
|---|---|---|
| User → Project (owner) | one-to-many | CASCADE |
| User ↔ Project (membership) | many-to-many via `project_members` | CASCADE |
| Project → Task | one-to-many | CASCADE |
| User → Task (assignee) | one-to-many, nullable | SET NULL |

### Validation, and where it lives

| Rule | Enforced by |
|---|---|
| Email unique | `UNIQUE` index on `users.email` |
| Email lower-case and well-formed | `users_email_format_chk` |
| Names and titles not blank | `*_not_blank_chk` |
| Status / role / priority values | native Postgres `ENUM` types |
| Project name unique per owner | composite `UNIQUE (owner_id, name)` |
| Task title unique per project | composite `UNIQUE (project_id, title)` |
| `due_date >= start_date` | `projects_date_order_chk` |
| `completed_at` set iff status is `DONE` | `tasks_completed_at_matches_status_chk` |
| Task must belong to an existing project | `NOT NULL` FK `tasks.project_id` |
| Assignee must be a project member | transaction in `task.controller.js` |
| Field types, lengths, required-ness | Zod schemas in `src/validators/` |

Constraint violations are translated to correct HTTP codes in
`src/middleware/errorHandler.js` — a duplicate email returns `409`, a missing
foreign key returns `400`, a missing row returns `404`, a failed CHECK
returns `422`.

---

## API reference

All responses use the envelope `{ success, data, meta? }` or
`{ success: false, error: { message, details? } }`.

### Users — `/api/v1/users`

| Method | Path | Purpose | Success |
|---|---|---|---|
| POST | `/users` | Create a user | 201 |
| GET | `/users` | List (filters: `role`, `isActive`, `search`, `page`, `limit`, `sort`, `order`) | 200 |
| GET | `/users/:id` | One user with owned projects, memberships and assigned tasks | 200 |
| PUT / PATCH | `/users/:id` | Update | 200 |
| DELETE | `/users/:id` | Delete (cascades / un-assigns) | 204 |

### Projects — `/api/v1/projects`

| Method | Path | Purpose | Success |
|---|---|---|---|
| POST | `/projects` | Create; owner is added as a member in the same transaction | 201 |
| GET | `/projects` | List (filters: `status`, `ownerId`, `search`, pagination) | 200 |
| GET | `/projects/:id` | One project with owner, members and tasks | 200 |
| PUT / PATCH | `/projects/:id` | Update | 200 |
| DELETE | `/projects/:id` | Delete (cascades to tasks and memberships) | 204 |
| GET | `/projects/:id/tasks` | Tasks in this project | 200 |
| POST | `/projects/:id/members` | Add a member | 201 |
| DELETE | `/projects/:id/members/:userId` | Remove a member (owner is protected) | 204 |

### Tasks — `/api/v1/tasks`

| Method | Path | Purpose | Success |
|---|---|---|---|
| POST | `/tasks` | Create | 201 |
| GET | `/tasks` | List (filters: `status`, `priority`, `projectId`, `assigneeId`, `search`, pagination) | 200 |
| GET | `/tasks/:id` | One task with project and assignee | 200 |
| PUT / PATCH | `/tasks/:id` | Update | 200 |
| PATCH | `/tasks/:id/status` | Move between `TODO` / `IN_PROGRESS` / `DONE` | 200 |
| DELETE | `/tasks/:id` | Delete | 204 |
| GET | `/tasks/stats` | Counts by status, by priority, and overdue | 200 |

### Example

```bash
# create a user
curl -X POST http://localhost:4000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","fullName":"Dev User","role":"MEMBER"}'

# create a project owned by that user
curl -X POST http://localhost:4000/api/v1/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Apollo","description":"Demo project","ownerId":"<USER_ID>"}'

# create a task inside it
curl -X POST http://localhost:4000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Write the schema","projectId":"<PROJECT_ID>","assigneeId":"<USER_ID>","priority":"HIGH"}'

# move it to done
curl -X PATCH http://localhost:4000/api/v1/tasks/<TASK_ID>/status \
  -H "Content-Type: application/json" -d '{"status":"DONE"}'
```

---

## Secure configuration

- Real values live in `.env`, which is git-ignored. `.env.example` ships
  placeholders only.
- `src/config/env.js` validates every variable at startup with Zod and exits
  with a clear message if one is missing or malformed — no silent failure.
- `docker-compose.yml` reads its credentials from the environment; nothing is
  hard-coded there either.
- Stack traces are returned only when `NODE_ENV` is not `production`.
- `helmet` sets security headers; CORS origins come from config, not `*`.
- Prisma parameterises every query, so string-concatenation SQL injection is
  not possible through the ORM.

**Before pushing:** confirm `.env` is not tracked — `git check-ignore -v .env`
should print a match. If it was ever committed, rotate the password.

---

## Demo video checklist

Roughly six minutes, screen + voice:

1. `docs/ARCHITECTURE.md` — walk the ER diagram, name the four relationships.
2. `prisma/schema.prisma` — point at the FKs and their `onDelete` rules.
3. Terminal: `npx prisma migrate deploy`, then `\d+ tasks` in psql to show the
   real constraints in the live database.
4. Postman/curl: **C** create user → create project → create task.
   **R** list and filter. **U** `PATCH /tasks/:id/status` to `DONE`.
   **D** delete the task.
5. Show it persisting: restart the server, re-fetch, data is still there.
6. Break it on purpose — post a duplicate email (409), a bad enum value (422),
   a task with a non-existent `projectId` (400). This is the part that proves
   validation.
7. Delete a user and show their tasks were un-assigned, not destroyed.
8. Close in Prisma Studio showing the rows.

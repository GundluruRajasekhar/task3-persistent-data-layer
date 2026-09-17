-- ---------------------------------------------------------------------------
-- Database-level business rules that Prisma's schema language cannot express.
--
-- How to apply (creates a real, reviewable migration):
--   npx prisma migrate dev --create-only --name add_check_constraints
--   -> paste this file into the generated migration.sql
--   npx prisma migrate dev
--
-- These run inside Postgres, so they hold for psql, pgAdmin, a background
-- job, or anything else that writes to the database - not just the API.
-- ---------------------------------------------------------------------------

-- Emails must be lower-case, trimmed and structurally valid.
ALTER TABLE "users"
  ADD CONSTRAINT "users_email_format_chk"
  CHECK (email = lower(btrim(email)) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- Names cannot be blank or whitespace-only.
ALTER TABLE "users"
  ADD CONSTRAINT "users_full_name_not_blank_chk"
  CHECK (btrim(full_name) <> '');

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_name_not_blank_chk"
  CHECK (btrim(name) <> '');

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_title_not_blank_chk"
  CHECK (btrim(title) <> '');

-- A project cannot be due before it starts.
ALTER TABLE "projects"
  ADD CONSTRAINT "projects_date_order_chk"
  CHECK (start_date IS NULL OR due_date IS NULL OR due_date >= start_date);

-- completed_at is set if and only if the task is DONE.
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_completed_at_matches_status_chk"
  CHECK (
    (status = 'DONE' AND completed_at IS NOT NULL)
    OR (status <> 'DONE' AND completed_at IS NULL)
  );

-- A task can never be marked complete before it was created.
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_completed_after_created_chk"
  CHECK (completed_at IS NULL OR completed_at >= created_at);

# Architecture

## Request flow

```mermaid
flowchart LR
    subgraph Client
        FE["Frontend<br/>(DevPulse dashboard)"]
    end

    subgraph Server["Node.js + Express"]
        RT["REST API layer<br/>routes + Zod validation"]
        CT["Backend logic<br/>controllers + transactions"]
        OR["Prisma Client<br/>(query builder + pool)"]
    end

    subgraph Data["PostgreSQL"]
        DB[("users · projects<br/>project_members · tasks")]
    end

    FE -->|"HTTPS / JSON"| RT
    RT --> CT
    CT --> OR
    OR -->|"SQL over pooled TCP"| DB
    DB -->|"rows"| OR
    OR --> CT
    CT -->|"JSON envelope"| FE
```

Every request passes through four checkpoints:

| Layer | Responsibility | What it rejects |
|---|---|---|
| Routes | Method, path, param shape | Unknown routes (404), malformed UUIDs |
| Validation (Zod) | Types, lengths, enums, cross-field rules | Bad payloads (422) with per-field messages |
| Controllers | Business rules, transactions | Cross-row rules, e.g. assignee must be a project member (400) |
| PostgreSQL | NOT NULL, UNIQUE, FK, enum types, CHECK | Anything the layers above missed (409 / 422 via the error mapper) |

The last row is the important one. The database enforces integrity even if a
query arrives from psql, a migration script, or a future service — not just
from this API.

## Entity relationships

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : "owns (cascade delete)"
    USERS ||--o{ PROJECT_MEMBERS : "joins"
    PROJECTS ||--o{ PROJECT_MEMBERS : "has members"
    PROJECTS ||--o{ TASKS : "contains (cascade delete)"
    USERS ||--o{ TASKS : "assigned (set null)"

    USERS {
        uuid id PK
        varchar email UK "unique, lower-case, format checked"
        varchar full_name "not blank"
        enum role "ADMIN | MANAGER | MEMBER"
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    PROJECTS {
        uuid id PK
        varchar name "unique per owner"
        varchar description
        enum status "PLANNING | ACTIVE | ON_HOLD | COMPLETED | ARCHIVED"
        date start_date
        date due_date "due_date >= start_date"
        uuid owner_id FK
    }

    PROJECT_MEMBERS {
        uuid project_id PK_FK
        uuid user_id PK_FK
        enum role "OWNER | MAINTAINER | CONTRIBUTOR | VIEWER"
        timestamptz joined_at
    }

    TASKS {
        uuid id PK
        varchar title "unique per project"
        varchar description
        enum status "TODO | IN_PROGRESS | DONE"
        enum priority "LOW | MEDIUM | HIGH | URGENT"
        timestamptz due_date
        timestamptz completed_at "set iff status = DONE"
        uuid project_id FK "required"
        uuid assignee_id FK "nullable"
    }
```

### Why the delete rules differ

- **User → Project: CASCADE.** A project with no owner is meaningless, so
  deleting the owner removes their projects (and, transitively, those
  projects' tasks).
- **Project → Task: CASCADE.** A task cannot exist outside a project; the
  `project_id` column is `NOT NULL`.
- **User → Task (assignee): SET NULL.** Work outlives the person assigned to
  it. Removing a user un-assigns their tasks rather than deleting history.
- **Project ↔ User membership: CASCADE on both sides.** A membership row is
  meaningless once either side is gone.

## Configuration and secrets

```
.env            ->  git-ignored, holds the real DATABASE_URL
.env.example    ->  committed, placeholder values only
src/config/env  ->  validates every variable at boot, exits on failure
```

No credential appears in source, in `docker-compose.yml`, or in any log line.
Error responses never echo the connection string, and stack traces are
suppressed when `NODE_ENV=production`.

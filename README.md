# Typing Analytics

Typing Analytics is a full-stack web application for typing practice, persistent session history, and the progressive analysis of typing performance.

The project is built as a reproducible TypeScript monorepo with a framework-independent typing domain, a Next.js frontend, a NestJS REST API, PostgreSQL for transactional persistence, MongoDB for validated typing events, and automated validation across unit, component, integration, and end-to-end testing.

## Features

- Dynamic typing targets generated from an approved English word corpus.
- Local typing practice for unauthenticated visitors.
- Email and password authentication.
- Short-lived access tokens with rotating refresh sessions.
- Persistent typing sessions owned by authenticated users.
- Server-side validation of completed typing sessions.
- Durable persistence of validated typing events in MongoDB.
- Private paginated session history.
- Private session detail with the concrete target and persisted metrics.
- Automated unit, component, API integration, and full-stack browser testing.

## Architecture

```text
                         ┌──────────────────────┐
                         │    Next.js / React   │
                         │       Web App        │
                         └──────────┬───────────┘
                                    │
                                    │ REST
                                    ▼
┌──────────────────────┐   ┌──────────────────────┐
│     typing-core      │◄──│     NestJS API       │
│                      │   │                      │
│ typing lifecycle     │   │ auth                 │
│ target generation    │   │ ownership            │
│ metrics              │   │ persistence          │
└──────────┬───────────┘   └──────────┬───────────┘
           ▲                          │
           │                 ┌────────┴────────┐
           │                 ▼                 ▼
           │        ┌────────────────┐ ┌────────────────┐
           └────────│   PostgreSQL   │ │    MongoDB     │
                    │                │ │                │
                    │ sessions       │ │ validated      │
                    │ metrics        │ │ event          │
                    │ outbox         │ │ documents      │
                    └────────────────┘ └────────────────┘
```

`@typing-analytics/typing-core` contains the framework-independent typing domain and is shared by the browser and API.

The browser handles the interactive typing lifecycle locally. For authenticated sessions, the API independently replays the submitted inputs, recalculates the result, and persists only server-validated session data.

PostgreSQL remains the authoritative datastore for authentication, session ownership, completion state, and final metrics. MongoDB stores validated typing event documents associated with individual completed sessions. A PostgreSQL transactional outbox coordinates reliable delivery between both databases.

## Tech stack

| Area                     | Technology                                    |
| ------------------------ | --------------------------------------------- |
| Frontend                 | Next.js, React, TypeScript, Tailwind CSS      |
| Backend                  | NestJS, TypeScript                            |
| Domain                   | Framework-independent TypeScript package      |
| Transactional database   | PostgreSQL                                    |
| Event datastore          | MongoDB                                       |
| ORM                      | Prisma                                        |
| Authentication           | JWT access tokens + rotating refresh sessions |
| Unit / Component testing | Vitest, Testing Library                       |
| API integration testing  | Vitest, Supertest, PostgreSQL, MongoDB        |
| End-to-end testing       | Playwright                                    |
| Local infrastructure     | Docker Compose                                |
| CI                       | GitHub Actions                                |
| Package management       | pnpm workspaces                               |

## Repository structure

```text
.
├── apps/
│   ├── api/                  # NestJS REST API
│   └── web/                  # Next.js application
│
├── packages/
│   └── typing-core/          # Shared typing domain
│
├── .github/
│   └── workflows/            # Continuous Integration
│
├── docs/
│   └── adr/                  # Architecture Decision Records
│
├── compose.yaml              # Local infrastructure and full-stack delivery
├── package.json
└── pnpm-workspace.yaml
```

## Requirements

- Node.js `>=24.21.0 <25`
- pnpm `12.6.0`
- Docker with Docker Compose

## Getting started

Install the workspace dependencies:

```bash
pnpm install
```

Create the local environment files.

PowerShell:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

Unix-like shells:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Start PostgreSQL and MongoDB:

```bash
pnpm db:up
```

Generate Prisma Client and apply the committed migrations:

```bash
pnpm db:generate
pnpm db:migrate:deploy
```

Start the API:

```bash
pnpm dev:api
```

Start the web application in another terminal:

```bash
pnpm dev:web
```

The default local services are:

```text
Web         http://localhost:3000
API         http://localhost:3001
PostgreSQL  localhost:5433
MongoDB     localhost:27017
```

### Full-stack Docker delivery

Alternatively, run the complete application using production containers for Next.js and NestJS, alongside PostgreSQL and MongoDB.

Create a root `.env` file from `.env.example` and configure a unique, cryptographically secure `JWT_ACCESS_SECRET`.

Build and start the application:

```bash
docker compose --profile delivery up -d --build --wait api web
```

The web application is available at `http://localhost:3000`, with the API at `http://localhost:3001`. Committed Prisma migrations are applied before API startup.

Verify the containerized application:

```bash
node scripts/delivery-smoke.mjs
```

Stop the environment without removing persistent database volumes:

```bash
docker compose --profile delivery down
```

Local HTTP delivery is restricted to loopback addresses; external production continues to require HTTPS.

## Authentication and persistence model

Authentication uses:

```text
email + password
        ↓
short-lived access token
        +
rotating refresh credential
        ↓
HttpOnly cookie
        +
server-side refresh session
```

The access token remains in browser memory. The reusable refresh credential is kept outside application JavaScript and can be used to reconstruct the authenticated browser session.

Persistent typing sessions always belong to an authenticated user. Ownership is derived by the server from the authenticated identity and cannot be selected by the client.

Guests can still use the typing application, but their sessions remain local and do not create permanent history.

### Validated typing event persistence

Typing Analytics uses PostgreSQL for authentication, session ownership, and final performance metrics, while MongoDB stores validated typing events for session-level behavioral analysis.

A transactional outbox ensures reliable, recoverable, and idempotent event delivery between both databases without requiring distributed transactions.

For architectural rationale, consistency guarantees, and recovery considerations, see [ADR-001 — MongoDB for Validated Typing Session Events](docs/adr/001-mongodb-session-events.md).

## Application routes

Public routes:

```text
/
/login
/register
```

Authenticated routes:

```text
/dashboard
/history
/history/:id
```

## API overview

### Authentication

| Method | Route            | Purpose                                                  |
| ------ | ---------------- | -------------------------------------------------------- |
| `POST` | `/auth/register` | Create an account                                        |
| `POST` | `/auth/login`    | Authenticate                                             |
| `POST` | `/auth/refresh`  | Rotate the refresh session and obtain a new access token |
| `POST` | `/auth/logout`   | Revoke the current refresh session                       |
| `GET`  | `/auth/me`       | Retrieve the current authenticated identity              |

### Typing sessions

| Method | Route                                 | Purpose                                                              |
| ------ | ------------------------------------- | -------------------------------------------------------------------- |
| `POST` | `/typing-sessions`                    | Create an owned persistent typing session                            |
| `POST` | `/typing-sessions/:id/complete`       | Validate and persist a completed session with durable event delivery |
| `GET`  | `/typing-sessions?page=1&pageSize=20` | List private completed-session history                               |
| `GET`  | `/typing-sessions/:id`                | Retrieve private session detail                                      |

### Historical analytics

| Method | Route                           | Purpose                                                           |
| ------ | ------------------------------- | ----------------------------------------------------------------- |
| `GET`  | `/analytics/overview?range=30d` | Retrieve the authenticated user's historical performance overview |

Supported ranges are `7d`, `30d`, and `all`; the default is `30d`.

Authenticated typing-session and analytics endpoints require an authenticated identity.

### Operational health and readiness

The API exposes two unauthenticated endpoints for operational checks:

| Method | Route           | Purpose                                     |
| ------ | --------------- | ------------------------------------------- |
| `GET`  | `/health/live`  | Check whether the API process is responsive |
| `GET`  | `/health/ready` | Check PostgreSQL and MongoDB availability   |

### Targeted rate protection

The API uses in-memory rate limiting with independent 60-second windows for sensitive endpoints.

| Method | Route                           | Limit     | Tracked by         |
| ------ | ------------------------------- | --------- | ------------------ |
| `POST` | `/auth/register`                | 10/minute | Client IP          |
| `POST` | `/auth/login`                   | 15/minute | Client IP          |
| `POST` | `/auth/refresh`                 | 30/minute | Client IP          |
| `POST` | `/auth/logout`                  | 30/minute | Client IP          |
| `POST` | `/typing-sessions`              | 30/minute | Authenticated user |
| `POST` | `/typing-sessions/:id/complete` | 30/minute | Authenticated user |

Exceeding a limit returns HTTP `429 Too Many Requests`. Invalid requests count toward the limit. Read endpoints and health checks are excluded. Counters are scoped to each API process and reset on restart.

## Validation

Run the standard repository gates from the project root:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The test suite is intentionally split by responsibility instead of using browser E2E for every behavior.

### API / PostgreSQL and MongoDB integration

Create the local integration-test environment file.

PowerShell:

```powershell
Copy-Item apps/api/.env.test.example apps/api/.env.test.local
```

Unix-like shells:

```bash
cp apps/api/.env.test.example apps/api/.env.test.local
```

Start the isolated PostgreSQL and MongoDB services:

```bash
pnpm integration:db:up
```

Apply the committed migrations:

```bash
pnpm integration:db:migrate
```

Run the integration suite:

```bash
pnpm test:integration
```

These tests exercise the real NestJS application against isolated PostgreSQL and MongoDB instances and cover persistence, authentication, ownership, authorization, completion, durable event delivery, recovery, and private-history behavior.

### Authenticated full-stack E2E

The first multi-layer E2E journey uses Playwright with dedicated PostgreSQL and MongoDB environments.

Install Chromium once:

```bash
pnpm --filter @typing-analytics/web exec playwright install chromium
```

Run the complete E2E procedure:

```bash
pnpm test:e2e
```

The command recreates the isolated E2E datastores, applies the committed Prisma migrations to PostgreSQL, starts the real NestJS API and Next.js application, and executes the Playwright suite in Chromium.

The journey verifies:

```text
register
→ logout
→ login
→ generated typing test
→ complete and persist
→ private history
→ session detail
```

The test uses the real target returned by persistent-session creation, types it through the browser, and verifies that the resulting session appears in private history with the same concrete target.

No pre-existing user or session data is required.

Run the journey with a visible browser:

```bash
pnpm test:e2e:headed
```

Remove the isolated E2E databases when desired:

```bash
pnpm e2e:db:down
```

## Database development

Prisma migrations are the authoritative PostgreSQL database-evolution mechanism.

Validate the schema:

```bash
pnpm db:validate
```

Create a development migration after an approved schema change:

```bash
pnpm db:migrate --name <migration-name>
```

Reset the local development databases when necessary:

```bash
pnpm db:reset
```

> `pnpm db:reset` removes the local PostgreSQL and MongoDB development volumes.

## Continuous Integration

GitHub Actions validates pull requests and pushes to `main`.

The pipeline contains three complementary gates:

```text
Validate
├── formatting
├── lint
├── typecheck
├── unit / component tests
└── build

API / PostgreSQL + MongoDB Integration
├── ephemeral PostgreSQL and MongoDB
├── committed migrations
└── NestJS integration tests

Authenticated Full-Stack E2E
├── isolated PostgreSQL and MongoDB
├── committed migrations
├── NestJS API
├── Next.js application
└── Chromium / Playwright
```

The full-stack E2E job uses the same `pnpm test:e2e` entry point available for local development.

## Project status

Current development stage: **v0.7.0 — Reproducible Delivery (in progress)**
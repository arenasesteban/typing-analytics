# Typing Analytics

Typing Analytics is a full-stack web application for typing practice, persistent session history, and the progressive analysis of typing performance.

The project is built as a reproducible TypeScript monorepo with a framework-independent typing domain, a Next.js frontend, a NestJS REST API, PostgreSQL persistence, and automated validation across unit, component, integration, and end-to-end testing.

## Features

- Dynamic typing targets generated from an approved English word corpus.
- Local typing practice for unauthenticated visitors.
- Email and password authentication.
- Short-lived access tokens with rotating refresh sessions.
- Persistent typing sessions owned by authenticated users.
- Server-side validation of completed typing sessions.
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
└──────────┬───────────┘   └───────────┬──────────┘
           ▲                           │
           │                           ▼
           │                  ┌──────────────────────┐
           └──────────────────│     PostgreSQL       │
                              └──────────────────────┘
```

`@typing-analytics/typing-core` contains the framework-independent typing domain and is shared by the browser and API.

The browser handles the interactive typing lifecycle locally. For authenticated sessions, the API independently replays the submitted inputs, recalculates the result, and persists only server-validated session data.

## Tech stack

| Area                     | Technology                                    |
| ------------------------ | --------------------------------------------- |
| Frontend                 | Next.js, React, TypeScript, Tailwind CSS      |
| Backend                  | NestJS, TypeScript                            |
| Domain                   | Framework-independent TypeScript package      |
| Database                 | PostgreSQL                                    |
| ORM                      | Prisma                                        |
| Authentication           | JWT access tokens + rotating refresh sessions |
| Unit / Component testing | Vitest, Testing Library                       |
| API integration testing  | Vitest, Supertest, PostgreSQL                 |
| End-to-end testing       | Playwright                                    |
| Local infrastructure     | Docker Compose                                |
| CI                       | GitHub Actions                                |
| Package management       | pnpm workspaces                               |

## Repository structure

```text
.
├── apps/
│   ├── api/                  # NestJS REST API
│   └── web/                  # Next.js application and Playwright E2E
│
├── packages/
│   └── typing-core/          # Shared typing domain
│
├── .github/
│   └── workflows/            # Continuous Integration
│
├── compose.yaml              # Local PostgreSQL environments
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

Start PostgreSQL:

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
Web    http://localhost:3000
API    http://localhost:3001
DB     localhost:5433
```

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

## Application routes

Public routes:

```text
/
/login
/register
```

Authenticated routes:

```text
/history
/history/:id
```

`/history` provides the authenticated user's completed sessions using server-controlled pagination.

`/history/:id` displays the concrete typing target, metrics, input counts, and timestamps stored for an accessible completed session.

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

| Method | Route                                 | Purpose                                   |
| ------ | ------------------------------------- | ----------------------------------------- |
| `POST` | `/typing-sessions`                    | Create an owned persistent typing session |
| `POST` | `/typing-sessions/:id/complete`       | Validate and persist a completed session  |
| `GET`  | `/typing-sessions?page=1&pageSize=20` | List private completed-session history    |
| `GET`  | `/typing-sessions/:id`                | Retrieve private session detail           |

Persistent typing-session endpoints require an authenticated identity.

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

### API / PostgreSQL integration

Create the local integration-test environment file.

PowerShell:

```powershell
Copy-Item apps/api/.env.test.example apps/api/.env.test.local
```

Unix-like shells:

```bash
cp apps/api/.env.test.example apps/api/.env.test.local
```

Start the isolated PostgreSQL service:

```bash
docker compose --profile test up -d postgres-test
```

Apply the committed migrations:

```bash
pnpm --filter @typing-analytics/api prisma:migrate:test
```

Run the integration suite:

```bash
pnpm --filter @typing-analytics/api test:integration
```

These tests exercise the real NestJS application against isolated PostgreSQL and cover persistence, authentication, ownership, authorization, completion, and private-history behavior.

### Authenticated full-stack E2E

The first multi-layer E2E journey uses Playwright with a dedicated PostgreSQL environment.

Install Chromium once:

```bash
pnpm --filter @typing-analytics/web exec playwright install chromium
```

Run the complete E2E procedure:

```bash
pnpm test:e2e
```

The command recreates the isolated E2E database, applies the committed Prisma migrations, starts the real NestJS API and Next.js application, and executes the Playwright suite in Chromium.

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

Remove the isolated E2E database when desired:

```bash
pnpm e2e:db:down
```

## Database development

Prisma migrations are the authoritative database-evolution mechanism.

Validate the schema:

```bash
pnpm --filter @typing-analytics/api prisma:validate
```

Create a development migration after an approved schema change:

```bash
pnpm --filter @typing-analytics/api exec prisma migrate dev --name <migration-name>
```

Reset the local development database when necessary:

```bash
pnpm db:reset
```

> `pnpm db:reset` removes the local PostgreSQL development volume.

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

API / PostgreSQL Integration
├── ephemeral PostgreSQL
├── committed migrations
└── NestJS integration tests

Authenticated Full-Stack E2E
├── isolated PostgreSQL
├── committed migrations
├── NestJS API
├── Next.js application
└── Chromium / Playwright
```

The full-stack E2E job uses the same `pnpm test:e2e` entry point available for local development.

## Project status

Current development milestone:

**v0.3.0 — Identity & Private History**

At this stage the project includes:

- dynamic typing-target generation;
- local guest practice;
- email/password identity and secure browser authentication;
- authenticated persistent sessions;
- server-enforced session ownership;
- private paginated history;
- private session detail;
- full-stack authenticated E2E validation across Next.js, NestJS, and PostgreSQL.

The project is intentionally developed through incremental vertical slices. Functionality and infrastructure are introduced when a real product capability requires them rather than being added speculatively.

Behavioral event analytics, richer historical analysis, application containerization, and cloud infrastructure remain outside the currently implemented scope.

# Typing Analytics

Typing Analytics is a web platform for typing practice and behavioral performance analysis.

The current development baseline contains a Next.js web application, a NestJS API, an independent TypeScript typing core, and a reproducible local PostgreSQL database.

## Requirements

- Node.js 24.21.0
- pnpm 12.6.0
- Docker with Docker Compose

## Repository structure

```text
apps/
├── web/                 Next.js application
└── api/                 NestJS REST API

packages/
└── typing-core/         Framework-independent TypeScript domain package

compose.yaml             Local PostgreSQL infrastructure
```

## Installation

```bash
pnpm install
```

Create the local API environment file from the provided example.

PowerShell:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
```

Unix-like shells:

```bash
cp apps/api/.env.example apps/api/.env
```

Create the local web environment file from the provided example.

PowerShell:

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
```

Unix-like shells:

```bash
cp apps/web/.env.example apps/web/.env.local
```

The web application uses `NEXT_PUBLIC_API_BASE_URL` to reach the REST API.

The API uses `WEB_ORIGIN` to allow the configured browser origin.

Authentication configuration additionally requires:

```text
JWT_ACCESS_SECRET
JWT_ACCESS_TTL_SECONDS
REFRESH_TOKEN_TTL_DAYS
```

`JWT_ACCESS_SECRET` must contain at least 32 bytes and must not be committed with a real deployment secret.

Access tokens are short-lived bearer tokens. Renewable authentication uses a rotating opaque refresh credential delivered through an `HttpOnly` cookie; only its cryptographic hash is persisted.

Generate Prisma Client:

```bash
pnpm db:generate
```

## PostgreSQL

Start PostgreSQL:

```bash
pnpm db:up
```

Stop PostgreSQL:

```bash
pnpm db:down
```

Apply committed migrations:

```bash
pnpm db:migrate:deploy
```

Reset the local PostgreSQL volume:

```bash
pnpm db:reset
```

The reset command deletes the local development database volume.

## Development

Web application:

```bash
pnpm dev:web
```

API:

```bash
pnpm dev:api
```

The default local ports are:

```text
Web: http://localhost:3000
API: http://localhost:3001
```

The web authentication routes are:

```text
/login
/register
```

Browser authentication keeps the short-lived access token only in React memory. Session recovery uses the rotating refresh credential stored in the API-managed `HttpOnly` cookie and then loads the current identity through `GET /auth/me`.

No password, refresh credential, or reusable authentication secret is persisted in `localStorage` or `sessionStorage`.

The API exposes:

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me

POST /typing-sessions
POST /typing-sessions/:id/complete
```

Unauthenticated visitors practice locally: the browser generates the typing target through `@typing-analytics/typing-core`, executes the complete typing session locally, and does not create permanent session rows.

Authenticated users use the persistent lifecycle. The browser creates an owned server session using its short-lived access token, processes each keystroke locally through `typing-core`, and sends one replayable input batch when the session completes.

## Database development

Validate the Prisma schema:

```bash
pnpm --filter @typing-analytics/api prisma:validate
```

Create a development migration after an approved schema change:

```bash
pnpm --filter @typing-analytics/api exec prisma migrate dev --name <migration-name>
```

The authenticated-ownership migration removes legacy anonymous `typing_sessions` before introducing the mandatory `user_id` foreign key. Pre-authentication sessions cannot be truthfully assigned to existing accounts and are intentionally not migrated to arbitrary users.

## Validation

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

### API/PostgreSQL integration tests

Create the local integration environment file:

```powershell
Copy-Item apps/api/.env.test.example apps/api/.env.test.local
```

Start the isolated PostgreSQL test service:

```bash
docker compose --profile test up -d postgres-test
```

Apply committed migrations:

```bash
pnpm --filter @typing-analytics/api prisma:migrate:test
```

Run integration tests:

```bash
pnpm --filter @typing-analytics/api test:integration
```

## API

### Authentication

#### Register

```http
POST /auth/register
```

Example request:

```json
{
    "email": "user@example.com",
    "password": "example-password"
}
```

A successful registration returns `201 Created` with the short-lived access token and current user identity.

A rotating refresh credential is delivered through an `HttpOnly` cookie.

#### Login

```http
POST /auth/login
```

Valid credentials return `200 OK` with a short-lived access token and a new refresh credential.

Invalid credentials are rejected with `401 Unauthorized`.

#### Refresh

```http
POST /auth/refresh
```

Uses the refresh cookie to rotate the renewable credential and issue a new access token.

Reused, revoked, expired, or invalid refresh credentials are rejected with `401 Unauthorized`.

#### Logout

```http
POST /auth/logout
```

Revokes the corresponding renewable session and clears the refresh cookie.

A successful logout returns `204 No Content`.

#### Current identity

```http
GET /auth/me
Authorization: Bearer <access-token>
```

Returns the authenticated user identity.

Missing, expired, or invalid access tokens are rejected with `401 Unauthorized`.

### Create an authenticated typing session

```http
POST /typing-sessions
Authorization: Bearer <access-token>
```

Creates a new persistent typing session owned by the authenticated user using a target generated from the approved English word corpus.

Ownership is always derived from the authenticated server context. The request does not accept a client-provided `userId`, session identifier, or target text.

Unauthenticated creation is rejected with `401 Unauthorized`.

Successful response:

```json
{
    "id": "<server-generated-session-id>",
    "typingText": {
        "id": "<persisted-text-id>",
        "text": "<target-text>"
    }
}
```

The endpoint returns `201 Created`.

The concrete generated target is persisted in `typing_texts` and associated with the new session.

Target generation runs for every authenticated session creation. Generated targets are not required to be globally unique; if the same concrete text is generated again, the existing `typing_texts` row may be reused.

Unexpected request data, including client-controlled ownership data, is rejected with `400 Bad Request`.

### Complete an authenticated typing session

```http
POST /typing-sessions/:id/complete
Authorization: Bearer <access-token>
```

Only the authenticated owner can complete the persistent session. The server derives ownership from the access token and never from client-provided identity data.

A session belonging to another user is not addressable through identifier manipulation and is returned as not found.

Example request:

```json
{
    "inputs": [
        {
            "type": "insert",
            "value": "t",
            "timestampMs": 1000
        }
    ]
}
```

The server replays the inputs through `@typing-analytics/typing-core`, recalculates the session metrics, and persists the validated result.

Client-provided derived metrics are not accepted.

A successful completion returns `200 OK`.

Relevant errors include:

- `400 Bad Request` for invalid session data or interactions.
- `401 Unauthorized` when a valid authenticated identity is not provided.
- `404 Not Found` when the session does not exist or does not belong to the authenticated user.
- `409 Conflict` when the session has already been completed.
- `413 Payload Too Large` when the input limit is exceeded.

## Continuous Integration

GitHub Actions validates pull requests and pushes to `main`.

The general validation job runs formatting checks, linting, typechecking, unit/component tests, and workspace builds.

A separate API/PostgreSQL integration job provisions an ephemeral PostgreSQL instance, applies all committed Prisma migrations from an empty database, and runs the API integration suite against that database.

The CI database uses disposable test-only credentials defined in the workflow. No local environment file, permanent database credential, or application secret is required by CI.

## Current scope

Development is currently progressing through v0.3.0 — Identity & Private History.

The repository now provides dynamic typing targets, email/password authentication, browser session recovery, and authenticated ownership of persistent typing sessions.

Authenticated users create and complete server-persisted sessions owned by their identity. Guests continue to practice locally without creating permanent history rows.

Private paginated history, session-detail views, behavioral analytics, multi-layer browser E2E, application containers, and cloud infrastructure remain outside the currently implemented scope.

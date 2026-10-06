# Typing Analytics

Typing Analytics is a web platform for typing practice and behavioral performance analysis.

The current development baseline contains a Next.js web application, a NestJS REST API, an independent TypeScript typing core, and a reproducible local PostgreSQL database.

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

Install workspace dependencies:

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

Persistent typing sessions belong to authenticated users. Legacy anonymous development sessions from the pre-authentication model are not assigned retrospectively to accounts.

The private-history query is backed by a database index aligned with authenticated ownership and reverse-chronological completed-session retrieval.

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

### Authentication API

The authentication API exposes:

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
```

Authentication uses email and password credentials, short-lived access tokens, and rotating refresh credentials.

The reusable refresh credential is delivered through an `HttpOnly` cookie and is not exposed to application JavaScript. Refresh-session state is maintained server-side.

The web application keeps the access token in memory and can reconstruct browser authentication state through the refresh flow.

### Typing-session API

The authenticated persistent typing-session API exposes:

```text
POST /typing-sessions
POST /typing-sessions/:id/complete
GET  /typing-sessions?page=1&pageSize=20
GET  /typing-sessions/:id
```

Authenticated users create server-persisted typing sessions owned by their identity.

The server derives ownership exclusively from the authenticated access token. Clients do not provide or control a `userId`.

Each new persistent session receives a concrete target generated from the approved English word corpus through `@typing-analytics/typing-core`.

The browser processes keystrokes locally through `typing-core` and sends one replayable input batch when an authenticated session completes. The API replays those inputs independently, recalculates the metrics, and persists the validated result.

Unauthenticated visitors use a fully local practice lifecycle. Their targets are generated through `typing-core`, their results are calculated locally, and no persistent typing-session rows are created.

### Web routes

The public authentication routes are:

```text
/login
/register
```

The authenticated private-history routes are:

```text
/history
/history/:id
```

Both private-history routes are protected by the browser authentication state.

`/history` renders the authenticated user's server-paginated completed-session history.

`/history/:id` displays the concrete typing target, persisted metrics, and timestamps for an accessible completed session.

Missing or inaccessible session details are represented without exposing whether a resource belongs to another account.

## Database development

Validate the Prisma schema:

```bash
pnpm --filter @typing-analytics/api prisma:validate
```

Create a development migration after an approved schema change:

```bash
pnpm --filter @typing-analytics/api exec prisma migrate dev --name <migration-name>
```

Committed migrations are the authoritative schema evolution path and must remain reproducible from an empty database.

## Validation

Run the general repository validation:

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

Run API integration tests:

```bash
pnpm --filter @typing-analytics/api test:integration
```

Integration tests exercise the real NestJS application against isolated PostgreSQL and cover persistence, authentication, ownership, authorization, session completion, and private history behavior.

## API

### Register

```http
POST /auth/register
```

Creates a new account from an email address and password.

Emails are normalized before persistence.

Passwords are stored only through secure password hashing and are never persisted in plaintext.

Successful registration establishes an authenticated browser session.

Relevant errors include:

- `400 Bad Request` for invalid registration data.
- `409 Conflict` when the normalized email already exists.

### Login

```http
POST /auth/login
```

Authenticates an existing user from email and password credentials.

Successful login returns a short-lived access token and establishes the rotating refresh credential through an `HttpOnly` cookie.

Invalid credentials return a generic authentication failure without disclosing whether a particular email exists.

### Refresh authentication

```http
POST /auth/refresh
```

Rotates the current refresh credential and returns a new short-lived access token.

Consumed, revoked, expired, or otherwise invalid refresh credentials are rejected.

### Logout

```http
POST /auth/logout
```

Revokes the current renewable browser session and clears the refresh cookie.

### Current identity

```http
GET /auth/me
Authorization: Bearer <access-token>
```

Returns the identity represented by a valid access token.

Unauthenticated requests are rejected with `401 Unauthorized`.

### Create an authenticated typing session

```http
POST /typing-sessions
Authorization: Bearer <access-token>
```

Creates a new persistent typing session owned by the authenticated user.

The API generates the target from the approved English word corpus and persists the concrete generated text in `typing_texts`.

Ownership is always derived from authenticated server context.

The request does not accept:

- a client-provided `userId`;
- a client-generated session identifier;
- arbitrary client-provided target text.

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

Target generation runs for every new session creation. Generated targets are not required to be globally unique; when the same concrete text is generated again, the existing `typing_texts` row may be reused.

Relevant errors include:

- `400 Bad Request` for unexpected request data.
- `401 Unauthorized` when no valid authenticated identity is provided.

### Complete an authenticated typing session

```http
POST /typing-sessions/:id/complete
Authorization: Bearer <access-token>
```

Completes an existing persistent typing session owned by the authenticated user from its serialized typing inputs.

Request body:

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

Ownership is enforced by the server. Changing the session identifier cannot grant access to another user's session.

A successful completion returns `200 OK`.

Relevant errors include:

- `400 Bad Request` for invalid session data or interactions.
- `401 Unauthorized` when no valid authenticated identity is provided.
- `404 Not Found` when the session is missing or is not addressable by the authenticated user.
- `409 Conflict` when the session has already been completed.
- `413 Payload Too Large` when the input limit is exceeded.

### List private typing session history

```http
GET /typing-sessions?page=1&pageSize=20
Authorization: Bearer <access-token>
```

Returns only completed persistent sessions owned by the authenticated user.

Pagination is controlled by the server through positive integer `page` and `pageSize` parameters.

Defaults:

```text
page=1
pageSize=20
```

`pageSize` cannot exceed `100`.

History is returned in deterministic reverse-chronological order by completion time, with the session identifier used as the final ordering tie-breaker.

Successful response:

```json
{
    "items": [
        {
            "id": "<session-id>",
            "durationMs": 60000,
            "wpm": 50,
            "rawWpm": 55,
            "accuracy": 95,
            "consistency": 90,
            "totalInputs": 100,
            "correctInputs": 95,
            "incorrectInputs": 5,
            "startedAt": "2026-10-05T17:59:00.000Z",
            "completedAt": "2026-10-05T18:00:00.000Z"
        }
    ],
    "pagination": {
        "page": 1,
        "pageSize": 20,
        "totalItems": 1,
        "totalPages": 1
    }
}
```

Incomplete sessions and sessions belonging to other users are not included.

A valid page beyond the available data returns an empty `items` collection with the requested pagination metadata.

Relevant errors include:

- `400 Bad Request` for invalid pagination parameters.
- `401 Unauthorized` when no valid authenticated identity is provided.

### Get private typing session detail

```http
GET /typing-sessions/:id
Authorization: Bearer <access-token>
```

Returns an owned completed session together with its concrete typing target, persisted metrics, and timestamps.

Successful response:

```json
{
    "id": "<session-id>",
    "typingText": {
        "id": "<typing-text-id>",
        "text": "<concrete-target-text>"
    },
    "durationMs": 60000,
    "wpm": 50,
    "rawWpm": 55,
    "accuracy": 95,
    "consistency": 90,
    "totalInputs": 100,
    "correctInputs": 95,
    "incorrectInputs": 5,
    "startedAt": "2026-10-05T17:59:00.000Z",
    "completedAt": "2026-10-05T18:00:00.000Z"
}
```

The resource is owner-scoped directly by the server query.

A missing session, an incomplete session, or a completed session belonging to another user is returned as `404 Not Found`.

Changing the URL identifier cannot expose another user's session.

## Continuous Integration

GitHub Actions validates pull requests and pushes to `main`.

The general validation job runs:

- formatting checks;
- linting;
- typechecking;
- unit and component tests;
- workspace builds.

A separate API/PostgreSQL integration job provisions an ephemeral PostgreSQL instance, applies all committed Prisma migrations from an empty database, and runs the API integration suite against that database.

The CI database uses disposable test-only credentials defined in the workflow.

No local environment file, permanent database credential, or application secret is required by CI.

## Current scope

Development is currently progressing through v0.3.0 — Identity & Private History.

The repository now provides dynamic typing targets, email/password authentication, browser session recovery, authenticated ownership of persistent typing sessions, an owner-scoped paginated history API, and protected web views for browsing completed sessions and opening their detail.

Authenticated users can persist typing tests, browse their completed history, navigate server-provided pages, and inspect the concrete target and persisted metrics of their own sessions. Guests continue to practice locally without creating permanent history rows.

Behavioral analytics, multi-layer browser E2E, application containers, and cloud infrastructure remain outside the currently implemented scope.

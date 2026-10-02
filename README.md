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

The persistent typing-session API exposes:

```text
POST /typing-sessions
POST /typing-sessions/:id/complete
```

The browser creates a persistent session before typing, processes each keystroke locally through `typing-core`, and sends one replayable input batch when the local session completes.

## Database development

Validate the Prisma schema:

```bash
pnpm --filter @typing-analytics/api prisma:validate
```

Create a development migration after an approved schema change:

```bash
pnpm --filter @typing-analytics/api exec prisma migrate dev --name <migration-name>
```

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

### Create a typing session

```http
POST /typing-sessions
```

Creates a new server-owned persistent typing session.

The request does not accept client-generated session identifiers or arbitrary target text.

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

Unexpected request data is rejected with `400 Bad Request`.

### Complete a typing session

```http
POST /typing-sessions/:id/complete
```

Completes an existing persistent typing session from its serialized typing inputs.

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

The server replays the inputs through `@typing-analytics/typing-core`, recalculates the session metrics and persists the validated result.

Client-provided derived metrics are not accepted.
A successful completion returns `200 OK`.

Relevant errors include:

- `400 Bad Request` for invalid session data or interactions.
- `404 Not Found` when the session does not exist.
- `409 Conflict` when the session has already been completed.
- `413 Payload Too Large` when the input limit is exceeded.

## Current scope

Development is currently progressing through v0.2.0 — Persistent Sessions.

The browser obtains the persistent session identifier and target text from the API. Typing remains local per keystroke through `typing-core`, while completion is replayed and validated by the server before the persisted result is shown.

Authentication, ownership, private history, behavioral analytics, multi-layer browser E2E, application containers, and cloud infrastructure remain outside the current scope.

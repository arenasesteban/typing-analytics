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

compose.yaml       Local PostgreSQL infrastructure
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

The API persistence baseline does not expose product endpoints yet.

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

API/PostgreSQL integration:

```bash
pnpm --filter @typing-analytics/api test:integration
```

## Current scope

Development is currently progressing through v0.2.0 — Persistent Sessions.

The repository now provides the backend and PostgreSQL persistence baseline required for persistent typing sessions.

Session creation, session completion, authentication, private history, behavioral analytics, application containers, and cloud infrastructure are outside the current baseline.

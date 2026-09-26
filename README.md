# Typing Analytics

Typing Analytics is a web platform for typing practice and behavioral performance analysis.

The current development baseline contains a Next.js web application and an independent TypeScript typing core inside a pnpm workspace.

## Requirements

- Node.js 24.21.0
- pnpm 12.6.0

## Repository structure

```text
apps/
└── web/                 Next.js application

packages/
└── typing-core/         Framework-independent TypeScript domain package
```

## Installation

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

The web application run locally through Next.js.

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Current scope

The current version is v0.1.0 — Local Typing Test.

The initial baseline does not include an API, database, authentication, Docker application images, or cloud infrastructure.

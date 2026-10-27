# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:24.21.0-bookworm-slim

# ------------------------------------------------------------
# Base: pinned Node.js, pnpm and runtime system libraries
# ------------------------------------------------------------
FROM ${NODE_IMAGE} AS base

ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"

RUN npm install --global pnpm@12.6.0 \
    && apt-get update \
    && apt-get install --yes --no-install-recommends \
       ca-certificates \
       openssl \
    && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------
# Builder: install from lockfile and compile the existing API
# ------------------------------------------------------------
FROM base AS builder

WORKDIR /workspace

# Copy manifests before source files for dependency caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/typing-core/package.json ./packages/typing-core/package.json
COPY packages/eslint-config/package.json ./packages/eslint-config/package.json

RUN pnpm install --frozen-lockfile --filter @typing-analytics/api...

# Copy only the API and its shared domain package.
COPY apps/api ./apps/api
COPY packages/typing-core ./packages/typing-core

# The existing API prebuild generates Prisma Client.
# Nest CLI builds the application using its Rspack configuration.
RUN pnpm --filter @typing-analytics/api build \
    && test -f apps/api/dist/main.js

# Create two isolated dependency trees:
# - runtime: production dependencies only
# - migrations: Prisma CLI and its required dependencies
RUN pnpm --filter @typing-analytics/api --prod deploy /delivery/runtime \
    && pnpm --filter @typing-analytics/api deploy /delivery/migrations

# ------------------------------------------------------------
# Runtime: minimal production application
# ------------------------------------------------------------
FROM base AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3001

COPY --from=builder --chown=node:node \
    /delivery/runtime/node_modules ./node_modules

COPY --from=builder --chown=node:node \
    /workspace/apps/api/dist ./dist

COPY --from=builder --chown=node:node \
    /workspace/apps/api/package.json ./package.json

USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s \
    --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '3001') + '/health/live').then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1));"

CMD ["node", "dist/main.js"]

# ------------------------------------------------------------
# Migrations: explicit, one-off Prisma migration runner
# ------------------------------------------------------------
FROM base AS migrate

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder --chown=node:node \
    /delivery/migrations/node_modules ./node_modules

COPY --from=builder --chown=node:node \
    /workspace/apps/api/package.json ./package.json

COPY --from=builder --chown=node:node \
    /workspace/apps/api/prisma7.config.ts ./prisma7.config.ts

COPY --from=builder --chown=node:node \
    /workspace/apps/api/prisma ./prisma

USER node

ENTRYPOINT ["./node_modules/.bin/prisma", "migrate", "deploy", "--config", "prisma7.config.ts"]
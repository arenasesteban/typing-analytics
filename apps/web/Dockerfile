# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:24.21.0-bookworm-slim

# ------------------------------------------------------------
# Builder: install workspace dependencies and build Next.js
# ------------------------------------------------------------
FROM ${NODE_IMAGE} AS builder

WORKDIR /workspace

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm install --global pnpm@12.6.0

# Copy workspace manifests first to keep dependency layers reusable.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY packages/typing-core/package.json ./packages/typing-core/package.json
COPY packages/eslint-config/package.json ./packages/eslint-config/package.json

# Install strictly from the committed lockfile.
RUN pnpm install --frozen-lockfile --filter @typing-analytics/web...

# Copy only the web application and its shared domain package.
COPY apps/web ./apps/web
COPY packages/typing-core ./packages/typing-core

# Public browser configuration is selected at build time.
ARG NEXT_PUBLIC_API_BASE_URL
ARG LOCAL_CONTAINER_DELIVERY=false

# Next.js validates the delivery configuration during the build.
RUN pnpm --filter @typing-analytics/web build \
    && test -f apps/web/.next/standalone/apps/web/server.js \
    && test -d apps/web/.next/static \
    && mkdir -p apps/web/public

# ------------------------------------------------------------
# Runtime: minimal standalone production server
# ------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# Includes the traced runtime files and standalone server.
COPY --from=builder --chown=node:node \
    /workspace/apps/web/.next/standalone ./

# Standalone output does not include static/public assets by default.
COPY --from=builder --chown=node:node \
    /workspace/apps/web/.next/static ./apps/web/.next/static

COPY --from=builder --chown=node:node \
    /workspace/apps/web/public ./apps/web/public

# Allow Next.js to write its runtime cache as the unprivileged user.
RUN mkdir -p /app/apps/web/.next/cache \
    && chown -R node:node /app/apps/web/.next

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s \
    --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '3000') + '/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "apps/web/server.js"]
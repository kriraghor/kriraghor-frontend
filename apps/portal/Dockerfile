# syntax=docker/dockerfile:1.7
# Next.js standalone image (ADR-003) for apps/portal. One image for every environment: public config is
# served at runtime from /env.js, so nothing environment-specific is baked in at build time.
#
# Build context: the repo root (npm workspaces), so the shared packages/* are available:
#   docker build -f apps/portal/Dockerfile .
#
# Build stages use the full Node image; the runtime is distroless Node 24 (Debian 13): no shell,
# no npm and no package manager, so the CI Trivy gate (fixable HIGH/CRITICAL) has nothing to flag.
# Pinned by digest; bump it when Trivy or Dependabot reports a newer base.
ARG NODE_IMAGE=node:24.16.0-bookworm-slim
ARG RUNTIME_IMAGE=gcr.io/distroless/nodejs24-debian13:nonroot@sha256:9eeb7f5887d0e239e78264b06f7f11d2e14be534050481803a9e4728fcdd278e

FROM ${NODE_IMAGE} AS deps
WORKDIR /repo
# Every workspace manifest (npm ci checks them against the one lock file), then only this app's install.
COPY package.json package-lock.json ./
COPY packages/config/package.json packages/config/
COPY packages/session/package.json packages/session/
COPY packages/api-client/package.json packages/api-client/
COPY packages/ui/package.json packages/ui/
COPY apps/web/package.json apps/web/
COPY apps/esports/package.json apps/esports/
COPY apps/portal/package.json apps/portal/
RUN npm ci --no-audit --no-fund -w apps/portal

FROM ${NODE_IMAGE} AS build
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /repo ./
COPY packages ./packages
COPY apps/portal ./apps/portal
RUN npm run build -w apps/portal

FROM ${RUNTIME_IMAGE} AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
# The standalone output mirrors the repo: the server is apps/portal/server.js next to a pruned node_modules.
COPY --from=build --chown=1000:1000 /repo/apps/portal/.next/standalone ./
COPY --from=build --chown=1000:1000 /repo/apps/portal/.next/static ./apps/portal/.next/static
COPY --from=build --chown=1000:1000 /repo/apps/portal/public ./apps/portal/public
# Non-root (uid 1000, matching the chart's runAsUser). The chart mounts emptyDirs at /tmp and
# /app/apps/portal/.next/cache; the rest of the filesystem is read-only.
USER 1000
EXPOSE 3000
# The distroless entrypoint is node itself.
CMD ["apps/portal/server.js"]

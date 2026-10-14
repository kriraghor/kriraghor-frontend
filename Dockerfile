# syntax=docker/dockerfile:1.7
# Next.js standalone image (ADR-003). One image for every environment: public config is served at
# runtime from /env.js, so nothing environment-specific is baked in at build time.
#
# Build stages use the full Node image; the runtime is distroless Node 24 (Debian 13): no shell,
# no npm and no package manager, so the CI Trivy gate (fixable HIGH/CRITICAL) has nothing to flag.
# Pinned by digest; bump it when Trivy or Dependabot reports a newer base.
ARG NODE_IMAGE=node:24.16.0-bookworm-slim
ARG RUNTIME_IMAGE=gcr.io/distroless/nodejs24-debian13:nonroot@sha256:9eeb7f5887d0e239e78264b06f7f11d2e14be534050481803a9e4728fcdd278e

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM ${RUNTIME_IMAGE} AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=1000:1000 /app/.next/standalone ./
COPY --from=build --chown=1000:1000 /app/.next/static ./.next/static
COPY --from=build --chown=1000:1000 /app/public ./public
# Non-root (uid 1000, matching the chart's runAsUser). The chart mounts emptyDirs at /tmp and
# /app/.next/cache; the rest of the filesystem is read-only.
USER 1000
EXPOSE 3000
# The distroless entrypoint is node itself.
CMD ["server.js"]

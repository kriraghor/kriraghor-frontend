# Kriraghor Web (kriraghor.com)

| | |
|---|---|
| **Repo** | `kriraghor-web` |
| **Domain** | kriraghor.com (dev: http://localhost:3000, k3d: http://kriraghor.localhost) |
| **Status** | 0B scaffold: sign-in (phone OTP, email OTP, password, Google), `/me`, placeholders for `/grounds`, `/hiring`, `/shop`, `/gym` |
| **Specs** | [`../kriraghor-docs`](../kriraghor-docs/README.md) · design: [`home-v3`](../kriraghor-docs/design/home-v3/README.md) |
| **Decisions** | [ADR-002 contracts](../kriraghor-docs/decisions/ADR-002-polyrepo-api-contracts.md), [ADR-003 runtime config](../kriraghor-docs/decisions/ADR-003-kubernetes-deployment.md),[ADR-004 SSO](../kriraghor-docs/decisions/ADR-004-cross-subdomain-auth.md) |

## Stack
Next.js 16 (App Router, Cache Components, `output: 'standalone'`), TypeScript strict, Tailwind v4 with the Kriraghor tokens (`src/app/globals.css`), next-intl (en, bn), TanStack Query, openapi-fetch with types generated from the backend, Vitest, Playwright.

## Run locally

```bash
cp .env.example .env.local      #  defaults point at the backend on localhost:4000
npm install
npm run dev                     # http://localhost:3000
```

The backend must be running (`npm run dev` in `../kriraghor-backend`) with `CORS_ORIGINS` including `http://localhost:3000`.

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js on port 3000 |
| `npm run lint` · `npm run typecheck` | ESLint, `next typegen` + `tsc` |
| `npm test` | Vitest unit tests (session, refresh, CSRF header, runtime env) |
| `npm run test:e2e` | Playwright smoke against `next start` (or `BASE_URL=http://kriraghor.localhost`) |
| `npm run api:sync` | Regenerate `src/lib/api/schema.d.ts` from `../kriraghor-backend/openapi.json` (or `API_SPEC=<url>`) |

## How it works

- **Runtime config (ADR-003):** one image for every environment. `/env.js` serves `window.__ENV` from the pod's env (`API_URL`, `REALTIME_URL`, `COOKIE_PREFIX`, `GOOGLE_CLIENT_ID`, …; allow-list in `src/lib/env.ts`). Never put a secret there.
- **Sessions (ADR-004):** the access token lives in memory only. On load, if the `kg_si` hint cookie exists, the app calls `POST /auth/refresh` with `credentials: 'include'` and `X-CSRF-Token` from the `kg_csrf` cookie. The refresh cookie is httpOnly on the API host, so signing in on esports also signs you in here.
- **API client:** `api().GET('/me')` is fully typed from the backend's OpenAPI document. A 401 with `TOKEN_EXPIRED` or `AUTHZ_STALE` refreshes once and retries.
- **Locales:** `en` and `bn`, no URL prefix (cookie `NEXT_LOCALE`); pages are prerendered per locale. Switch `localePrefix` to `"as-needed"` in `src/i18n/routing.ts` when Bangla pages need their own URLs.
- **Shared code** (`src/lib`, `src/components`) is copied in web, esports and portal for now (ADR-002 defers a shared package).

##  Container

```bash
docker build -t kriraghor-web:dev .
```

Multi-stage, Node 24 slim, standalone server, non-root. Probes: `GET /api/health`. Deployed by `kriraghor-infra` (`values/web/<env>.yaml`).

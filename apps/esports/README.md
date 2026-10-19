# Kriraghor Esports (esports.kriraghor.com)

| | |
|---|---|
| **Repo** | `kriraghor-esports` |
| **Domain** | esports.kriraghor.com (dev: http://localhost:3001, k3d: http://esports.kriraghor.localhost) |
| **Status** | 0B scaffold: sign-in, `/me` with the live Socket.IO connection, PWA manifest, `/tournaments` placeholder. M21 screens come in phase 3 |
| **Specs** | [`M21 Esports`](../kriraghor-docs/modules/M21-esports.md) |
| **Decisions** | ADR-002, ADR-003, ADR-004 (see `../kriraghor-docs/decisions`) |

## Stack
Same as `kriraghor-web`: Next.js 16, TypeScript strict, Tailwind v4 tokens, next-intl (en, bn), TanStack Query, openapi-fetch, socket.io-client, Vitest, Playwright.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev                     #  http://localhost:3001
```

Run the backend API (`npm run dev`) and realtime (`npm run dev:realtime`) in `../kriraghor-backend`.

Scripts, runtime config, sessions and the API client work exactly as in [`kriraghor-web`](../kriraghor-web/README.md).

## Realtime
`src/components/LiveStatus.tsx` connects to `REALTIME_URL` (path `/socket.io`, websocket transport) with `auth: { token, audience: "api" }`. The server verifies the token like any API request and joins the socket to `user:{id}`. M21 adds `esports_tournament:{id}` and `esports_match:{id}` rooms for room-ID reveals and live results.

**SSO check:** sign in here, then open kriraghor.com `/me`: the same account appears without signing in again (ADR-004).

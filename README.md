# Kriraghor Esports

| | |
|---|---|
| **Repo** | `kriraghor-esports` |
| **Domain** | esports.kriraghor.com |
| **Status** | Empty. Scaffolded in prompt **0B** (see `../KRIRAGHOR-BUILD-PROMPT.md`) |
| **Specs** | [`../kriraghor-docs`](../kriraghor-docs/README.md) |
| **Decisions** | ADR-002, ADR-004 |

## Purpose
The esports app (top priority): PUBG Mobile and Free Fire tournaments, registration and paid entry, check-in, timed room ID reveal, results and disputes, leaderboards, player profiles, winnings and withdrawals. Installable as a PWA.

## Modules covered
M21 Esports (primary), M01 (sign-in, SSO with kriraghor.com), M02 (NID KYC for withdrawals), M06/M07 (entry fees, prizes, withdrawals), M08 (push and in-app notifications).

## Stack
Next.js (App Router, TypeScript strict), PWA, Socket.IO client for live rooms and leaderboards, Tailwind, next-intl (en/bn), TanStack Query, a typed API client generated from OpenAPI.

## Workspace
Part of the Kriraghor polyrepo. The workspace guide is `../CLAUDE.md`. The backend API is `../kriraghor-backend`.

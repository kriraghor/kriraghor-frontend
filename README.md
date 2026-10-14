# Kriraghor Web

| | |
|---|---|
| **Repo** | `kriraghor-web` |
| **Domain** | kriraghor.com |
| **Status** | Empty. Scaffolded in prompt **0B** (see `../KRIRAGHOR-BUILD-PROMPT.md`) |
| **Specs** | [`../kriraghor-docs`](../kriraghor-docs/README.md) |
| **Decisions** | ADR-002 Polyrepo and API contracts, ADR-004 Cross-subdomain auth |

## Purpose
The public site and member account area: ground discovery and booking (`/grounds`), hiring (`/hiring`), shop (`/shop`), gym (`/gym`), top players, and account settings.

## Modules covered
M01 (sign-in, account), M02 (verification), M09/M10 (grounds and bookings), M11 (hire), M12/M13 (shop), M17 (reviews), M19 (member overview), M20 (gym), and M21 (top-player showcase).

## Stack
Next.js (App Router, TypeScript strict), Tailwind with the Kriraghor design tokens, next-intl (en/bn), TanStack Query, a typed API client generated from the backend OpenAPI document, `output: standalone`.

## Workspace
Part of the Kriraghor polyrepo. The workspace guide is `../CLAUDE.md`. The backend API is `../kriraghor-backend`.

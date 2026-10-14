# Kriraghor Portal (admin and vendor)

| | |
|---|---|
| **Repo** | `kriraghor-portal` |
| **Domain** | admin.kriraghor.com · vendor.kriraghor.com |
| **Status** | Empty. Scaffolded in prompt **0B** (see `../KRIRAGHOR-BUILD-PROMPT.md`) |
| **Specs** | [`../kriraghor-docs`](../kriraghor-docs/README.md) |
| **Decisions** | ADR-002, ADR-004 (admin session isolated from customer sessions) |

## Purpose
One Next.js app routed by host. **admin.**: staff and master desks (review queue, KYC, esports desk, finance and payouts, disputes, risk, fees and rules, staff permissions, audit log). **vendor.**: business desks for ground owners, shops (including supplement and gym gear shops), gyms and organisers.

## Modules covered
Admin: M01 (staff, permissions), M02, M03 (settings), M04 (audit), M05, M06/M07, M17, M18, M19, M21 (esports desk). Vendor: M09/M10, M12/M13, M20, M22 (organiser console, later).

## Stack
Next.js (App Router, TypeScript strict), host-based routing in middleware, staff TOTP sign-in for admin, Tailwind, next-intl, TanStack Query, a typed API client generated from OpenAPI.

## Workspace
Part of the Kriraghor polyrepo. The workspace guide is `../CLAUDE.md`. The backend API is `../kriraghor-backend`.

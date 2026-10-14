# Kriraghor Mobile

| | |
|---|---|
| **Repo** | `kriraghor-mobile` |
| **Domain** | App Store · Google Play |
| **Status** | Empty. Scaffolded in prompt **0B** (see `../KRIRAGHOR-BUILD-PROMPT.md`) |
| **Specs** | [`../kriraghor-docs`](../kriraghor-docs/README.md) |
| **Decisions** | ADR-002, ADR-004 (mobile bearer tokens) |

## Purpose
The Kriraghor mobile app. Esports and ground booking come first: tournaments, room reveal with push, winnings, bookings, and push notifications.

## Modules covered
M21 Esports, M10 Bookings, M01 (OTP sign-in with bearer tokens, `X-Client-Type: mobile`), M08 (push through Expo).

## Stack
React Native with Expo (TypeScript), expo-router, EAS build profiles (dev, preview, prod), secure token storage, expo-notifications, and a typed API client generated from OpenAPI.

## Workspace
Part of the Kriraghor polyrepo. The workspace guide is `../CLAUDE.md`. The backend API is `../kriraghor-backend`.

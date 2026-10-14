# Kriraghor Mobile (App Store · Play Store)

| | |
|---|---|
| **Repo** | `kriraghor-mobile` |
| **Status** | 0B scaffold: phone OTP sign-in (M01), account screen, secure token storage, push setup (not sending yet) |
| **Stack** | Expo SDK 57, expo-router, TypeScript strict, React Native 0.86 (New Architecture, Hermes), openapi-fetch, jest-expo |
| **Decisions** | ADR-002 (shared OpenAPI contract), [ADR-004](../kriraghor-docs/decisions/ADR-004-cross-subdomain-auth.md) (mobile uses body tokens, not cookies) |
| **First features** | Esports (M21: register, room reveal by push, winnings, withdraw) and booking (M10) |

## Run locally

```bash
npm install
npx expo start              # press a for Android emulator, or scan with a development build
```

The backend runs on your machine (`npm run dev` and `npm run dev:realtime` in `../kriraghor-backend`). The Android emulator reaches it at `http://10.0.2.2:4000`. For a physical phone, set `API_URL=http://<your-LAN-IP>:4000/api/v1` before `npx expo start`.

`expo-secure-store` and `expo-notifications` include native code, so use a development build (`npx eas-cli@latest build --profile development`) rather than Expo Go.

| Script | What it does |
|---|---|
| `npm run lint` · `npm run typecheck` | `expo lint`, `tsc --noEmit` |
| `npm test` | jest-expo unit tests (session storage, refresh, retry) |
| `npm run api:sync` | Regenerate `src/lib/api/schema.d.ts` from `../kriraghor-backend/openapi.json` |
| `npx expo export --platform android` | Bundle check without a device |

## Configuration

`app.config.ts` reads `APP_ENV`, `API_URL` and `REALTIME_URL`; `eas.json` sets them per build profile:

| Profile | APP_ENV | API | Bundle ID |
|---|---|---|---|
| `development` | development | `http://10.0.2.2:4000/api/v1` | `com.kriraghor.app.development` |
| `preview` | preview | `https://api.staging.kriraghor.com/api/v1` | `com.kriraghor.app.preview` |
| `production` | production | `https://api.kriraghor.com/api/v1` | `com.kriraghor.app` |

Run `npx eas-cli@latest init` once to create the EAS project and set `EAS_PROJECT_ID` (needed for push tokens).

## Sessions (ADR-004)
Every request sends `X-Client-Type: mobile`, so sign-in and refresh return the refresh token in the body (no cookies, no CSRF). The refresh token is stored with `expo-secure-store` (Keychain or Keystore, this device only, after first unlock); the access token stays in memory. Refresh is single-flight, and a 401 `TOKEN_EXPIRED` or `AUTHZ_STALE` refreshes once and retries.

## Push
`src/lib/notifications.ts` creates the Android `tournaments` channel, asks permission and gets the Expo push token. Sending (and registering the token with the API) arrives with M08 in phase 1.

# Vercel setup

How the three Next.js apps in this repo are deployed on Vercel. One Vercel project per app, all connected to this repository. (The backend runs on Render from `kriraghor-backend`; the mobile app is in `kriraghor-mobile-app` and ships through EAS.)

## The three projects

| | web | esports | portal |
|---|---|---|---|
| Git repository | `kriraghor/kriraghor-frontend` | `kriraghor/kriraghor-frontend` | `kriraghor/kriraghor-frontend` |
| Production branch | `main` | `main` | `main` |
| Root Directory | `apps/web` | `apps/esports` | `apps/portal` |
| Framework preset | Next.js | Next.js | Next.js |
| Install command | `npm ci` | `npm ci` | `npm ci` |
| Build command | `npm run build` | `npm run build` | `npm run build` |
| Domains | `kriraghor.com` (redirects to `www`), `www.kriraghor.com` | `esports.kriraghor.com` | `admin.kriraghor.com`, `vendor.kriraghor.com` (one app, routed by host) |
| Node.js version | 24.x | 24.x | 24.x |

Set the Root Directory in **Settings → Build and Deployment**. Leave "Include files outside the Root Directory" off: each app has its own `package.json` and lock file.

### Only build the app that changed
In **Settings → Git → Ignored Build Step**, choose "Custom" and enter:

```
git diff --quiet HEAD^ HEAD -- .
```

Vercel runs it inside the Root Directory, so `.` is the app's folder: a commit that only touches `apps/web` skips the esports and portal builds. (It exits 0, meaning skip, when nothing in the folder changed.)

## Environment variables (Production)

The apps read these at request time through `/env.js` (see `src/lib/env.ts`). A missing value falls back to `localhost`, which breaks the live site, so set every one. Values change only with a **redeploy** (Deployments → ⋯ → Redeploy).

| Variable | web | esports | portal | Production value |
|---|---|---|---|---|
| `API_URL` | ✔ | ✔ | ✔ | `https://api.kriraghor.com/api/v1` |
| `INTERNAL_API_URL` | optional | – | – | Leave empty on Vercel (server-side page metadata then uses `API_URL`) |
| `REALTIME_URL` | ✔ | ✔ | ✔ | `https://realtime.kriraghor.com` |
| `WEB_URL` | ✔ | ✔ | ✔ | `https://www.kriraghor.com` |
| `ESPORTS_URL` | ✔ | ✔ | ✔ | `https://esports.kriraghor.com` |
| `ADMIN_URL` | ✔ | ✔ | ✔ | `https://admin.kriraghor.com` |
| `VENDOR_URL` | ✔ | ✔ | ✔ | `https://vendor.kriraghor.com` |
| `COOKIE_PREFIX` | ✔ | ✔ | ✔ | `kg` (staging: `kgstg`) |
| `GOOGLE_CLIENT_ID` | ✔ | ✔ | ✔ | The web client ID from Google Cloud (public, not a secret) |
| `APP_ENV` | ✔ | ✔ | ✔ | `production` |
| `APP_NAME` | optional | optional | optional | Defaults to Kriraghor |
| `PORTAL_DEFAULT_AREA` | – | – | optional | `admin` (only used on hosts that are neither admin.* nor vendor.*) |

None of these is a secret: they are all public URLs or IDs, and the apps only ever expose the keys listed in `src/lib/env.ts`.

The backend must allow these origins: `CORS_ORIGINS` and `ADMIN_ORIGINS` on Render list the four domains above.

## Who can deploy

On the Vercel **Hobby** plan, only commits authored by the account that owns the Vercel team (`kriraghor`) start a deployment. Commits pushed by collaborators (for example `RyUk346`) are not deployed automatically. When that happens, deploy from the dashboard: Deployments → Create Deployment → branch `main`. A Deploy Hook URL also works. Never rewrite a commit's author to get around it.

## Checking a deployment

```
curl -sL https://www.kriraghor.com/env.js
```

The `API_URL` in the output must be `https://api.kriraghor.com/api/v1`, not `localhost`. Do the same for `esports.`, `admin.` and `vendor.`.

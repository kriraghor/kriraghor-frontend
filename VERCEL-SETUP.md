# Vercel setup

How the three Next.js apps in this repo are deployed on Vercel. One Vercel project per app, all connected to this repository. (The backend runs on Render from `kriraghor-backend`; the mobile app is in `kriraghor-mobile-app` and ships through EAS.)

## The three projects

| | web | esports | portal |
|---|---|---|---|
| Git repository | `kriraghor/kriraghor-frontend` | `kriraghor/kriraghor-frontend` | `kriraghor/kriraghor-frontend` |
| Production branch | `main` | `main` | `main` |
| Root Directory | `apps/web` | `apps/esports` | `apps/portal` |
| Framework preset | Next.js | Next.js | Next.js |
| Install command | default (Vercel runs `npm install` at the repo root for the workspace) | default | default |
| Build command | `npm run build` | `npm run build` | `npm run build` |
| Domains | `kriraghor.com` (redirects to `www`), `www.kriraghor.com` | `esports.kriraghor.com` | `admin.kriraghor.com`, `vendor.kriraghor.com` (one app, routed by host) |
| Node.js version | 24.x | 24.x | 24.x |

Set the Root Directory in **Settings → Build and Deployment**, and turn **on** "Include files outside the Root Directory in the Build Step". The repo is an npm workspace: the apps import `packages/*` and there is one `package-lock.json` at the root, so Vercel must see the whole repo. Leave the Install Command on its default (Vercel detects the workspace and installs from the root).

### Only build the app that changed
In **Settings → Git → Ignored Build Step**, choose "Custom" and enter:

```
git diff --quiet HEAD^ HEAD -- . ../../packages ../../package.json ../../package-lock.json
```

Vercel runs it inside the Root Directory, so `.` is the app's folder: a commit that only touches `apps/web` skips the esports and portal builds, while a change to a shared package or the root manifests rebuilds all three. (It exits 0, meaning skip, when nothing in those paths changed.)


## Environment variables (Production)

The apps read these at request time through `/env.js` (see `packages/session/src/env.ts`). A missing value falls back to `localhost`, which breaks the live site, so set every one. Values change only with a **redeploy** (Deployments → ⋯ → Redeploy).

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

None of these is a secret: they are all public URLs or IDs, and the apps only ever expose the keys listed in `packages/session/src/env.ts`.

The backend must allow these origins: `CORS_ORIGINS` and `ADMIN_ORIGINS` on Render list the four domains above.

## Who can  deploy

On the Vercel **Hobby** plan, only commits authored by the account that owns the Vercel team (`kriraghor`) start a deployment. Commits pushed by collaborators (for example `RyUk346`) are not deployed automatically. When that happens, deploy from the dashboard: Deployments → Create Deployment → branch `main`. A Deploy Hook URL also works. Never rewrite a commit's author to get around it.

## Checking a deployment

```
curl -sL https://www.kriraghor.com/env.js
```

The `API_URL` in the output must be `https://api.kriraghor.com/api/v1`, not `localhost`. Do the same for `esports.`, `admin.` and `vendor.`.

## Changing over to the workspace (once, before merging `refactor/shared-packages`)

Do this in each of the three projects (web, esports, portal), then merge, then check the three sites:
1. **Settings → Build and Deployment → Root Directory:** keep `apps/<app>`, and tick **Include files outside the Root Directory in the Build Step**. Save.
2. **Install Command:** turn the override off (default). Build Command: default (`npm run build`).
3. **Settings → Git → Ignored Build Step:** Custom, `git diff --quiet HEAD^ HEAD -- . ../../packages ../../package.json ../../package-lock.json`. Save.
4. After the merge, deploy `main` (Deployments → Create Deployment if the commit author is not `kriraghor`), then run the check below on all four domains.

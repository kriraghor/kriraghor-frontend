# Kriraghor frontend

The Kriraghor web apps in one repository. The mobile app has its own repository, [kriraghor-mobile-app](https://github.com/kriraghor/kriraghor-mobile-app) (since 20 Oct 2026). The repo is an npm workspace: install once at the root, then run each app from its folder.

| Folder | App | Domain | Stack |
|---|---|---|---|
| `apps/web` | Public site: venues, shop, hire, gym, events, account | kriraghor.com | Next.js (App Router, TypeScript) |
| `apps/esports` | Esports events, room reveal, results, leaderboards | esports.kriraghor.com | Next.js, PWA |
| `apps/portal` | Admin and vendor desks, routed by host | admin.kriraghor.com · vendor.kriraghor.com | Next.js |

```bash
npm ci                       # once, at the repo root
cd apps/web && npm run dev   # or apps/esports, apps/portal
```

Shared packages (TypeScript source; the apps compile them with `transpilePackages`):

| Package | What it holds |
|---|---|
| `packages/config` | eslint (with the workspace boundary rules), the TypeScript base, Vitest and Playwright presets |
| `packages/session` | runtime public config (`/env.js`), cookies, the access-token session and refresh, cross-site links, the redirect matcher |
| `packages/api-client` | the typed API client and **one** schema generated from `kriraghor-backend/openapi.json` (`npm run api:sync` at the root), notifications helpers |
| `packages/ui` | primitives, auth provider, notifications, charts, sign-in, the header, next-intl navigation, the glass stylesheet |

Apps never import another app, and nobody imports a package's internal files (eslint enforces both). Surface styles that differ per site (`field`, `glass-card`, `popover-surface`, `btn-primary-finish`, `notice-surface`) are defined in each app's `globals.css`, so the portal stays flat.

- **CI:** `.github/workflows/<app>.yml` runs when that app's folder, `packages/` or the root manifests change, using the reusable workflow in [kriraghor-infrastructure](https://github.com/kriraghor/kriraghor-infrastructure) with `app-dir`.
- **Docker:** build from the root, `docker build -f apps/web/Dockerfile .`
- **Vercel:** one project per app, with its Root Directory set to `apps/web`, `apps/esports` or `apps/portal` and files outside the Root Directory included. Settings and environment variables: [VERCEL-SETUP.md](VERCEL-SETUP.md).
- **History:** each app was brought in with `git subtree`, so `git log -- apps/web` shows its earlier commits. `apps/mobile` lived here until 20 Oct 2026; its history continues in kriraghor-mobile-app.
- Specs and decisions live in [kriraghor-docs](https://github.com/kriraghor/kriraghor-docs); the API in [kriraghor-backend](https://github.com/kriraghor/kriraghor-backend).

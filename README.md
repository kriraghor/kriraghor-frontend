# Kriraghor frontend
The Kriraghor web apps in one repository (four since 25 Oct 2026: web, esports, portal and gym). The mobile app has its own repository, [kriraghor-mobile-app](https://github.com/kriraghor/kriraghor-mobile-app) (since 20 Oct 2026). The repo is an npm workspace: install once at the root, then run each app from its folder.

| Folder | App | Domain | Stack |
|---|---|---|---|
| `apps/web` | Public site: venues, shop, hire (with trainers' monthly plans), events, account | kriraghor.com | Next.js (App Router, TypeScript) |
| `apps/esports` | Esports events, room reveal, results, leaderboards | esports.kriraghor.com | Next.js, PWA |
| `apps/portal` | Admin and vendor desks, routed by host | admin.kriraghor.com · console.kriraghor.com | Next.js |
| `apps/gym` | Gyms, passes, trainer plans, managing a gym (`/manage`), the gym system's landing page and `/start` (since 25 Oct 2026) | gym.kriraghor.com | Next.js |

```bash
npm ci                       # once,at the repo root
cd apps/web && npm run dev   # or apps/esports (:3001), apps/portal (:3002), apps/gym (:3003)
```
Shared packages (TypeScript source; the apps compile them with `transpilePackages`):

| Package | What it holds |
|---|---|
| `packages/config` | eslint (with the workspace boundary rules), the TypeScript base, Vitest and Playwright presets |
| `packages/session` | runtime public config (`/env.js`), cookies, the access-token session and refresh, cross-site links, the redirect matcher |
| `packages/api-client` | the typed API client and **one** schema generated from `kriraghor-backend/openapi.json` (`npm run api:sync` at the root), notifications helpers |
| `packages/ui` | primitives, auth provider, notifications, charts, sign-in, the header and page header, reviews (`@kriraghor/ui/trust`), the business desk helpers (`@kriraghor/ui/desk`), shared formatting (`@kriraghor/ui/format`), URL filters, next-intl navigation, the glass stylesheet |
| `packages/tokens` | the design tokens (CSS variables and the Tailwind theme) with the gym theme (`[data-theme="gym"]`), and the copy for the mobile app |

Apps never import another app, and nobody imports a package's internal files (eslint enforces both). Surface styles that differ per site (`field`, `glass-card`, `popover-surface`, `btn-primary-finish`, `notice-surface`) are defined in each app's `globals.css`, so the portal stays flat.

- **CI:** `.github/workflows/<app>.yml` runs when that app's folder, `packages/` or the root manifests change, using the reusable workflow in [kriraghor-infrastructure](https://github.com/kriraghor/kriraghor-infrastructure) with `app-dir`.
- **Docker:** build from the root, `docker build -f apps/web/Dockerfile .`
- **Vercel:** one project per app, with its Root Directory set to `apps/web`, `apps/esports`, `apps/portal` or `apps/gym` and files outside the Root Directory included. Settings and environment variables: [VERCEL-SETUP.md](VERCEL-SETUP.md).
- **History:** each app was brought in with `git subtree`, so `git log -- apps/web` shows its earlier commits. `apps/mobile` lived here until 20 Oct 2026; its history continues in kriraghor-mobile-app.
- Specs and decisions live in [kriraghor-docs](https://github.com/kriraghor/kriraghor-docs); the API in [kriraghor-backend](https://github.com/kriraghor/kriraghor-backend).

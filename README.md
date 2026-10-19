# Kriraghor frontend

The Kriraghor apps in one repository. Each app keeps its own `package.json`, lock file and tooling; install and run it from its folder.

| Folder | App | Domain | Stack |
|---|---|---|---|
| `apps/web` | Public site: venues, shop, hire, gym, events, account | kriraghor.com | Next.js (App Router, TypeScript) |
| `apps/esports` | Esports events, room reveal, results, leaderboards | esports.kriraghor.com | Next.js, PWA |
| `apps/portal` | Admin and vendor desks, routed by host | admin.kriraghor.com · vendor.kriraghor.com | Next.js |
| `apps/mobile` | The mobile app | App Store, Play Store | React Native, Expo |

```bash
cd apps/web && npm ci &&  npm run dev
```

- **CI:** `.github/workflows/<app>.yml` runs only when that app's folder changes, using the reusable workflow in [kriraghor-infrastructure](https://github.com/kriraghor/kriraghor-infrastructure) with `app-dir`.
- **Vercel:** one project per app, with its Root Directory set to `apps/web`, `apps/esports` or `apps/portal`.
- **History:** each app was brought in with `git subtree`, so `git log -- apps/web` shows its earlier commits.
- Specs and decisions live in [kriraghor-docs](https://github.com/kriraghor/kriraghor-docs); the API in [kriraghor-backend](https://github.com/kriraghor/kriraghor-backend).

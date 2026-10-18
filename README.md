# Kriraghor Portal (admin.kriraghor.com · vendor.kriraghor.com)

| | |
|---|---|
| **Repo** | `kriraghor-portal` |
| **Domains** | admin.kriraghor.com and vendor.kriraghor.com (dev: http://localhost:3002, k3d: http://admin.kriraghor.localhost, http://vendor.kriraghor.localhost) |
| **Status** | 0B scaffold: host routing, staff sign-in with TOTP (admin), customer sign-in (vendor), admin and vendor home |
| **Specs** | Admin desks: M01–M07, M17–M19, M21 desk. Vendor desks: M09/M10, M12/M13, M20, M22 |
| **Decisions** | ADR-002, ADR-003, [ADR-004](../kriraghor-docs/decisions/ADR-004-cross-subdomain-auth.md) (separate admin sessions) |

## One app, two areas

| Host | Area | Session | Sign-in |
|---|---|---|---|
| `admin.*` | `/admin` | **Admin** (aud `admin`, cookies `kg_art`, `kg_asi`, `kg_acsrf`) | `POST /auth/admin/login` (password or phone code) → TOTP setup or verify |
| `vendor.*` | `/vendor` | Customer (aud `api`, shared with kriraghor.com and esports) | Same as kriraghor.com |

`src/proxy.ts` picks the area from the host and redirects `/` to it. The other area's paths return 404 on each host, so staff pages are never reachable through the vendor domain. On plain `localhost:3002` there is no host to route by: `PORTAL_DEFAULT_AREA=admin|vendor` picks one (default `admin`). Routing is only a convenience; the API enforces access.

Staff accounts are separate from customer accounts (Q33): a staff member who tries the customer sign-in gets `STAFF_USE_ADMIN_PORTAL`.

##  Run locally

```bash
cp .env.example .env.local
npm install
npm run dev                                 # http://localhost:3002 (admin area)
PORTAL_DEFAULT_AREA=vendor npm run dev      # vendor area
```

The backend's `ADMIN_ORIGINS` must include `http://localhost:3002`. Create the first master with `npm run create:master` in `../kriraghor-backend`, then sign in with its phone code and enrol an authenticator app.

Scripts, runtime config, the API client and locales work as in [`kriraghor-web`](../kriraghor-web/README.md).

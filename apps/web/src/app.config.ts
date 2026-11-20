import type { Audience } from "@kriraghor/session/auth";

/** Per-app settings. This is the only file (plus pages) that differs between web, esports and portal. */
export const APP = {
  id: "web" as const,
  titleKey: "web" as const,
  title: "Kriraghor",
  description: "Esports, venues, gear and talent for players in Bangladesh.",
  audience: "api" as Audience,
  // Esports first (priority 1), then grounds, shop, hire, gym; tournaments last. Business is "Partner with us" at the
  // top right of the header since 19 Nov 2026 (tester feedback), not a link here.
  // Esports and gym are their own sites (esports.kriraghor.com, gym.kriraghor.com), reached through /go/.
  nav: [
    { href: "/go/esports", key: "esports" },
    { href: "/venues", key: "grounds" },
    { href: "/shop", key: "shop" },
    { href: "/hiring", key: "hiring" },
    { href: "/go/gym", key: "gym" },
    { href: "/events", key: "tournaments" },
  ],
};

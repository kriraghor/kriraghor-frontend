import type { Audience } from "@/lib/auth/session";

/** Per-app settings. This is the only file (plus pages) that differs between web, esports and portal. */
export const APP = {
  id: "web" as const,
  titleKey: "web" as const,
  title: "Kriraghor",
  description: "Esports, grounds, gear and talent for players in Bangladesh.",
  audience: "api" as Audience,
  // home-v3 order: esports first (priority 1), then grounds, shop, hire, gym; tournaments last.
  nav: [
    { href: "/go/esports", key: "esports" },
    { href: "/grounds", key: "grounds" },
    { href: "/shop", key: "shop" },
    { href: "/hiring", key: "hiring" },
    { href: "/gym", key: "gym" },
    { href: "/tournaments", key: "tournaments" },
  ],
};

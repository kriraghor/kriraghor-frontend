import type { Audience } from "@/lib/auth/session";

/** Per-app settings. This is the only file (plus pages) that differs between web, esports and portal. */
export const APP = {
  id: "web" as const,
  titleKey: "web" as const,
  title: "Kriraghor",
  description: "Esports, grounds, gear and talent for players in Bangladesh.",
  audience: "api" as Audience,
  nav: [
    { href: "/grounds", key: "grounds" },
    { href: "/hiring", key: "hiring" },
    { href: "/shop", key: "shop" },
    { href: "/gym", key: "gym" },
  ],
};

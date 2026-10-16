import type { Audience } from "@/lib/auth/session";

/** Per-app settings. This is the only file (plus pages) that differs between web, esports and portal. */
export const APP = {
  id: "esports" as const,
  titleKey: "esports" as const,
  title: "Kriraghor Esports",
  description: "PUBG Mobile and Free Fire tournaments with real prizes.",
  audience: "api" as Audience,
  nav: [
    { href: "/tournaments", key: "esports" },
    { href: "/leaderboards", key: "leaderboards" },
    { href: "/me/matches", key: "myMatches" },
  ],
};

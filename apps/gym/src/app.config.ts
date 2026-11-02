import type { Audience } from "@kriraghor/session/auth";

/** Per-app settings. This is the only file (plus pages) that differs between web, esports, portal and gym. */
export const APP = {
  id: "gym" as const,
  titleKey: "gym" as const,
  title: "Kriraghor Gym",
  description: "Subscriptions at verified gyms, monthly plans with trainers, and the tools to run a gym.",
  audience: "api" as Audience,
  nav: [
    { href: "/gyms", key: "gyms" },
    { href: "/trainers", key: "trainers" },
    { href: "/me/passes", key: "myPasses" },
  ],
};

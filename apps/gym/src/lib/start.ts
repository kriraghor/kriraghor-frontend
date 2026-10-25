import { api } from "@kriraghor/api-client";
import { unwrap } from "./manage";

/**
 * The landing page and /start on gym.kriraghor.com (M24 prompt 0, 25 Oct 2026). Prices come from the
 * public platform settings (M03, GET /settings/public) and show only once the M24 tier settings exist;
 * until then the page says the system is free during early access. Nothing here is hard-coded.
 * /start walks a member from the gym owner application (M02) to their first gym draft (M20).
 */
export type PublicSettings = Record<string, unknown>;
export type TierPrice = { key: string; poisha: number };

export async function fetchPublicSettings(): Promise<PublicSettings> {
  const { data, error } = await api().GET("/settings/public");
  if (error || !data) throw error ?? new Error("settings unavailable");
  return data as PublicSettings;
}

/**
 * The gym system's tier prices from the public settings: every numeric `gym.tier*` key (nested by
 * prefix with camelCase names, so `gym.tier_starter_poisha` arrives as gym.tierStarterPoisha), cheapest
 * first. Null when there is none yet (then the page shows "Free during early access").
 */
export function tierPrices(settings: PublicSettings | undefined | null): TierPrice[] | null {
  const gym = settings?.gym;
  if (!gym || typeof gym !== "object") return null;
  const out = Object.entries(gym as Record<string, unknown>)
    .filter(([k, v]) => /^tier/i.test(k) && typeof v === "number" && Number.isFinite(v) && v >= 0)
    .map(([key, v]) => ({ key, poisha: v as number }))
    .sort((a, b) => a.poisha - b.poisha || a.key.localeCompare(b.key));
  return out.length ? out : null;
}

/** "tierStarterPoisha" → "Starter" (the tier's name when the copy has no message for it). */
export const tierName = (key: string) =>
  key
    .replace(/^tier/i, "")
    .replace(/Poisha$|Price$|Monthly$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim() || key;

export type RoleStatus = "applied" | "documents_pending" | "in_review" | "active" | "changes_requested" | "rejected" | "suspended" | "withdrawn";
/** Where a member stands on the way to running a gym. */
export type StartStep = "signIn" | "apply" | "documents" | "review" | "create" | "suspended";

/** The /start step from the session and the member's gym_owner role (if any). */
export function startStep(signedIn: boolean, roles: readonly { role: string; status: string }[] | undefined): StartStep {
  if (!signedIn) return "signIn";
  const r = roles?.find((x) => x.role === "gym_owner");
  switch (r?.status as RoleStatus | undefined) {
    case "active":
      return "create";
    case "applied":
    case "documents_pending":
    case "changes_requested":
      return "documents";
    case "in_review":
      return "review";
    case "suspended":
      return "suspended";
    default:
      return "apply";
  }
}

/** Apply for the gym owner role (M02); the documents follow on kriraghor.com/account/business?as=gym. */
export const applyAsGymOwner = async () => unwrap(await api().POST("/me/roles", { body: { role: "gym_owner" } }));

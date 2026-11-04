import { esportsHref } from "./links";

/**
 * Profile checklists (Round B1, M01 avatar_key, M11, M16): the steps the API scores (`completeness`
 * on GET /pro/profiles and GET/PUT /me/player-profile) and where each one is fixed.
 */
export type Step = { key: string; done: boolean };
export type Completeness = { score: number; steps: Step[] };

export const PRO_STEPS = ["photo", "headline", "bio", "rateCard", "credential", "policeClearance", "availability", "payoutAccount"] as const;
export const PLAYER_STEPS = ["sports", "bio", "team", "esportsUid", "nid"] as const;

/** Where a hire profile's step is fixed. `as` is the business role the credential and police clearance are sent under. */
export function proStepHref(key: string, profileId: string, as: "pro" | "player" = "pro"): string | null {
  const editor = `/pro/profiles/${profileId}`;
  switch (key) {
    case "photo":
      return "/account/settings#photo";
    case "headline":
      return `${editor}#pro-headline`;
    case "bio":
      return `${editor}#pro-bio`;
    case "rateCard":
      return `${editor}#pro-rates`;
    case "credential":
    case "policeClearance":
      return `/account/business?as=${as}`;
    case "availability":
      return "/pro/availability";
    case "payoutAccount":
      return "/me/payout-account";
    default:
      return null;
  }
}

/** Where a player profile's step is fixed (the editor's own fields are anchors on /me/player). */
export function playerStepHref(key: string): string | null {
  switch (key) {
    case "sports":
      return "#player-sports";
    case "bio":
      return "#player-bio";
    case "team":
      return "/me/teams";
    case "esportsUid":
      return esportsHref("/me/esports");
    case "nid":
      return "/account/verification";
    default:
      return null;
  }
}

/** Whether the checklist still has something to do (the card hides at 100%). */
export const incomplete = (c: Completeness | null | undefined): c is Completeness => Boolean(c && c.score < 100 && c.steps.some((s) => !s.done));

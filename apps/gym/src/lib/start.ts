import { api } from "@kriraghor/api-client";
import { unwrap } from "./manage";

/**
 * /start on gym.kriraghor.com (M24 prompt 0, extended in prompt 1). Two paths:
 *  - a private gym (M24-FR-01, FR-09): a verified phone is enough; the gym (POST /me/gyms), its short
 *    code, its packages, then import, the first member or skip (gym-manage privateStep);
 *  - a listed gym: the gym owner application (M02) and documents, then the gym draft (M20) for review.
 * The landing prices come from GET /gym-manage/pricing (components/home/Pricing), never from here.
 */
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

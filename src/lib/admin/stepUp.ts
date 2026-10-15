import { api, problemOf, type Problem } from "@/lib/api/client";

type Scope = "settings.write" | "staff.write" | "audit.export" | "events.replay" | "refund.large" | "escrow.manage" | "payout.approve";

/**
 * Exchange a fresh authenticator code for a single-use step-up token (M01-FR-11).
 * Each write needs its own token, so call this right before the request it protects.
 */
export async function stepUp(code: string, scope: Scope = "settings.write"): Promise<string> {
  const { data, error } = await api("admin").POST("/auth/step-up", { body: { scope, code } });
  if (error || !data) throw problemOf(error) ?? ({ code: "STEP_UP_FAILED", title: "Could not confirm your code", status: 0 } satisfies Problem);
  return data.stepUpToken;
}

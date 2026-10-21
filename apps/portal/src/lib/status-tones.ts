import type { Tone } from "@kriraghor/ui/kit";

/**
 * Status colours for every desk, in one place (they were 20 local maps). A status can mean
 * different things on different desks (a dispute "awaiting response" is routine for staff but
 * urgent for the venue owner who must answer), so each desk has a domain; anything not listed
 * falls back to the shared money statuses, then to neutral. Colour is never the only signal: the
 * badge always carries the status text.
 */
export type StatusTone = "ok" | "warn" | "bad" | "muted";

const BASE: Record<string, StatusTone> = {
  succeeded: "ok",
  released: "ok",
  completed: "ok",
  matched: "ok",
  approved: "ok",
  holding: "warn",
  partially_released: "warn",
  pending: "warn",
  pending_master: "warn",
  processing: "warn",
  initiated: "muted",
  partially_refunded: "warn",
  refunded: "muted",
  closed: "muted",
  expired: "muted",
  cancelled: "muted",
  rejected: "muted",
  failed: "bad",
  frozen: "bad",
  manual_required: "bad",
  running: "warn",
};

export const DOMAINS = {
  finance: {},
  payout: { scheduled: "warn", needs_approval: "warn", on_hold: "bad", processing: "warn", paid: "ok", failed: "bad", cancelled: "muted" },
  booking: { confirmed: "ok", checked_in: "ok", completed: "muted", pending_payment: "warn", no_show: "bad", cancelled_by_platform: "bad" },
  esports: { draft: "muted", review: "warn", scheduled: "muted", registration_open: "ok", registration_closed: "warn", check_in: "warn", live: "bad", results_pending: "warn", finalised: "ok", paid_out: "ok", cancelled: "bad" },
  console: { draft: "muted", review: "warn", scheduled: "ok", registration_open: "ok", registration_closed: "warn", check_in: "warn", live: "bad", results_pending: "warn", finalised: "ok", paid_out: "ok", cancelled: "bad", issued: "warn", overdue: "bad", paid: "ok", voided: "muted", active: "ok", suspended: "bad", ended: "muted" },
  organiser: { verified: "ok", pending_review: "warn", suspended: "bad", rejected: "bad", changes_requested: "bad", draft: "muted", active: "ok", ended: "muted", issued: "warn", overdue: "bad", paid: "ok", voided: "muted" },
  listing: { live: "ok", pending_review: "warn", changes_requested: "warn", paused: "muted", suspended: "bad", rejected: "bad", removed: "bad", draft: "muted", withdrawn: "muted" },
  ownerListing: { draft: "muted", pending_review: "warn", changes_requested: "bad", live: "ok", paused: "muted", rejected: "bad", withdrawn: "muted", suspended: "bad" },
  gym: { live: "ok", pending_review: "warn", paused: "muted", suspended: "bad", changes_requested: "bad", rejected: "bad" },
  market: { live: "ok", pending_review: "warn", changes_requested: "bad", suspended: "bad", rejected: "bad", removed: "muted", paused: "muted", draft: "muted", withdrawn: "muted" },
  hire: { pending: "warn", accepted_unpaid: "warn", confirmed: "ok", completed: "ok", reserved: "warn", scheduled: "warn", checked_in: "warn", live: "ok", completed_marked: "warn", released: "ok", disputed: "bad", suspended: "bad", rejected: "bad", changes_requested: "bad", pending_review: "warn" },
  moderation: { pending_review: "warn", approved: "ok", changes_requested: "bad", rejected: "bad", withdrawn: "muted", superseded: "muted" },
  sla: { ok: "ok", warn: "warn", overdue: "bad" },
  order: { placed: "warn", accepted: "warn", shipped: "ok", delivered: "ok", completed: "ok", disputed: "bad", pending_payment: "muted", rejected: "muted", expired: "muted", cancelled: "muted", refunded: "muted" },
  risk: { critical: "bad", high: "bad", medium: "warn", info: "muted" },
  severity: { info: "muted", notice: "warn", critical: "bad" },
  tournament: { registration_open: "ok", live: "ok", pending_review: "warn", registration_closed: "warn", completed: "muted", cancelled: "bad", rejected: "bad" },
  sports: { draft: "muted", pending_review: "warn", changes_requested: "bad", rejected: "bad", registration_open: "ok", registration_closed: "warn", live: "ok", completed: "muted", cancelled: "bad", pending_payment: "warn", pending_approval: "warn", reserve: "muted", offered: "warn", approved: "ok", lapsed: "muted", withdrawn: "muted", removed: "bad" },
  dispute: { awaiting_response: "muted", under_review: "warn", escalated: "bad", resolved: "ok", withdrawn: "muted" },
  ownerDispute: { awaiting_response: "bad", under_review: "warn", escalated: "warn", resolved: "ok", withdrawn: "muted" },
  pass: { active: "ok", redeemed: "muted", expired: "muted", cancelled: "bad", refunded: "bad", pending_payment: "warn", void: "muted" },
  stock: { in_stock: "ok", low: "warn", out: "bad", out_hidden: "bad", mto: "muted", blocked: "bad" },
} satisfies Record<string, Record<string, StatusTone>>;

export type StatusDomain = keyof typeof DOMAINS;

export function toneOf(status: string | null | undefined, domain: StatusDomain = "finance"): StatusTone {
  if (!status) return "muted";
  return (DOMAINS[domain] as Record<string, StatusTone>)[status] ?? BASE[status] ?? "muted";
}

/** The kit Badge tone for a desk status. */
export const KIT_TONE: Record<StatusTone, Tone> = { ok: "brand", warn: "warning", bad: "danger", muted: "neutral" };
export const badgeTone = (status: string | null | undefined, domain?: StatusDomain): Tone => KIT_TONE[toneOf(status, domain)];

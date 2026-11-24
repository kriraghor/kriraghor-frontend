import { DEFAULT_PERIOD, PERIODS, type ActionItem } from "@/lib/dashboard";

/**
 * The admin home (dashboards round 3, M19-FR-29 and FR-30): the staff queues "Needs your action"
 * shows as counted cards, and the platform period kept in the URL.
 */

/** Every staff queue the API can send (GET /admin/analytics/actions), in the order cards appear when equally urgent. */
export const STAFF_QUEUES = [
  "disputes_escalated",
  "reports_escalated",
  "payouts_failed",
  "disputes_to_review",
  "reports_open",
  "review_queue",
  "risk_flags",
  "payouts_to_approve",
  "settings_to_approve",
  "results_to_enter",
  "tournaments_to_review",
] as const;
export type StaffQueue = (typeof STAFF_QUEUES)[number];

export type QueueCard = { key: string; known: boolean; count: number; urgent: boolean; dueAt: string | null; href: string };

const rank = (key: string) => {
  const i = (STAFF_QUEUES as readonly string[]).indexOf(key);
  return i < 0 ? STAFF_QUEUES.length : i;
};

/**
 * The cards, one per queue: urgent ones first, then in STAFF_QUEUES order (a queue the page does not
 * know yet comes last, with a general label), and the earliest time limit first among equals.
 */
export function queueCards(items: readonly ActionItem[]): QueueCard[] {
  return items
    .map((a) => ({ key: a.key, known: rank(a.key) < STAFF_QUEUES.length, count: a.count, urgent: a.severity === "high", dueAt: a.dueAt, href: a.href }))
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || rank(a.key) - rank(b.key) || dueTime(a.dueAt) - dueTime(b.dueAt));
}

/** A time limit as a number to sort by; none sorts after every real one. */
const dueTime = (iso: string | null) => (iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY);

/** ?period= on the admin home: 30 days by default, as on the vendor dashboards. */
export const ADMIN_HOME_FILTERS = { period: { default: DEFAULT_PERIOD, allowed: PERIODS as readonly string[] } } as const;

import { badgeText } from "@kriraghor/api-client/notifications";

/**
 * How the bell notices a new notification (M08 §4.1): the pure decisions behind the chime, the
 * document-title count and the fallback polling, kept apart from React so they can be tested.
 */

/**
 * Whether an unread count change is news worth a chime: only a rise. `prev` is null before the
 * first load (the count that is already there on page load never chimes); a drop (read elsewhere)
 * and the same value (a refetch after the realtime event already counted it) stay quiet.
 */
export function shouldChime(prev: number | null | undefined, next: number | null | undefined): boolean {
  if (prev === null || prev === undefined || !Number.isFinite(prev)) return false;
  if (next === null || next === undefined || !Number.isFinite(next)) return false;
  return next > prev;
}

const PREFIX = /^\(\d+\+?\)\s+/;

/** "(3) Kriraghor": the title with the unread count in front (99+ cap), or the plain title at 0. */
export function titleWithUnread(title: string, count: number): string {
  const base = title.replace(PREFIX, "");
  const badge = badgeText(count);
  return badge ? `(${badge}) ${base}` : base;
}

/** The title without a count this bell put in front. */
export const titleWithoutUnread = (title: string) => title.replace(PREFIX, "");

/** Fallback polling interval while the realtime socket is down. */
export const POLL_MS = 30_000;

/**
 * Polling on/off: realtime keeps the bell fresh while the socket is connected; when it is not
 * (never connected, disconnected or connect_error) the bell re-reads every 30 s and when the
 * window regains focus or becomes visible.
 */
export function pollPlan(signedIn: boolean, socketConnected: boolean): { intervalMs: number | false; onFocus: boolean } {
  const poll = signedIn && !socketConnected;
  return { intervalMs: poll ? POLL_MS : false, onFocus: poll };
}

/** The newest unread notification's title in a page of the bell's list, if any. */
export function newestUnreadTitle(items: readonly { title: string; readAt?: string | null }[] | undefined): string | undefined {
  return items?.find((n) => !n.readAt)?.title || undefined;
}

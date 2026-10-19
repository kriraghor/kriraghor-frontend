import { io, type Socket } from "socket.io-client";
import { api } from "./client";
import { getAccessToken, type Audience } from "@kriraghor/session/auth";
import { publicEnv } from "@kriraghor/session/env";
import type { components } from "./schema";

/**
 * Client for the bell (M08 §4.1). Customer apps read /me/notifications; the admin portal reads
 * /admin/me/notifications with its admin session (ADR-004 keeps the two apart).
 */
export type NotificationItem = components["schemas"]["Notification"];
export type NotificationPage = components["schemas"]["NotificationPage"];
export type ListQuery = { unread?: boolean; category?: string; cursor?: string; limit?: number };

const asQuery = (q: ListQuery) => ({ ...q, unread: q.unread ? ("true" as const) : undefined });

export async function listNotifications(audience: Audience, q: ListQuery): Promise<NotificationPage> {
  const res =
    audience === "admin"
      ? await api("admin").GET("/admin/me/notifications", { params: { query: asQuery(q) } })
      : await api("api").GET("/me/notifications", { params: { query: asQuery(q) } });
  if (res.error || !res.data) throw res.error;
  return res.data;
}

export async function markRead(audience: Audience, body: { ids: string[] } | { all: true; before?: string }) {
  const res =
    audience === "admin"
      ? await api("admin").POST("/admin/me/notifications/read", { body })
      : await api("api").POST("/me/notifications/read", { body });
  if (res.error || !res.data) throw res.error;
  return res.data;
}

/** One realtime connection per audience, shared by the bell and anything else listening. */
const sockets: Partial<Record<Audience, Socket>> = {};
export function realtimeSocket(audience: Audience): Socket {
  if (!sockets[audience]) {
    sockets[audience] = io(publicEnv().REALTIME_URL, {
      path: "/socket.io",
      transports: ["websocket"],
      auth: (cb) => cb({ token: getAccessToken(audience), audience }),
    });
  }
  return sockets[audience]!;
}

/** "2 h ago" / "২ ঘণ্টা আগে" for the bell. */
export function relativeTime(iso: string, locale: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { numeric: "auto" });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  return rtf.format(seconds, "second");
}

/** Badge text: hidden at 0, capped at 99+ (§4.1). */
export const badgeText = (count: number) => (count <= 0 ? null : count > 99 ? "99+" : String(count));

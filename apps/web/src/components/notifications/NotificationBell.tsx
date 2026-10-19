"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { badgeText, listNotifications, markRead, realtimeSocket, relativeTime, type NotificationItem } from "@/lib/notifications";

/**
 * The bell "Updates" (M08 §4.1): unread badge from the server (99+ cap), a dropdown with the latest
 * 20 (All / Unread), mark-all-read, See all and Settings. Realtime: notification.created and
 * notification.read carry the unread count; the list re-reads when one arrives.
 */
export function NotificationBell({ centreHref, settingsHref }: { centreHref: string; settingsHref?: string }) {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const { status, audience } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const ref = useRef<HTMLDivElement>(null);

  const q = useQuery({
    queryKey: ["bell", audience, tab],
    enabled: status === "signed_in",
    queryFn: () => listNotifications(audience, { limit: 20, unread: tab === "unread" }),
  });
  // The server count is the truth; realtime events and actions refetch it (FR-04).
  const unread = q.data?.unreadCount ?? 0;

  useEffect(() => {
    if (status !== "signed_in") return;
    const socket = realtimeSocket(audience);
    const onCount = () => void qc.invalidateQueries({ queryKey: ["bell", audience] });
    // Re-read on (re)connect so the badge is right even if an emit was missed.
    const onConnect = () => void qc.invalidateQueries({ queryKey: ["bell", audience] });
    socket.on("notification.created", onCount);
    socket.on("notification.read", onCount);
    socket.on("connect", onConnect);
    return () => {
      socket.off("notification.created", onCount);
      socket.off("notification.read", onCount);
      socket.off("connect", onConnect);
    };
  }, [status, audience, qc]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (status !== "signed_in") return null;
  const badge = badgeText(unread);

  async function openItem(n: NotificationItem) {
    if (!n.readAt) {
      await markRead(audience, { ids: [n.id] }).catch(() => null);
      void qc.invalidateQueries({ queryKey: ["bell", audience] });
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  async function readAll() {
    await markRead(audience, { all: true, before: new Date().toISOString() }).catch(() => null);
    void qc.invalidateQueries({ queryKey: ["bell", audience] });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={badge ? t("bellUnread", { count: unread }) : t("bell")}
        className="relative inline-flex min-h-11 min-w-11 items-center justify-center border border-line"
        data-testid="notification-bell"
      >
        <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {badge ? (
          <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-danger px-1.5 text-center text-xs font-bold leading-5 text-white tabular-nums" data-testid="notification-badge">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div role="dialog" aria-label={t("title")} className="absolute right-0 z-50 mt-2 w-[360px] max-w-[calc(100vw-2rem)] glass-strong rounded-[24px] shadow-lg">
          <div className="flex items-center gap-2 border-b-2 border-line px-4 py-3">
            <h2 className="font-bold">{t("title")}</h2>
            <div role="tablist" className="ml-auto flex gap-1 text-sm">
              {(["all", "unread"] as const).map((k) => (
                <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-9 px-2 font-semibold ${tab === k ? "border-b-2 border-brand" : "text-muted"}`}>
                  {t(k)}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {q.isPending ? (
              <p className="p-4 text-sm text-muted" role="status">
                {t("loading")}
              </p>
            ) : q.isError ? (
              <p className="p-4 text-sm">
                {t("error")}{" "}
                <button type="button" className="underline" onClick={() => void q.refetch()}>
                  {t("retry")}
                </button>
              </p>
            ) : !q.data?.items.length ? (
              <p className="p-4 text-sm text-muted">{t("empty")}</p>
            ) : (
              <ul className="divide-y divide-line">
                {q.data.items.map((n) => (
                  <li key={n.id}>
                    <button type="button" onClick={() => void openItem(n)} className="flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-2" data-testid="notification-item">
                      <span aria-hidden className={`mt-1.5 inline-block size-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-brand"}`} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{n.title}</span>
                        <span className="block text-sm text-muted">{n.body}</span>
                        <span className="mt-1 block text-xs text-muted">
                          {relativeTime(n.createdAt, locale)}
                          {n.roleContext ? ` · ${n.roleContext}` : ""}
                          {!n.readAt ? <span className="sr-only"> · {t("unreadLabel")}</span> : null}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t-2 border-line px-4 py-3 text-sm font-semibold">
            <button type="button" onClick={() => void readAll()} disabled={!unread} className="min-h-9 underline disabled:opacity-50">
              {t("markAllRead")}
            </button>
            <Link href={centreHref} onClick={() => setOpen(false)} className="ml-auto min-h-9 py-2 underline">
              {t("seeAll")}
            </Link>
            {settingsHref ? (
              <Link href={settingsHref} onClick={() => setOpen(false)} className="min-h-9 py-2 underline">
                {t("settings")}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

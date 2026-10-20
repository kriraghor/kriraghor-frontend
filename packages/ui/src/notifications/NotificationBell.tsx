"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Bell, Checks } from "@phosphor-icons/react";
import { Link, useRouter } from "../i18n/navigation";
import { SegmentedControl } from "../kit/Tabs";
import { Skeleton } from "../kit/Display";
import { useAuth } from "../auth";
import { badgeText, listNotifications, markRead, realtimeSocket, relativeTime, type NotificationItem } from "@kriraghor/api-client/notifications";

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
        className="relative inline-flex size-11 items-center justify-center rounded-control text-ink transition-colors hover:bg-surface-2"
        data-testid="notification-bell"
      >
        <Bell size={22} weight={open ? "fill" : "regular"} aria-hidden />
        {badge ? (
          <span className="absolute right-0.5 top-0.5 min-w-5 rounded-pill bg-live px-1 text-center text-[11px] font-bold leading-5 text-white tabular-nums ring-2 ring-surface" data-testid="notification-badge">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div role="dialog" aria-label={t("title")} className="absolute -right-12 z-50 mt-2 w-[380px] max-w-[calc(100vw-1.5rem)] overflow-hidden popover-surface sm:right-0">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <h2 className="text-base font-bold">{t("title")}</h2>
            <SegmentedControl size="sm" className="ml-auto" label={t("title")} value={tab} onChange={setTab} options={[{ value: "all", label: t("all") }, { value: "unread", label: t("unread") }]} />
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {q.isPending ? (
              <div className="flex flex-col gap-3 p-4" role="status" aria-label={t("loading")}>
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : q.isError ? (
              <p className="p-4 text-sm">
                {t("error")}{" "}
                <button type="button" className="font-semibold text-brand-text underline" onClick={() => void q.refetch()}>
                  {t("retry")}
                </button>
              </p>
            ) : !q.data?.items.length ? (
              <p className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted">
                <Bell size={28} aria-hidden />
                {t("empty")}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {q.data.items.map((n) => (
                  <li key={n.id}>
                    <button type="button" onClick={() => void openItem(n)} className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2" data-testid="notification-item">
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
          <div className="flex flex-wrap items-center gap-1 border-t border-line bg-surface-2/50 px-2 py-2 text-sm font-semibold">
            <button type="button" onClick={() => void readAll()} disabled={!unread} className="inline-flex min-h-9 items-center gap-1.5 rounded-[9px] px-2 hover:bg-surface-2 disabled:opacity-50">
              <Checks size={18} aria-hidden />
              {t("markAllRead")}
            </button>
            <Link href={centreHref} onClick={() => setOpen(false)} className="ml-auto inline-flex min-h-9 items-center rounded-[9px] px-2 text-brand-text no-underline hover:bg-surface-2">
              {t("seeAll")}
            </Link>
            {settingsHref ? (
              <Link href={settingsHref} onClick={() => setOpen(false)} className="inline-flex min-h-9 items-center rounded-[9px] px-2 text-brand-text no-underline hover:bg-surface-2">
                {t("settings")}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Bell, Checks } from "@phosphor-icons/react";
import { Link, useRouter } from "../i18n/navigation";
import { SegmentedControl } from "../kit/Tabs";
import { Skeleton } from "../kit/Display";
import { useAuth } from "../auth";
import { badgeText, listNotifications, markRead, realtimeSocket, relativeTime, type NotificationItem } from "@kriraghor/api-client/notifications";
import { publicEnv } from "@kriraghor/session/env";
import { resolveNotificationLink, siteOfBell, type Site } from "./links";
import { newestUnreadTitle, pollPlan, shouldChime, titleWithUnread, titleWithoutUnread } from "./notice";
import { armAudioOnGesture, playChime, readSoundSetting } from "./sound";
import { SoundToggle } from "./SoundToggle";

export { resolveNotificationLink, siteOfBell, siteOfPath, type Site, type SiteUrls, type ResolvedLink } from "./links";

/** What the realtime events carry (notify.service: the count, and maybe a title some day). */
type CountEvent = { unreadCount?: number | null; title?: string | null } | undefined;

/** The bell's shake: rotate about the top, transform only, 600 ms. */
const RING: Keyframe[] = [
  { transform: "rotate(0deg) scale(1)" },
  { transform: "rotate(16deg) scale(1.08)", offset: 0.15 },
  { transform: "rotate(-14deg) scale(1.08)", offset: 0.35 },
  { transform: "rotate(9deg) scale(1.04)", offset: 0.55 },
  { transform: "rotate(-5deg) scale(1.02)", offset: 0.75 },
  { transform: "rotate(0deg) scale(1)" },
];

const reducedMotion = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Whether the shared realtime socket is connected (false while signed out: no socket is opened). */
function useSocketConnected(enabled: boolean, audience: Parameters<typeof realtimeSocket>[0]): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!enabled) return () => undefined;
      const socket = realtimeSocket(audience);
      socket.on("connect", onChange);
      socket.on("disconnect", onChange);
      socket.on("connect_error", onChange);
      return () => {
        socket.off("connect", onChange);
        socket.off("disconnect", onChange);
        socket.off("connect_error", onChange);
      };
    },
    [enabled, audience]
  );
  return useSyncExternalStore(
    subscribe,
    () => enabled && realtimeSocket(audience).connected,
    () => false
  );
}

/**
 * The bell "Updates" (M08 §4.1): unread badge from the server (99+ cap), a dropdown with the latest
 * 20 (All / Unread), mark-all-read, See all and Settings. Realtime: notification.created and
 * notification.read carry the unread count; the list re-reads when one arrives. While the socket is
 * not connected the bell polls instead (every 30 s, and on focus). A link that belongs to another
 * Kriraghor site (a /vendor link on kriraghor.com, a /me link on the business panel) opens on that
 * site; `here` names the current one (inferred from `centreHref` when left out).
 *
 * A new unread notification (a realtime event, or a re-read showing the count went up) is noticed:
 * a soft chime (per-browser switch, on by default), a short shake of the icon (not under reduced
 * motion), a polite screen-reader announcement and, in a hidden tab, "(3) " in front of the title.
 */
export function NotificationBell({ centreHref, settingsHref, here }: { centreHref: string; settingsHref?: string; here?: Site }) {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const { status, audience } = useAuth();
  const signedIn = status === "signed_in";
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [announcement, setAnnouncement] = useState<{ id: number; text: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  /** The last unread count seen (null before the first load): a rise over it is news. */
  const seen = useRef<number | null>(null);
  /** A realtime event chimed before the list had the new item: announce it when the list arrives. */
  const announcePending = useRef(false);
  /** The document title carries "(n) " because news came while the tab was hidden. */
  const titled = useRef(false);

  const connected = useSocketConnected(signedIn, audience);
  const plan = pollPlan(signedIn, connected);

  const announce = (title: string | undefined) =>
    setAnnouncement((a) => ({ id: (a?.id ?? 0) + 1, text: title ? t("newOne", { title }) : t("newGeneric") }));

  /** Records a server count; on a rise: chime, shake and (hidden tab) the title count. Returns the rise. */
  const observe = (count: number | null | undefined): boolean => {
    if (typeof count !== "number" || !Number.isFinite(count)) return false;
    const rise = shouldChime(seen.current, count);
    seen.current = count;
    if (!rise) return false;
    if (readSoundSetting()) playChime();
    const icon = iconRef.current;
    if (icon && typeof icon.animate === "function" && !reducedMotion()) icon.animate(RING, { duration: 600, easing: "ease-out" });
    if (typeof document !== "undefined" && document.hidden) {
      titled.current = true;
      document.title = titleWithUnread(document.title, count);
    }
    return true;
  };

  const q = useQuery({
    queryKey: ["bell", audience, tab],
    enabled: signedIn,
    queryFn: async () => {
      const page = await listNotifications(audience, { limit: 20, unread: tab === "unread" });
      const rise = observe(page.unreadCount);
      if (rise || announcePending.current) {
        announcePending.current = false;
        announce(newestUnreadTitle(page.items));
      }
      return page;
    },
    // Fallback while realtime is down (FR-04 keeps the server count as the truth either way).
    refetchInterval: plan.intervalMs,
    refetchIntervalInBackground: true,
  });
  // The server count is the truth; realtime events, polling and actions refetch it (FR-04).
  const unread = q.data?.unreadCount ?? 0;

  useEffect(() => {
    if (signedIn) armAudioOnGesture();
  }, [signedIn]);

  const refetchBell = () => qc.invalidateQueries({ queryKey: ["bell", audience] });
  const onCreatedEvent = useEffectEvent(async (e: CountEvent) => {
    // The event's count chimes at once; the re-read that follows sees the same count and stays quiet.
    if (observe(e?.unreadCount)) {
      if (e?.title) announce(e.title);
      else announcePending.current = true;
    }
    await refetchBell().catch(() => undefined);
    if (announcePending.current) {
      // The list could not be re-read: announce without a title.
      announcePending.current = false;
      announce(undefined);
    }
  });
  const onReadEvent = useEffectEvent((e: CountEvent) => {
    observe(e?.unreadCount);
    void refetchBell();
  });

  useEffect(() => {
    if (!signedIn) return;
    const socket = realtimeSocket(audience);
    const onCreated = (e: CountEvent) => void onCreatedEvent(e);
    const onRead = (e: CountEvent) => onReadEvent(e);
    // Re-read on (re)connect so the badge is right even if an emit was missed.
    const onConnect = () => void qc.invalidateQueries({ queryKey: ["bell", audience] });
    socket.on("notification.created", onCreated);
    socket.on("notification.read", onRead);
    socket.on("connect", onConnect);
    return () => {
      socket.off("notification.created", onCreated);
      socket.off("notification.read", onRead);
      socket.off("connect", onConnect);
    };
  }, [signedIn, audience, qc]);

  // Polling also re-reads when the window regains focus or the tab becomes visible.
  useEffect(() => {
    if (!plan.onFocus) return;
    const refetch = () => {
      if (document.visibilityState === "visible") void qc.invalidateQueries({ queryKey: ["bell", audience] });
    };
    window.addEventListener("focus", refetch);
    document.addEventListener("visibilitychange", refetch);
    return () => {
      window.removeEventListener("focus", refetch);
      document.removeEventListener("visibilitychange", refetch);
    };
  }, [plan.onFocus, audience, qc]);

  // The "(n) " title count: kept current while hidden, removed when the tab is visible or all is read.
  useEffect(() => {
    if (!titled.current) return;
    if (document.hidden && unread > 0) document.title = titleWithUnread(document.title, unread);
    else {
      titled.current = false;
      document.title = titleWithoutUnread(document.title);
    }
  }, [unread]);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !titled.current) return;
      titled.current = false;
      document.title = titleWithoutUnread(document.title);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (titled.current) {
        titled.current = false;
        document.title = titleWithoutUnread(document.title);
      }
    };
  }, []);

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
    const env = publicEnv();
    const site = here ?? siteOfBell(centreHref, typeof window === "undefined" ? null : window.location.origin, env.ESPORTS_URL, env.GYM_URL);
    const target = resolveNotificationLink(n.link, { here: site, webUrl: env.WEB_URL, vendorUrl: env.VENDOR_URL, adminUrl: env.ADMIN_URL, esportsUrl: env.ESPORTS_URL, gymUrl: env.GYM_URL });
    if (!target) return;
    if (target.external) window.location.assign(target.href);
    else router.push(target.href);
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
        <span ref={iconRef} className="inline-flex origin-[50%_15%]">
          <Bell size={22} weight={open ? "fill" : "regular"} aria-hidden />
        </span>
        {badge ? (
          <span className="absolute right-0.5 top-0.5 min-w-5 rounded-pill bg-live px-1 text-center text-xs font-bold leading-5 text-white tabular-nums ring-2 ring-surface" data-testid="notification-badge">
            {badge}
          </span>
        ) : null}
      </button>
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="notification-announcer">
        {announcement ? <span key={announcement.id}>{announcement.text}</span> : null}
      </div>

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
            <div className="basis-full border-t border-line pt-1">
              <SoundToggle compact />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

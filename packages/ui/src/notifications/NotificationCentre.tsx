"use client";

import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "../i18n/navigation";
import { useAuth } from "../auth";
import { listNotifications, markRead, relativeTime } from "@kriraghor/api-client/notifications";
import { Button, Notice } from "../primitives";
import { publicEnv } from "@kriraghor/session/env";
import { resolveNotificationLink, siteOfBell } from "./links";

const CATEGORIES = ["security", "money", "bookings", "hire", "orders", "offers", "tournaments", "moderation", "disputes_reports", "reviews", "staff_ops"] as const;

/** Notification centre (M08 §4.2): every notification, newest first, category and unread filters. */
export function NotificationCentre({ settingsHref, signInHref }: { settingsHref?: string; signInHref: string }) {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const { status, audience } = useAuth();
  const [unread, setUnread] = useState(false);
  const [category, setCategory] = useState("");

  const q = useInfiniteQuery({
    queryKey: ["notification-centre", audience, unread, category],
    enabled: status === "signed_in",
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listNotifications(audience, { limit: 30, unread, category: category || undefined, cursor: pageParam }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const unreadCount = q.data?.pages[0]?.unreadCount ?? 0;

  if (status === "signed_out") {
    return (
      <div className="mx-auto max-w-3xl px-5 py-12">
        <Notice>
          {t("signedOut")}{" "}
          <Link href={signInHref} className="underline">
            {t("signIn")}
          </Link>
        </Notice>
      </div>
    );
  }

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["notification-centre", audience] }), qc.invalidateQueries({ queryKey: ["bell", audience] })]);

  return (
    <div className="mx-auto max-w-3xl px-5 pb-16 pt-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        {settingsHref ? (
          <Link href={settingsHref} className="ml-auto text-sm font-semibold underline">
            {t("settings")}
          </Link>
        ) : null}
      </div>
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-xs font-semibold text-muted">
          {t("category")}
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="min-h-11 field px-3 text-sm text-ink">
            <option value="">{t("allCategories")}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={unread} onChange={(e) => setUnread(e.target.checked)} className="size-5 accent-brand" />
          {t("unreadOnly")}
        </label>
        <div className="ml-auto">
          <Button
            type="button"
            disabled={!unreadCount}
            onClick={async () => {
              await markRead(audience, { all: true, before: new Date().toISOString() });
              await refresh();
            }}
          >
            {t("markAllRead")}
          </Button>
        </div>
      </div>

      <div className="mt-4 glass-card">
        {q.isPending ? (
          <p className="p-5 text-muted" role="status">
            {t("loading")}
          </p>
        ) : q.isError ? (
          <p className="p-5">
            {t("error")}{" "}
            <button type="button" className="underline" onClick={() => void q.refetch()}>
              {t("retry")}
            </button>
          </p>
        ) : !items.length ? (
          <p className="p-5 text-muted">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={n.id} className={n.readAt ? "" : "bg-brand-soft/40"}>
                <button
                  type="button"
                  className="flex w-full gap-3 px-5 py-4 text-left"
                  onClick={async () => {
                    if (!n.readAt) {
                      await markRead(audience, { ids: [n.id] });
                      await refresh();
                    }
                    // Links that belong to another site (a member link on the business panel) open there.
                    const env = publicEnv();
                    const here = siteOfBell(signInHref, typeof window === "undefined" ? null : window.location.origin, env.ESPORTS_URL, env.GYM_URL);
                    const target = resolveNotificationLink(n.link, { here, webUrl: env.WEB_URL, vendorUrl: env.VENDOR_URL, adminUrl: env.ADMIN_URL, esportsUrl: env.ESPORTS_URL, gymUrl: env.GYM_URL });
                    if (target?.external) window.location.assign(target.href);
                    else if (target) router.push(target.href);
                  }}
                >
                  <span aria-hidden className={`mt-2 inline-block size-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-brand"}`} />
                  <span className="min-w-0">
                    <span className="block font-semibold">{n.title}</span>
                    <span className="block text-sm text-muted">{n.body}</span>
                    <span className="mt-1 block text-xs text-muted">
                      {relativeTime(n.createdAt, locale)} · {t(`categories.${n.category}` as never)}
                      {n.roleContext ? ` · ${n.roleContext}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {q.hasNextPage ? (
        <div className="mt-4">
          <button type="button" className="rounded-control min-h-11 border border-line-strong/60 px-4 text-sm font-semibold" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>
            {t("more")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

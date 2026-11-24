"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle, ShieldStar } from "@phosphor-icons/react";
import { Link, useRouter } from "@kriraghor/ui/i18n/navigation";
import { api } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { Badge, Card, PageTitle, SectionHeading, Skeleton } from "@kriraghor/ui/kit";
import { LiveStatus } from "@kriraghor/ui/live-status";
import { dashboards, type Period } from "@/lib/dashboard";
import { ADMIN_HOME_FILTERS } from "@/lib/admin/queues";
import { useUrlFilters } from "@/lib/use-url-filters";
import { adminSections } from "@/lib/panel-nav";
import { PlatformCharts, PlatformTiles } from "./admin/PlatformOverview";
import { StaffQueues } from "./admin/StaffQueues";

const noChange = () => () => {};

/** Morning, afternoon or evening in Dhaka (the desk works on Dhaka time wherever the browser is). */
export function dhakaPart(now: Date): "morning" | "afternoon" | "evening" {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Dhaka" }).format(now));
  return h >= 4 && h < 12 ? "morning" : h >= 12 && h < 17 ? "afternoon" : "evening";
}

/**
 * Admin desk home, a start-here page (UI v2, 11 Nov 2026; dashboards round 3, 25 Nov 2026, M19-FR-30).
 * Only an admin session (staff, TOTP passed) gets here; anyone else is sent to the staff sign-in. In
 * order: the greeting; for masters and view_analytics staff the platform tiles with the period (kept in
 * the URL, 30 days by default); "Needs your action" as one counted card per queue this person works
 * (M19-FR-29); the platform charts; the desks they can open, grouped as in the menu; and what their
 * permissions let them do in plain words. Staff without analytics see the queues and desks only.
 */
export function AdminHome() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const { status } = useAuth();
  const filters = useUrlFilters(ADMIN_HOME_FILTERS);
  const period = filters.values.period as Period;
  // The greeting needs the clock, which the server render does not have (it shows the desk's name).
  const part = useSyncExternalStore(noChange, () => dhakaPart(new Date()), () => null);

  useEffect(() => {
    if (status === "signed_out") router.replace("/admin/sign-in");
  }, [status, router]);

  const me = useQuery({
    queryKey: ["admin-me"],
    enabled: status === "signed_in",
    queryFn: async () => {
      const { data, error } = await api("admin").GET("/admin/me");
      if (error) throw error;
      return data;
    },
  });
  const actions = useQuery({ queryKey: ["staff-actions"], enabled: status === "signed_in", queryFn: () => dashboards.staffActions() });

  if (status !== "signed_in" || !me.data) {
    return (
      <section className="mx-auto max-w-[1200px] px-5 py-10" role="status" aria-label={t("me.loading")}>
        <Skeleton className="h-24 rounded-card" />
        <Skeleton className="mt-6 h-40 rounded-card" />
      </section>
    );
  }

  const u = me.data;
  const first = u.displayName.trim().split(/\s+/)[0] ?? u.displayName;
  // Every desk this person can open, as in the menu, without the home itself.
  const sections = adminSections(u)
    .map((s) => ({ ...s, items: s.items.filter((it) => it.href !== "/admin") }))
    .filter((s) => s.items.length);
  const perms = [...u.permissions].filter((p) => t.has(`staffDesk.perm.${p}.label`));
  // Masters and view_analytics staff see the platform numbers (Q104).
  const analytics = u.isMaster || u.permissions.includes("view_analytics" as never);

  return (
    <section className="mx-auto flex max-w-[1200px] flex-col gap-10 px-5 py-10" data-testid="admin-home">
      <PageTitle
        eyebrow={
          <span className="inline-flex items-center gap-2">
            {t("admin.home")}
            {u.isMaster ? (
              <Badge tone="prize" icon={<ShieldStar size={14} weight="fill" aria-hidden />}>
                {t("admin.master")}
              </Badge>
            ) : null}
          </span>
        }
        title={part ? t(`admin.greeting.${part}`, { name: first }) : t("admin.home")}
        description={
          <span data-testid="admin-welcome">
            {t("admin.welcome", { name: u.displayName })}. {t("admin.lead")}
          </span>
        }
      />

      {analytics ? <PlatformTiles period={period} onPeriod={(p) => filters.set({ period: p })} locale={locale} /> : null}

      <div className="flex flex-col gap-3" data-testid="admin-actions">
        <SectionHeading title={t("dashboard.actions.title")} />
        {actions.data ? (
          <StaffQueues items={actions.data.items} />
        ) : actions.isError ? (
          <p className="text-sm text-muted">{t("dashboard.loadFailed")}</p>
        ) : (
          <Skeleton className="h-32 rounded-card" />
        )}
      </div>

      {analytics ? <PlatformCharts period={period} locale={locale} /> : null}

      <div className="flex flex-col gap-3" data-testid="admin-desks">
        <SectionHeading title={t("admin.desksTitle")} />
        <p className="-mt-1 text-sm text-muted">{t("admin.desksLead")}</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sections.map((s) => (
            <Card key={s.key} className="flex flex-col gap-1 p-4 sm:p-4" data-testid={`desk-group-${s.key}`}>
              <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">{t(`panel.sections.${s.key}`)}</p>
              {s.items.map((it) => {
                const Icon = it.icon;
                return (
                  <Link key={it.href} href={it.href} className="group flex min-h-11 items-center gap-3 rounded-control px-2 py-1.5 font-semibold text-ink no-underline transition-colors hover:bg-surface-2" data-testid={`desk-${it.key}`}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-soft text-brand-text">
                      <Icon size={18} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{t(`nav.${it.key}`)}</span>
                  </Link>
                );
              })}
            </Card>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3" data-testid="admin-permissions">
        <SectionHeading title={t("admin.canTitle")} />
        {u.isMaster ? (
          <p className="text-sm text-muted">{t("admin.canMaster")}</p>
        ) : perms.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {perms.map((p) => (
              <li key={p} className="flex items-start gap-3 rounded-card border border-line bg-surface p-4">
                <CheckCircle size={20} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-brand" />
                <span>
                  <span className="block font-semibold">{t(`staffDesk.perm.${p}.label`)}</span>
                  <span className="block text-sm text-muted">{t(`staffDesk.perm.${p}.desc`)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("admin.canNone")}</p>
        )}
      </div>

      <LiveStatus />
    </section>
  );
}

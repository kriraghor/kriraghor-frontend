"use client";

import type { ReactNode } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { CalendarCheck, Package, SoccerBall, Barbell, Trophy, Wallet, ListChecks } from "@phosphor-icons/react";
import { api } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { KpiTile } from "@kriraghor/ui/charts";
import { SectionHeading, Skeleton } from "@kriraghor/ui/kit";
import type { Period } from "@/lib/dashboard";
import { buildSummary, type MoneyKey } from "@/lib/vendor/summary";
import type { BusinessRole } from "@/lib/panel-nav";
import type { DashRole } from "@/lib/vendor/analytics";
import { dashboardKey, fetchDashboard, sameBusiness, type AnyDashboard, type Target } from "./BusinessDashboards";
import { AsOf, TileDelta, useFmt, useSparkLabels } from "./chart-parts";

/** M07: the next payout, what is on hold and what was paid this month (also the setup checklists' payout step). */
export function usePayoutSummary() {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["my-payout-summary"],
    enabled: status === "signed_in",
    retry: false,
    queryFn: async () => {
      const { data, error } = await api().GET("/me/payouts/summary");
      if (error || !data) throw error ?? new Error("payout summary unavailable");
      return data;
    },
  });
}

const ICON: Record<MoneyKey, ReactNode> = { venue: <SoccerBall aria-hidden />, shop: <Package aria-hidden />, gym: <Barbell aria-hidden />, organiser: <Trophy aria-hidden /> };
const DEF: Record<MoneyKey, string> = { venue: "revenue", shop: "sales", gym: "pass_sales", organiser: "entry_fees" };
const ROLE: Record<MoneyKey, DashRole> = { venue: "ground_owner", shop: "shop_owner", gym: "gym_owner", organiser: "organiser" };
const MONEY_KEYS: readonly MoneyKey[] = ["venue", "shop", "gym", "organiser"];
const shimmer = (w: string) => <span aria-hidden className={`kg-shimmer inline-block h-8 ${w} rounded-control bg-surface-2`} />;

/**
 * The vendor home's summary strip (round 2): for the chosen period, a money tile per kind of
 * business the person runs (never one summed figure, lib/vendor/summary), each with its count, then
 * the next payout and the to-do. The dashboards are the same queries as the business cards below,
 * so nothing is asked twice.
 */
export function SummaryStrip({ period, roles, orgIds, actions, actionsHref }: { period: Period; roles: readonly BusinessRole[]; orgIds: readonly string[]; actions: { lines: number; urgent: number } | null; actionsHref: string }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const f = useFmt();
  const { status } = useAuth();
  const targets: Target[] = [
    ...(["ground_owner", "shop_owner", "gym_owner"] as const).filter((r) => roles.includes(r)).map((role) => ({ role })),
    ...(roles.includes("organiser") ? orgIds.map((orgId) => ({ role: "organiser" as const, orgId })) : []),
  ];
  const qs = useQueries({
    queries: targets.map((b) => ({ queryKey: dashboardKey(b, period, locale), enabled: status === "signed_in", retry: false, placeholderData: (prev: AnyDashboard | undefined) => (prev && sameBusiness(prev, b) ? prev : undefined), queryFn: () => fetchDashboard(b, period, locale) })),
  });
  const payouts = usePayoutSummary();
  const got = (role: DashRole) => qs.map((q) => q.data).filter((d): d is AnyDashboard => Boolean(d) && d?.role === role);
  const summary = buildSummary({
    period,
    venue: got("ground_owner")[0] as Extract<AnyDashboard, { role: "ground_owner" }> | undefined,
    shop: got("shop_owner")[0] as Extract<AnyDashboard, { role: "shop_owner" }> | undefined,
    gym: got("gym_owner")[0] as Extract<AnyDashboard, { role: "gym_owner" }> | undefined,
    organisers: got("organiser") as Extract<AnyDashboard, { role: "organiser" }>[],
    payouts: payouts.data ?? null,
    actions,
  });
  const first = qs.find((q) => q.data)?.data;
  const sparkLabels = useSparkLabels(first?.buckets ?? [], period);
  const pending = (key: MoneyKey) => {
    const mine = qs.filter((_, i) => targets[i].role === ROLE[key]);
    return { loading: mine.some((q) => q.isPending), failed: mine.length > 0 && mine.every((q) => q.isError) };
  };
  const keys = MONEY_KEYS.filter((k) => targets.some((b) => b.role === ROLE[k]));
  const defs = (key: MoneyKey) => got(ROLE[key])[0]?.definitions[DEF[key]];
  const count = (key: MoneyKey, n: number) => t(`summary.${key}Count`, { n });
  const total = keys.length + 2;
  const cols = total <= 3 ? "lg:grid-cols-3" : total === 4 ? "lg:grid-cols-4" : total === 5 ? "lg:grid-cols-5" : "lg:grid-cols-3 xl:grid-cols-6";
  const date = (iso: string) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso));
  const p = summary.payouts;
  const todo = summary.todo;
  return (
    <section className="mt-6" data-testid="vendor-summary" aria-labelledby="vendor-summary-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SectionHeading id="vendor-summary-title" title={t("summary.title")} />
        <div className="flex flex-wrap items-baseline gap-x-3 text-sm text-muted">
          <span>{t(`scope.${period}`)}</span>
          <AsOf iso={first?.asOf} />
        </div>
      </div>
      <div className={`mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 ${cols}`}>
        {keys.map((key) => {
          const tile = summary.money.find((m) => m.key === key);
          const st = pending(key);
          if (!tile && st.loading) return <Skeleton key={key} className="h-36 rounded-card" />;
          return (
            <KpiTile
              key={key}
              testId={`summary-${key}`}
              icon={ICON[key]}
              label={t(`summary.${key}`)}
              help={defs(key) ?? t("summary.moneyHelp")}
              value={tile ? f.money(tile.value) : "–"}
              delta={tile ? <TileDelta value={tile.delta} period={period} /> : undefined}
              note={tile ? count(key, tile.count) : st.failed ? t("loadFailed") : undefined}
              spark={tile?.spark}
              sparkLabels={sparkLabels}
              sparkFormat={f.money}
            />
          );
        })}
        <Link href="/vendor/payouts" className="flex rounded-card no-underline outline-offset-2 [&>*]:flex-1">
          <KpiTile
            testId="summary-payouts"
            icon={<Wallet aria-hidden />}
            label={t("summary.payout")}
            help={t("summary.payoutHelp")}
            value={p ? f.money(p.projected) : payouts.isPending ? shimmer("w-24") : "–"}
            delta={p?.date ? <span className="inline-flex items-center gap-1 text-xs text-muted"><CalendarCheck size={14} aria-hidden />{t("summary.payoutOn", { date: date(p.date) })}</span> : undefined}
            note={p ? [t("summary.paidThisMonth", { amount: f.money(p.paidThisMonth) }), p.onHold > 0 ? t("summary.onHold", { amount: f.money(p.onHold) }) : null].filter(Boolean).join(" · ") : payouts.isError ? t("loadFailed") : undefined}
            interactive
          />
        </Link>
        <a href={actionsHref} className="flex rounded-card no-underline outline-offset-2 [&>*]:flex-1">
          <KpiTile
            testId="summary-todo"
            icon={<ListChecks aria-hidden />}
            label={t("summary.todo")}
            help={t("summary.todoHelp")}
            value={todo ? f.n(todo.lines) : shimmer("w-12")}
            tone={todo?.urgent ? "danger" : todo?.lines ? "warning" : undefined}
            note={todo ? (todo.urgent ? t("summary.urgent", { n: todo.urgent }) : todo.lines ? t("summary.todoLink") : t("summary.allClear")) : undefined}
            interactive
          />
        </a>
      </div>
      {keys.length > 1 ? <p className="mt-2 text-xs text-muted">{t("summary.moneyHelp")}</p> : null}
    </section>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { CashRegister, QrCode, UploadSimple, UserPlus } from "@phosphor-icons/react";
import { BarChart, DeltaBadge, KpiTile, LineChart, compact, compactTaka, pctChange } from "@kriraghor/ui/charts";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { ActionGrid, ActionTile, ButtonLink, ChecklistCard, Notice, SectionHeading, Skeleton, type ChecklistStep } from "@kriraghor/ui/kit";
import { featureLocked, gymManage } from "@/lib/gym-manage";
import { canOpen } from "@/lib/manage-nav";
import { GymPage, Upsell, useDeskPackages, useFmt, useGymError, type GymCtx } from "./common";
import { EndingSoon, MemberMix } from "../gym-ops/EndingSoon";

/**
 * /manage/[gymId] (M24 §4.1): today at a glance. Check-ins, members, expiring, not seen, requests and
 * dues; the money tiles only when the API sends them (the owner, reports.view). Each tile opens the
 * list behind it. M27: who ends soon, with Call and WhatsApp, and the membership mix.
 *
 * UI v2 (start here): for the owner of a new gym, the first-days checklist (set up, packages, the first
 * member) until it is done; for everyone, the three jobs of the front desk as big tiles.
 */
export function Dashboard({ gymId }: { gymId: string }) {
  const t = useTranslations("gm");
  return (
    <GymPage gymId={gymId} page="dashboard" title={t("dash.title")} back={{ href: "/manage", label: t("myGyms") }} testId="gym-dashboard">
      {(ctx) => <Body ctx={ctx} />}
    </GymPage>
  );
}

function Body({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gm");
  const tv = useTranslations("gv");
  const f = useFmt();
  const err = useGymError();
  const { gymId } = ctx;
  const q = useQuery({ queryKey: ["gm-overview", gymId], queryFn: () => gymManage.overview(gymId), refetchInterval: 60_000 });
  // The checklist's packages step: the owner only (staff never see the checklist).
  const packages = useDeskPackages(gymId, ctx.owner);
  if (q.isPending) return <Skeleton className="h-64 rounded-card" />;
  if (q.isError) return <Notice tone="error">{err(q.error)}</Notice>;
  const o = q.data;
  const tl = o.tiles;
  const base = `/manage/${gymId}`;
  const can = (page: Parameters<typeof canOpen>[0]) => canOpen(page, ctx.perms);
  const days = o.trend.map((d) => `${f.weekday(d.date)} ${f.short(d.date)}`);
  const lastWeek = t("dash.vsLastWeek", { day: f.weekday(o.compare.date) });
  // First days (owner): each step done by what the gym already has; hidden once all three are.
  const steps: ChecklistStep[] = [
    { key: "setup", label: t("first.setup"), hint: t("first.setupHint"), done: o.setupDone, href: `/start?gym=${gymId}&step=code` },
    { key: "packages", label: t("first.packages"), hint: t("first.packagesHint"), done: packages.all.length > 0, href: `${base}/packages` },
    { key: "member", label: t("first.member"), hint: t("first.memberHint"), done: tl.members > 0, href: `${base}/members/new` },
  ];
  const quick = [
    can("desk") ? { key: "desk", href: `${base}/desk`, icon: <QrCode aria-hidden />, title: t("nav.desk"), hint: t("first.quickDesk"), testId: "dash-desk", count: undefined as number | undefined } : null,
    ctx.can("members.edit") ? { key: "member", href: `${base}/members/new`, icon: <UserPlus aria-hidden />, title: t("members.add"), hint: t("first.quickMember"), testId: "dash-add-member", count: undefined } : null,
    can("fees") ? { key: "fees", href: `${base}/fees`, icon: <CashRegister aria-hidden />, title: t("nav.fees"), hint: t("first.quickFees"), testId: "dash-fees", count: tl.overdueCount || undefined } : null,
    ctx.owner && tl.members === 0 ? { key: "import", href: `${base}/import`, icon: <UploadSimple aria-hidden />, title: t("nav.import"), hint: t("first.quickImport"), testId: "dash-import", count: undefined } : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);
  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-lg font-bold">{ctx.gym.name}</h2>
      {!o.setupDone ? (
        ctx.owner ? (
          <Notice tone="warning" title={t("gyms.setupTitle")} action={<ButtonLink href={`/start?gym=${gymId}&step=code`} size="sm" data-testid="dash-setup">{t("gyms.setupCta")}</ButtonLink>}>
            {t("gyms.setupBody")}
          </Notice>
        ) : (
          <Notice tone="info">{t("gyms.setupStaff")}</Notice>
        )
      ) : null}
      {o.restricted ? <Notice tone="error" title={t("dash.restrictedTitle")}>{t("dash.restrictedBody")}</Notice> : null}
      {ctx.owner && packages.q.isSuccess ? (
        <ChecklistCard title={t("first.title")} description={t("first.description")} score={(steps.filter((s) => s.done).length / steps.length) * 100} steps={steps} testId="dash-first" />
      ) : null}
      {quick.length ? (
        <div className="flex flex-col gap-3">
          <SectionHeading title={t("first.quickTitle")} />
          <ActionGrid testId="dash-quick">
            {quick.map((a, i) => (
              <ActionTile key={a.key} href={a.href} icon={a.icon} title={a.title} hint={a.hint} count={a.count} tone={i === 0 ? "accent" : "brand"} testId={a.testId} />
            ))}
          </ActionGrid>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionHeading title={t("first.todayTitle")} />
        <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
          {f.weekday(o.date)} {f.date(o.date)}
          {tl.inGymNow > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-text" data-testid="dash-in-gym">
              <span aria-hidden className="size-2 animate-pulse rounded-pill bg-brand" />
              {t("dash.inGymNow", { n: f.n(tl.inGymNow) })}
            </span>
          ) : null}
        </span>
      </div>
      <div className="-mt-3 grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="dash-tiles">
        <Linked href={can("desk") ? `${base}/desk` : undefined}>
          <KpiTile
            label={t("dash.checkInsToday")}
            value={f.n(tl.checkInsToday)}
            delta={<DeltaBadge value={pctChange(tl.checkInsToday, o.compare.checkIns)} kind="pct" label={lastWeek} />}
            spark={o.trend.map((d) => d.checkIns)}
            sparkLabels={days}
            sparkFormat={f.n}
            help={t("dash.checkInsHelp")}
            interactive={can("desk")}
            testId="tile-checkins"
          />
        </Linked>
        {tl.collectedTodayPoisha !== undefined ? (
          <Linked href={can("closing") ? `${base}/fees/closing` : undefined}>
            <KpiTile
              label={t("dash.collectedToday")}
              value={f.taka(tl.collectedTodayPoisha)}
              delta={<DeltaBadge value={pctChange(tl.collectedTodayPoisha, o.compare.collectedPoisha)} kind="pct" label={lastWeek} />}
              spark={o.trend.map((d) => d.collectedPoisha ?? 0)}
              sparkLabels={days}
              sparkFormat={(n) => f.taka(n)}
              help={t("dash.collectedHelp")}
              interactive={can("closing")}
              testId="tile-collected"
            />
          </Linked>
        ) : null}
        <Linked href={can("members") ? `${base}/members?view=active` : undefined}>
          <KpiTile label={t("dash.activeMembers")} value={f.n(tl.activeMembers)} note={t("dash.ofMembers", { n: f.n(tl.members) })} interactive={can("members")} testId="tile-active" />
        </Linked>
        <Linked href={can("fees") ? `${base}/fees?view=overdue` : undefined}>
          <KpiTile label={t("dash.overdue")} value={f.n(tl.overdueCount)} tone={tl.overdueCount ? "danger" : undefined} help={t("dash.overdueHelp")} interactive={can("fees")} testId="tile-overdue" />
        </Linked>
        <Linked href={can("members") ? `${base}/members?view=expiring` : undefined}>
          <KpiTile label={t("dash.expiringThisWeek")} value={f.n(tl.expiringThisWeek)} tone={tl.expiringThisWeek ? "warning" : undefined} interactive={can("members")} testId="tile-expiring" />
        </Linked>
        <Linked href={can("members") ? `${base}/members?view=notSeen` : undefined}>
          <KpiTile label={t("dash.notSeen", { days: tl.notSeenDays })} value={f.n(tl.notSeen)} help={t("dash.notSeenHelp")} interactive={can("members")} testId="tile-not-seen" />
        </Linked>
      </div>
      <nav aria-label={t("dash.more")} className="-mt-2 flex flex-wrap gap-2" data-testid="dash-more">
        <MoreLink href={can("fees") ? `${base}/fees?view=today` : undefined} label={t("dash.dueToday")} value={tl.dueTodayPoisha !== undefined && tl.dueTodayCount ? `${f.n(tl.dueTodayCount)} · ${f.taka(tl.dueTodayPoisha)}` : f.n(tl.dueTodayCount)} testId="tile-due-today" />
        <MoreLink href={can("members") ? `${base}/members` : undefined} label={t("dash.newThisMonth")} value={f.n(tl.newThisMonth)} testId="tile-new" />
        <MoreLink href={can("requests") ? `${base}/requests` : undefined} label={t("dash.requestsWaiting")} value={f.n(tl.requestsWaiting)} testId="tile-requests" />
        {tl.guestsToday !== undefined ? <MoreLink href={can("desk") ? `${base}/desk` : undefined} label={tv("dash.guestsToday")} value={f.n(tl.guestsToday)} testId="tile-guests" /> : null}
      </nav>
      <div className={tl.collectedTodayPoisha !== undefined ? "grid gap-4 lg:grid-cols-2" : "grid gap-4"} data-testid="dash-trend">
        <BarChart
          title={t("dash.trendCheckIns")}
          subtitle={t("dash.trendDays", { n: f.n(o.trend.length) })}
          labels={days}
          short={o.trend.map((d) => f.short(d.date))}
          series={[{ key: "checkIns", label: t("dash.checkIns"), values: o.trend.map((d) => d.checkIns) }]}
          highlight={o.trend.length - 1}
          format={f.n}
          axis={(n, top) => compact(n, f.locale, top)}
          integer
          emptyText={t("dash.noVisitsYet")}
          testId="chart-checkins"
        />
        {tl.collectedTodayPoisha !== undefined ? (
          <LineChart
            title={t("dash.trendCollected")}
            subtitle={t("dash.trendDays", { n: f.n(o.trend.length) })}
            labels={days}
            short={o.trend.map((d) => f.short(d.date))}
            series={[{ key: "collected", label: t("dash.collected"), values: o.trend.map((d) => d.collectedPoisha ?? 0) }]}
            format={(n) => f.taka(n)}
            axis={(n, top) => compactTaka(n, f.locale, top)}
            partialLast
            testId="chart-collected"
          />
        ) : null}
      </div>
      {ctx.can("members.view") ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <EndingSoon ctx={ctx} items={o.expiring} />
          <MemberMix mix={o.mix} />
        </div>
      ) : null}
      {featureLocked(o.features, "attendance") ? <Upsell feature="attendance" owner={ctx.owner} /> : null}
    </div>
  );
}

/** A tile that opens the list behind it, when the person may open that page. */
function Linked({ href, children }: { href?: string; children: ReactNode }) {
  if (!href) return <>{children}</>;
  return (
    <Link href={href} className="flex rounded-card no-underline outline-offset-2 [&>*]:flex-1">
      {children}
    </Link>
  );
}

/** A smaller count of the day as a pill link (due today, new, requests, guests). */
function MoreLink({ href, label, value, testId }: { href?: string; label: string; value: string; testId?: string }) {
  const body = (
    <>
      <span className="text-muted">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </>
  );
  const cls = "inline-flex min-h-11 items-center gap-2 rounded-pill border border-line bg-surface px-4 text-sm no-underline";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-line-strong hover:bg-surface-2`} data-testid={testId}>
      {body}
    </Link>
  ) : (
    <span className={cls} data-testid={testId}>
      {body}
    </span>
  );
}

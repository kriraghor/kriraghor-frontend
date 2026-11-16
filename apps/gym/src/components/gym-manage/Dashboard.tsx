"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CashRegister, QrCode, UploadSimple, UserPlus } from "@phosphor-icons/react";
import { ActionGrid, ActionTile, ButtonLink, ChecklistCard, Notice, SectionHeading, Skeleton, type ChecklistStep } from "@kriraghor/ui/kit";
import { featureLocked, gymManage } from "@/lib/gym-manage";
import { canOpen } from "@/lib/manage-nav";
import { GymPage, Tile, Upsell, useDeskPackages, useFmt, useGymError, type GymCtx } from "./common";
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
      <SectionHeading title={t("first.todayTitle")} />
      <div className="-mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" data-testid="dash-tiles">
        <Tile label={t("dash.checkInsToday")} value={f.n(tl.checkInsToday)} href={can("desk") ? `${base}/desk` : undefined} tone="brand" testId="tile-checkins" />
        <Tile label={t("dash.activeMembers")} value={f.n(tl.activeMembers)} hint={t("dash.ofMembers", { n: f.n(tl.members) })} href={can("members") ? `${base}/members?view=active` : undefined} />
        <Tile label={t("dash.newThisMonth")} value={f.n(tl.newThisMonth)} href={can("members") ? `${base}/members` : undefined} />
        <Tile label={t("dash.expiringThisWeek")} value={f.n(tl.expiringThisWeek)} href={can("members") ? `${base}/members?view=expiring` : undefined} tone={tl.expiringThisWeek ? "warn" : "neutral"} />
        <Tile label={t("dash.notSeen", { days: tl.notSeenDays })} value={f.n(tl.notSeen)} href={can("members") ? `${base}/members?view=notSeen` : undefined} />
        <Tile label={t("dash.requestsWaiting")} value={f.n(tl.requestsWaiting)} href={can("requests") ? `${base}/requests` : undefined} />
        {tl.guestsToday !== undefined ? <Tile label={tv("dash.guestsToday")} value={f.n(tl.guestsToday)} href={can("desk") ? `${base}/desk` : undefined} tone={tl.guestsToday ? "brand" : "neutral"} testId="tile-guests" /> : null}
        <Tile label={t("dash.dueToday")} value={f.n(tl.dueTodayCount)} hint={tl.dueTodayPoisha !== undefined ? f.taka(tl.dueTodayPoisha) : undefined} href={can("fees") ? `${base}/fees?view=today` : undefined} />
        <Tile label={t("dash.overdue")} value={f.n(tl.overdueCount)} href={can("fees") ? `${base}/fees?view=overdue` : undefined} tone={tl.overdueCount ? "warn" : "neutral"} />
        {tl.collectedTodayPoisha !== undefined ? <Tile label={t("dash.collectedToday")} value={f.taka(tl.collectedTodayPoisha)} href={can("closing") ? `${base}/fees/closing` : undefined} tone="brand" testId="tile-collected" /> : null}
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

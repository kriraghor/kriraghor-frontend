"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CashRegister, QrCode, UploadSimple, UserPlus } from "@phosphor-icons/react";
import { ButtonLink, Notice, Skeleton } from "@kriraghor/ui/kit";
import { featureLocked, gymManage } from "@/lib/gym-manage";
import { canOpen } from "@/lib/manage-nav";
import { GymPage, Tile, Upsell, useFmt, useGymError, type GymCtx } from "./common";
import { EndingSoon, MemberMix } from "../gym-ops/EndingSoon";

/**
 * /manage/[gymId] (M24 §4.1): today at a glance. Check-ins, members, expiring, not seen, requests and
 * dues; the money tiles only when the API sends them (the owner, reports.view). Each tile opens the
 * list behind it. M27: who ends soon, with Call and WhatsApp, and the membership mix.
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
  if (q.isPending) return <Skeleton className="h-64 rounded-card" />;
  if (q.isError) return <Notice tone="error">{err(q.error)}</Notice>;
  const o = q.data;
  const tl = o.tiles;
  const base = `/manage/${gymId}`;
  const can = (page: Parameters<typeof canOpen>[0]) => canOpen(page, ctx.perms);
  return (
    <div className="flex flex-col gap-4">
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
      <div className="flex flex-wrap gap-2">
        {can("desk") ? (
          <ButtonLink href={`${base}/desk`} icon={<QrCode size={18} aria-hidden />} data-testid="dash-desk">
            {t("nav.desk")}
          </ButtonLink>
        ) : null}
        {ctx.can("members.edit") ? (
          <ButtonLink href={`${base}/members/new`} variant="secondary" icon={<UserPlus size={18} aria-hidden />}>
            {t("members.add")}
          </ButtonLink>
        ) : null}
        {can("fees") ? (
          <ButtonLink href={`${base}/fees`} variant="secondary" icon={<CashRegister size={18} aria-hidden />}>
            {t("nav.fees")}
          </ButtonLink>
        ) : null}
        {ctx.owner && tl.members === 0 ? (
          <ButtonLink href={`${base}/import`} variant="secondary" icon={<UploadSimple size={18} aria-hidden />}>
            {t("nav.import")}
          </ButtonLink>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" data-testid="dash-tiles">
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

"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, LockKey } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { formatTaka } from "@kriraghor/ui/format";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Badge, ButtonLink, Card, ErrorState, Notice, Skeleton, type Tone } from "@kriraghor/ui/kit";
import { DeskAccessNotice, deskAccessKey, useDeskErrorText, useWorkplaces } from "@kriraghor/ui/desk";
import { cn } from "@kriraghor/ui/cn";
import { featureLocked, gymManage, minTierFor, type Feature, type ManageGym, type MemberSummary } from "@/lib/gym-manage";
import { canOpen, type ManageKey } from "@/lib/manage-nav";
import { gymDesk } from "@/lib/manage";

/** GET /manage/gyms: the gyms I own and the gyms I work at (the menu, the list and every page's access). */
export function useManageGyms(enabled = true) {
  return useQuery({ queryKey: ["manage-gyms"], queryFn: () => gymManage.gyms(), enabled, retry: false, staleTime: 30_000 });
}

/**
 * The gym's packages from the owner's listing read (M20 GET /me/gyms/:id), for the package editor and
 * /start. `desk` keeps the ones a membership may use (channel desk or both).
 */
export function usePackages(gymId: string, enabled: boolean) {
  const q = useQuery({ queryKey: ["vendor-gym", gymId], queryFn: () => gymDesk.get(gymId), enabled, retry: false, staleTime: 60_000 });
  const all = q.data?.packages ?? [];
  return { q, all, desk: all.filter((p) => p.channel !== "online") };
}

/**
 * The packages a membership may use (channel desk or both), from GET /manage/gyms/:gymId/packages, which
 * the owner and staff with members.view can read (M24-FR-25). Same row shape as the listing read.
 */
export function useDeskPackages(gymId: string, enabled: boolean) {
  const q = useQuery({ queryKey: ["gm-packages", gymId], queryFn: () => gymManage.packages(gymId), enabled, retry: false, staleTime: 60_000 });
  const desk = (q.data?.items ?? []).map((p) => ({ id: p.id, kind: p.kind, title: p.title, price: p.pricePoisha, admissionFee: p.admissionFeePoisha, days: p.days, channel: p.channel }));
  return { q, all: desk, desk };
}

export type GymCtx = {
  gymId: string;
  gym: ManageGym;
  owner: boolean;
  /** null for the owner (everything), the staff member's permissions otherwise. */
  perms: readonly string[] | null;
  can: (permission: string) => boolean;
};

/** This gym as the signed-in person sees it: role, permissions, plan and features. */
export function useGymCtx(gymId: string) {
  const q = useManageGyms();
  const gym = q.data?.items.find((g) => g.id === gymId) ?? null;
  const perms = gym ? (gym.role === "owner" ? null : (gym.permissions ?? [])) : null;
  const ctx: GymCtx | null = gym ? { gymId, gym, owner: gym.role === "owner", perms, can: (p: string) => perms === null || perms.includes(p) } : null;
  return { q, ctx };
}

/** Locale-aware money, dates and times (Dhaka), Bangla digits for bn. */
export function useFmt() {
  const locale = useLocale();
  const tag = locale === "bn" ? "bn-BD" : "en-GB";
  const dateF = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const shortF = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", timeZone: "UTC" });
  const timeF = new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });
  const monthF = new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: "UTC" });
  const num = new Intl.NumberFormat(tag);
  return {
    locale,
    taka: (poisha: number | null | undefined) => (poisha == null ? "–" : formatTaka(poisha, locale)),
    date: (d: string | null | undefined) => (d ? dateF.format(new Date(`${d.slice(0, 10)}T12:00:00Z`)) : "–"),
    short: (d: string | null | undefined) => (d ? shortF.format(new Date(`${d.slice(0, 10)}T12:00:00Z`)) : "–"),
    time: (iso: string | null | undefined) => (iso ? timeF.format(new Date(iso)) : ""),
    month: (m: string) => monthF.format(new Date(`${m}-15T12:00:00Z`)),
    n: (v: number) => num.format(v),
  };
}

/** A problem as friendly text: M24 codes from gm.err, the desk access answers, else the problem's title. */
export function useGymError() {
  const t = useTranslations("gm");
  const desk = useDeskErrorText();
  return (error: unknown, fallback?: string): string => {
    const p = problemOf(error) as (ReturnType<typeof problemOf> & { feature?: string; minTier?: string; reasons?: string[] }) | null;
    const fb = fallback ?? t("failed");
    if (!p) return fb;
    if (p.code === "GYM_TIER_REQUIRED") return t("err.GYM_TIER_REQUIRED", { tier: t.has(`tier.${p.minTier}`) ? t(`tier.${p.minTier}`) : (p.minTier ?? "") });
    if (t.has(`err.${p.code}`)) return t(`err.${p.code}`);
    if (p.code === "VALIDATION_FAILED" && p.errors?.length) return p.errors.map((e) => e.message).join(" · ");
    return desk(error, fb) ?? fb;
  };
}

export const MEMBER_TONE: Record<MemberSummary["status"], Tone> = { new: "info", active: "brand", frozen: "info", expired: "warning", left: "neutral", removed: "danger" };

/** A member's status pill. */
export function MemberStatus({ status }: { status: MemberSummary["status"] }) {
  const t = useTranslations("gm");
  return <Badge tone={MEMBER_TONE[status]}>{t(`memberStatus.${status}`)}</Badge>;
}

/**
 * One /manage/[gymId] page: the back link and title, then the access answers (not this gym, no
 * permission, the plan lacks the feature) before the page itself. Dense, phone first.
 */
export function GymPage({
  gymId,
  page,
  feature,
  title,
  description,
  actions,
  back,
  wide,
  children,
  testId,
}: {
  gymId: string;
  page: Exclude<ManageKey, "gyms" | "billing">;
  feature?: Feature;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode | ((ctx: GymCtx) => ReactNode);
  back?: { href: string; label: ReactNode };
  wide?: boolean;
  children: (ctx: GymCtx) => ReactNode;
  testId?: string;
}) {
  const t = useTranslations("gm");
  const err = useGymError();
  const { q, ctx } = useGymCtx(gymId);
  const wp = useWorkplaces();
  return (
    <section className={cn("mx-auto w-full px-4 py-5 sm:px-6 md:py-8", wide ? "max-w-[1280px]" : "max-w-[1100px]")} data-testid={testId}>
      <Link href={back?.href ?? (ctx ? `/manage/${gymId}` : "/manage")} className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-brand-text hover:underline">
        <ArrowLeft size={16} aria-hidden />
        {back?.label ?? ctx?.gym.name ?? t("myGyms")}
      </Link>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold md:text-3xl">{title}</h1>
          {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
        </div>
        {ctx && canOpen(page, ctx.perms) && !(feature && featureLocked(ctx.gym.features, feature)) && actions ? <div className="flex flex-wrap gap-2">{typeof actions === "function" ? actions(ctx) : actions}</div> : null}
      </div>
      <div className="mt-4">
        {q.isPending || wp.pending ? (
          <Skeleton className="h-64 rounded-card" />
        ) : q.isError ? (
          deskAccessKey(problemOf(q.error)?.code) ? (
            <DeskAccessNotice error={q.error} />
          ) : (
            <ErrorState title={err(q.error)} onRetry={() => void q.refetch()} />
          )
        ) : !ctx ? (
          <Notice tone="warning" title={t("noGym.title")}>
            {t("noGym.body")}
          </Notice>
        ) : !canOpen(page, ctx.perms) ? (
          <DeskAccessNotice code="PERMISSION_REQUIRED" />
        ) : feature && featureLocked(ctx.gym.features, feature) ? (
          <Upsell feature={feature} owner={ctx.owner} />
        ) : (
          children(ctx)
        )}
      </div>
    </section>
  );
}

/** A feature above the owner's plan: what it needs and, for the owner, the way to Billing (M24-FR-07). */
export function Upsell({ feature, owner, className }: { feature: Feature; owner: boolean; className?: string }) {
  const t = useTranslations("gm");
  const pricing = useQuery({ queryKey: ["gym-pricing"], queryFn: () => gymManage.pricing(), staleTime: 10 * 60_000 });
  const tier = pricing.data ? (pricing.data.featureMinTiers[feature] ?? minTierFor(pricing.data.tiers, feature)) : null;
  return (
    <Card className={cn("flex flex-col gap-3 border-warning/40", className)} data-testid={`upsell-${feature}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-control bg-warning-soft text-warning">
          <LockKey size={22} weight="fill" aria-hidden />
        </span>
        <div>
          <p className="font-display text-lg font-bold">{t(`upsell.${feature}.title`)}</p>
          <p className="mt-1 text-sm text-muted">
            {t(`upsell.${feature}.body`)} {tier ? t("upsell.needs", { tier: t(`tier.${tier}`) }) : null}
          </p>
        </div>
      </div>
      {owner ? (
        <ButtonLink href="/manage/billing" className="self-start" data-testid="upsell-billing">
          {t("upsell.cta")}
        </ButtonLink>
      ) : (
        <p className="text-sm font-semibold">{t("upsell.askOwner")}</p>
      )}
    </Card>
  );
}

/** A compact label/value row for dense cards. */
export function Row({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-1.5 text-sm", className)}>
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold tabular-nums">{children}</span>
    </div>
  );
}

/** A dashboard number tile (links when it has a list behind it). */
export function Tile({ label, value, hint, href, tone = "neutral", testId }: { label: ReactNode; value: ReactNode; hint?: ReactNode; href?: string; tone?: "neutral" | "warn" | "brand"; testId?: string }) {
  const body = (
    <>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      <span className={cn("font-display text-2xl font-extrabold tabular-nums md:text-3xl", tone === "warn" && "text-warning", tone === "brand" && "text-brand-text")}>{value}</span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </>
  );
  const cls = "surface-card flex min-h-24 flex-col justify-between gap-1 p-3 sm:p-4";
  return href ? (
    <Link href={href} className={cn(cls, "no-underline transition-colors hover:border-line-strong")} data-testid={testId}>
      {body}
    </Link>
  ) : (
    <div className={cls} data-testid={testId}>
      {body}
    </div>
  );
}

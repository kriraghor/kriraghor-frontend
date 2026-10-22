"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Barbell, CalendarCheck, Package, QrCode, SoccerBall, Star, Storefront, Ticket, Warehouse } from "@phosphor-icons/react";
import { useAuth } from "@kriraghor/ui/auth";
import { publicEnv } from "@kriraghor/session/env";
import { Badge, ButtonLink, Card, Notice, Skeleton } from "@kriraghor/ui/kit";
import { team, workplaceDesks, type BusinessType, type Workplace } from "@/lib/vendor/team";
import { ActionList } from "./OwnerDashboard";
import { useWorkplaces } from "./StaffAccess";

const ICON: Record<BusinessType, typeof SoccerBall> = { venue: SoccerBall, gym: Barbell, shop: Storefront };
const DESK_ICON = { bookings: CalendarCheck, reviews: Star, frontDesk: QrCode, passes: Ticket, orders: Package, inventory: Warehouse } as const;

/**
 * Round B3 "You work at": each venue, gym or shop the person works at as staff, its owner, since
 * when, and a button for each desk the owner opened to them. `type` narrows to one kind of business.
 */
export function WorkplaceCards({ type, testId = "workplaces" }: { type?: BusinessType; testId?: string }) {
  const locale = useLocale();
  const wp = useWorkplaces();
  const items = wp.named.filter((w) => !type || w.businessType === type);
  const date = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" });
  if (wp.pending) return <Skeleton className="h-24 rounded-card" />;
  if (!items.length) return null;
  return (
    <ul className="grid gap-3 md:grid-cols-2" data-testid={testId}>
      {items.map((w) => (
        <li key={w.id}>
          <WorkplaceCard w={w} since={date.format(new Date(w.since))} />
        </li>
      ))}
    </ul>
  );
}

function WorkplaceCard({ w, since }: { w: Workplace; since: string }) {
  const t = useTranslations("team.work");
  const tt = useTranslations("team");
  const Icon = ICON[w.businessType];
  const desks = workplaceDesks(w);
  return (
    <Card className="flex h-full flex-col gap-3" data-testid="workplace">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-control bg-brand-soft text-brand-text">
          <Icon size={22} weight="fill" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold">{w.business.name ?? tt(`type.${w.businessType}`)}</p>
          <p className="text-sm text-muted">{w.owner.displayName ? t("owner", { name: w.owner.displayName }) : tt(`type.${w.businessType}`)}</p>
          <p className="text-xs text-muted">{t("since", { date: since })}</p>
        </div>
        <Badge>{tt(`type.${w.businessType}`)}</Badge>
      </div>
      <p className="text-sm">
        <span className="font-semibold">{t("youCan")}</span> {w.permissions.map((p) => (tt.has(`perm.${p}`) ? tt(`perm.${p}`) : p)).join(", ") || tt("none")}
      </p>
      {desks.length ? (
        <div className="mt-auto flex flex-wrap gap-2">
          {desks.map((d, i) => {
            const DeskIcon = DESK_ICON[d.key];
            return (
              <ButtonLink key={d.key} href={d.href} variant={i === 0 ? "primary" : "secondary"} icon={<DeskIcon size={18} aria-hidden />} data-testid={`workplace-${d.key}`}>
                {t(`desk.${d.key}`)}
              </ButtonLink>
            );
          })}
        </div>
      ) : (
        <p className="mt-auto text-sm text-muted">{t("noDesk")}</p>
      )}
    </Card>
  );
}

/** The staff to-do (M19 actions, role business_staff): counts per workplace, never money. */
export function StaffActions() {
  const t = useTranslations("dashboard");
  const { status } = useAuth();
  const wp = useWorkplaces();
  const q = useQuery({ queryKey: ["staff-actions"], enabled: status === "signed_in" && wp.refs.length > 0, queryFn: () => team.staffActions() });
  const names = new Map(wp.named.map((w) => [w.businessId, w.business.name] as const));
  const several = wp.refs.length > 1;
  return (
    <div data-testid="staff-actions">
      <h3 className="font-display text-lg font-bold">{t("actions.title")}</h3>
      <div className="mt-2">
        {q.data ? (
          <ActionList items={q.data.items.map((a) => ({ ...a, tag: several && a.businessId ? (names.get(a.businessId) ?? undefined) : undefined }))} />
        ) : q.isError ? (
          <p className="text-sm text-muted">{t("loadFailed")}</p>
        ) : (
          <Skeleton className="h-16 rounded-card" />
        )}
      </div>
    </div>
  );
}

/**
 * The vendor home's staff part (Round B3): a reminder to verify the phone when it is not (staff need
 * a verified phone, Q169), the to-do and "You work at". `own` says whether the person also runs a
 * business, which changes the heading only.
 */
export function StaffHome({ own }: { own: boolean }) {
  const t = useTranslations("team.work");
  const wp = useWorkplaces();
  const web = publicEnv().WEB_URL;
  if (!wp.refs.length) return null;
  return (
    <section className={own ? "mt-12" : "mt-6"} data-testid="staff-home" aria-label={t("title")}>
      {own ? <h2 className="mb-4 font-display text-2xl font-bold">{t("title")}</h2> : null}
      <div className="flex flex-col gap-6">
        {!wp.phoneVerified ? (
          <Notice
            tone="warning"
            title={t("verifyPhone")}
            action={
              <ButtonLink href={`${web}/account/settings`} size="sm" variant="secondary" iconEnd={<ArrowRight size={16} aria-hidden />}>
                {t("verifyPhoneGo")}
              </ButtonLink>
            }
          >
            {t("verifyPhoneBody")}
          </Notice>
        ) : (
          <StaffActions />
        )}
        <div>
          {!own ? <h3 className="mb-3 font-display text-lg font-bold">{t("title")}</h3> : null}
          <WorkplaceCards />
        </div>
      </div>
    </section>
  );
}

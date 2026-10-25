"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Barbell, CalendarCheck, Package, QrCode, SoccerBall, Star, Storefront, Ticket, Warehouse } from "@phosphor-icons/react";
import { api, problemOf } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { publicEnv } from "@kriraghor/session/env";
import { useAuth } from "../auth";
import { Badge, ButtonLink, Card, Notice, Skeleton } from "../kit";
import { activeBusinessRoles, deskAccessKey, type BusinessType, type WorkplaceRef } from "./access";

/** A workplace with its business and owner names (GET /me/workplaces). */
export type Workplace = components["schemas"]["BusinessWorkplace"];
/** One desk button on a workplace card. */
export type WorkplaceDesk = { key: "bookings" | "reviews" | "frontDesk" | "passes" | "orders" | "inventory"; href: string };

async function ok<T>(res: { data?: T; error?: unknown }): Promise<T> {
  if (res.error || res.data === undefined) throw problemOf(res.error) ?? res.error;
  return res.data;
}

/**
 * Round B3: where the signed-in person works as staff. `refs` (from /me, the same query as the
 * business panel's sidebar) carry the permissions every desk follows; `named` (GET /me/workplaces)
 * adds the business and owner names for the switchers, only fetched when there is a workplace.
 */
export function useWorkplaces() {
  const { status } = useAuth();
  const signedIn = status === "signed_in";
  const me = useQuery({ queryKey: ["vendor-me"], enabled: signedIn, queryFn: async () => ok(await api().GET("/me")) });
  const refs: WorkplaceRef[] = me.data?.workplaces ?? [];
  const named = useQuery({ queryKey: ["my-workplaces"], enabled: signedIn && refs.length > 0, queryFn: async () => ok(await api().GET("/me/workplaces")) });
  return {
    me,
    refs,
    named: (named.data?.items ?? []) as Workplace[],
    /** Still finding out where the person works (the desks wait, so they never flash a gate). */
    pending: signedIn && (me.isPending || (refs.length > 0 && named.isPending)),
    active: activeBusinessRoles(me.data),
    phoneVerified: me.data?.phoneVerified ?? true,
  };
}

/**
 * A desk's access answer in plain words (B3): the owner has not given this permission, verify your
 * phone, or choose a business. Anything else returns null, so the desk shows its own error.
 */
export function DeskAccessNotice({ error, code, className }: { error?: unknown; code?: string; className?: string }) {
  const t = useTranslations("team.access");
  const key = deskAccessKey(code ?? problemOf(error)?.code);
  if (!key) return null;
  return (
    <Notice
      tone={key === "BUSINESS_REQUIRED" ? "info" : "warning"}
      title={t(`${key}.title`)}
      className={className}
      action={
        key === "PHONE_REQUIRED" ? (
          <ButtonLink href={`${publicEnv().WEB_URL}/account/settings`} size="sm" variant="secondary">
            {t("PHONE_REQUIRED.action")}
          </ButtonLink>
        ) : undefined
      }
    >
      {t(`${key}.body`)}
    </Notice>
  );
}

/** The text of a desk error: the access answers in plain words, otherwise the problem's own title. */
export function useDeskErrorText() {
  const t = useTranslations("team.access");
  return (error: unknown, fallback: string) => {
    if (!error) return null;
    const p = problemOf(error);
    const key = deskAccessKey(p?.code);
    return key ? t(`${key}.body`) : (p?.title ?? fallback);
  };
}

const ICON: Record<BusinessType, typeof SoccerBall> = { venue: SoccerBall, gym: Barbell, shop: Storefront };
const DESK_ICON = { bookings: CalendarCheck, reviews: Star, frontDesk: QrCode, passes: Ticket, orders: Package, inventory: Warehouse } as const;

/**
 * Round B3 "You work at": each venue, gym or shop the person works at as staff, its owner, since
 * when, and a button for each desk the owner opened to them (`desksOf`, which knows where each site
 * keeps its desks). `type` narrows to one kind of business.
 */
export function WorkplaceCards({ type, desksOf, testId = "workplaces" }: { type?: BusinessType; desksOf: (w: Workplace) => WorkplaceDesk[]; testId?: string }) {
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
          <WorkplaceCard w={w} since={date.format(new Date(w.since))} desks={desksOf(w)} />
        </li>
      ))}
    </ul>
  );
}

function WorkplaceCard({ w, since, desks }: { w: Workplace; since: string; desks: WorkplaceDesk[] }) {
  const t = useTranslations("team.work");
  const tt = useTranslations("team");
  const Icon = ICON[w.businessType];
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

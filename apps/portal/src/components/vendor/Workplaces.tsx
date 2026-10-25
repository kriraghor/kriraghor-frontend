"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowRight } from "@phosphor-icons/react";
import { useAuth } from "@kriraghor/ui/auth";
import { publicEnv } from "@kriraghor/session/env";
import { ButtonLink, Notice, Skeleton } from "@kriraghor/ui/kit";
import { WorkplaceCards as SharedWorkplaceCards, useWorkplaces } from "@kriraghor/ui/desk";
import { team, workplaceDesks, type BusinessType } from "@/lib/vendor/team";
import { ActionList } from "./OwnerDashboard";

/**
 * Round B3 "You work at": each venue, gym or shop the person works at as staff, its owner, since
 * when, and a button for each desk the owner opened to them (the shared card, @kriraghor/ui/desk, with
 * the business panel's desk links; a gym's desks open on gym.kriraghor.com). `type` narrows to one
 * kind of business.
 */
export function WorkplaceCards({ type, testId }: { type?: BusinessType; testId?: string }) {
  return <SharedWorkplaceCards type={type} testId={testId} desksOf={workplaceDesks} />;
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

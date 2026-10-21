"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ChartLineUp } from "@phosphor-icons/react";
import { useAuth } from "@kriraghor/ui/auth";
import { ButtonLink, Dropdown, EmptyState, SegmentedControl, Skeleton } from "@kriraghor/ui/kit";
import type { Period } from "@/lib/dashboard";
import { businessView } from "@/lib/panel-nav";
import { useUrlFilters } from "@/lib/use-url-filters";
import { BUSINESS_PARAMS, businessOptions, businessQuery, pickBusiness, type Business } from "@/lib/vendor/analytics";
import { vendor } from "@/lib/vendor/grounds";
import { sportsConsole } from "@/lib/vendor/tournaments";
import { MePanel } from "../MePanel";
import { DashboardError, GymAnalytics, OrganiserAnalytics, ShopAnalytics, useBusinessDashboard } from "./BusinessDashboards";
import { PERIODS, PeriodSwitch, VenueAnalytics } from "./OwnerDashboard";

/** More businesses than this and the switcher is a dropdown at every width (on phones it always is). */
const SEGMENTS_MAX = 4;

/**
 * /vendor/analytics (M19 §4.2, §6.3): the charts and CSV exports of one business at a time. With more
 * than one business (venue, shop, gym, each sports organisation) a switcher picks it; the business
 * and the period stay in the URL, so a reload, the back button and a shared link keep them. Without
 * a choice in the URL it opens on the business the panel switcher is on.
 */
export function VendorAnalytics() {
  const t = useTranslations("dashboard");
  const { status } = useAuth();
  const signedIn = status === "signed_in";
  // The same keys as the sidebar and the vendor home, so the page asks for nothing new.
  const me = useQuery({ queryKey: ["vendor-me"], enabled: signedIn, queryFn: () => vendor.me() });
  const orgs = useQuery({ queryKey: ["my-orgs"], enabled: signedIn, queryFn: () => sportsConsole.mine() });
  const f = useUrlFilters({ business: { default: "", allowed: BUSINESS_PARAMS }, org: { default: "" }, period: { default: "7w", allowed: PERIODS } });
  const period = f.values.period as Period;
  const { active, view } = businessView(me.data);
  const options = businessOptions(active, orgs.data?.items ?? []);
  const chosen = pickBusiness(options, f.values, view);
  const d = useBusinessDashboard(chosen, period);

  if (status === "signed_out") return <MePanel signInHref="/vendor/sign-in" />;
  if (!signedIn || me.isPending || orgs.isPending) return <Skeleton className="mx-auto mt-10 h-96 max-w-[1200px] rounded-card" />;

  const lead = !chosen
    ? t("leads.none")
    : chosen.role === "ground_owner"
      ? t("analyticsLead")
      : chosen.role === "organiser"
        ? t("leads.organiser", { name: chosen.name ?? "" })
        : t(chosen.role === "shop_owner" ? "leads.shop" : "leads.gym");

  return (
    <section className="mx-auto max-w-[1200px] px-5 py-8" data-testid="vendor-analytics">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold">{t("analytics")}</h1>
          <p className="mt-1 max-w-2xl text-muted">{lead}</p>
        </div>
        {chosen ? <PeriodSwitch period={period} onChange={(p) => f.set({ period: p })} /> : null}
      </div>
      {chosen && options.length > 1 ? <BusinessSwitch options={options} chosen={chosen} onChange={(b) => f.set(businessQuery(b))} /> : null}
      <div className="mt-6">
        {!chosen ? (
          <EmptyState icon={<ChartLineUp aria-hidden />} title={t("noBusiness")} body={t("noBusinessBody")} action={<ButtonLink href="/vendor">{t("toHome")}</ButtonLink>} />
        ) : d.isPending ? (
          <Skeleton className="h-96 rounded-card" />
        ) : d.isError || !d.data ? (
          <DashboardError error={d.error} />
        ) : d.data.role === "ground_owner" ? (
          <VenueAnalytics d={d.data} />
        ) : d.data.role === "shop_owner" ? (
          <ShopAnalytics d={d.data} />
        ) : d.data.role === "gym_owner" ? (
          <GymAnalytics d={d.data} />
        ) : (
          <OrganiserAnalytics d={d.data} />
        )}
        {d.data?.asOf ? <p className="mt-4 text-xs text-muted">{t("asOf", { time: new Date(d.data.asOf).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" }) })}</p> : null}
      </div>
    </section>
  );
}

/** Which business: segments on wider screens (up to four), a dropdown on phones and for more. */
function BusinessSwitch({ options, chosen, onChange }: { options: Business[]; chosen: Business; onChange: (b: Business) => void }) {
  const t = useTranslations("dashboard");
  const label = (b: Business) => (b.role === "organiser" ? (b.name ?? t("business.organiser")) : t(`business.${b.role}`));
  const pick = (key: string) => {
    const b = options.find((o) => o.key === key);
    if (b) onChange(b);
  };
  const segments = options.length <= SEGMENTS_MAX;
  return (
    <div className="mt-5" data-testid="business-switch">
      {segments ? (
        <div className="hidden sm:block">
          <SegmentedControl label={t("business.label")} value={chosen.key} onChange={pick} options={options.map((o) => ({ value: o.key, label: label(o), testId: `business-${o.key}` }))} />
        </div>
      ) : null}
      <Dropdown id="analytics-business" label={t("business.label")} value={chosen.key} onChange={pick} options={options.map((o) => ({ value: o.key, label: label(o) }))} className={segments ? "max-w-sm sm:hidden" : "max-w-sm"} testId="business-dropdown" />
    </div>
  );
}

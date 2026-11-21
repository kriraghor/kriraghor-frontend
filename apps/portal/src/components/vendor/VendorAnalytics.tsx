"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ChartLineUp } from "@phosphor-icons/react";
import { useAuth } from "@kriraghor/ui/auth";
import { ButtonLink, Dropdown, EmptyState, SegmentedControl, Skeleton } from "@kriraghor/ui/kit";
import type { Period } from "@/lib/dashboard";
import { businessView } from "@/lib/panel-nav";
import { useUrlFilters } from "@/lib/use-url-filters";
import { ANALYTICS_FILTERS, GYM_REPORTS_HREF, businessOptions, businessQuery, pickBusiness, pickGround, type Business } from "@/lib/vendor/analytics";
import { vendor } from "@/lib/vendor/grounds";
import { sportsConsole } from "@/lib/vendor/tournaments";
import { MePanel } from "../MePanel";
import { DashboardError, GymAnalytics, OrganiserAnalytics, ShopAnalytics, useBusinessDashboard } from "./BusinessDashboards";
import { AnalyticsSkeleton, AsOf, PeriodSwitch } from "./chart-parts";
import { VenueAnalytics } from "./OwnerDashboard";

/** More businesses than this and the switcher is a dropdown at every width (on phones it always is). */
const SEGMENTS_MAX = 4;

/**
 * /vendor/analytics (M19 §4.2, §6.3; round 2 on the chart kit): the charts and CSV exports of one
 * business at a time. The business, the period (30 days by default) and, for venues, one venue
 * (`groundId`, all venues by default) stay in the URL, so a reload, the back button and a shared
 * link keep them. Without a choice in the URL it opens on the business the panel switcher is on.
 * Choosing the gym opens its reports on gym.kriraghor.com (M24 prompt 2; ?business=gym redirects
 * there, lib/gym-redirect). "Updated 10:42" shows once, under the switches.
 */
export function VendorAnalytics() {
  const t = useTranslations("dashboard");
  const { status } = useAuth();
  const signedIn = status === "signed_in";
  // The same keys as the sidebar and the vendor home, so the page asks for nothing new.
  const me = useQuery({ queryKey: ["vendor-me"], enabled: signedIn, queryFn: () => vendor.me() });
  const orgs = useQuery({ queryKey: ["my-orgs"], enabled: signedIn, queryFn: () => sportsConsole.mine() });
  const f = useUrlFilters(ANALYTICS_FILTERS);
  const period = f.values.period as Period;
  const { active, view } = businessView(me.data);
  const options = businessOptions(active, orgs.data?.items ?? []);
  const chosen = pickBusiness(options, f.values, view);
  const venue = chosen?.role === "ground_owner";
  const grounds = useQuery({ queryKey: ["vendor-grounds"], enabled: signedIn && venue, queryFn: () => vendor.mine(), retry: false });
  const groundList = grounds.data?.items ?? [];
  const groundId = venue ? pickGround(f.values.groundId, grounds.data?.items) : "";
  // A venue in the URL waits for the venue list, so the numbers never flash "all venues" first.
  const ready = !venue || !f.values.groundId || !grounds.isPending;
  const d = useBusinessDashboard(chosen ? { role: chosen.role, orgId: chosen.orgId, groundId } : null, period, ready);

  if (status === "signed_out") return <MePanel signInHref="/vendor/sign-in" />;
  if (!signedIn || me.isPending || orgs.isPending) return <Skeleton className="mx-auto mt-10 h-96 max-w-[1200px] rounded-card" />;

  const lead = !chosen
    ? t("leads.none")
    : chosen.role === "ground_owner"
      ? t("analyticsLead")
      : chosen.role === "organiser"
        ? t("leads.organiser", { name: chosen.name ?? "" })
        : t(chosen.role === "shop_owner" ? "leads.shop" : "leads.gym");
  const data = d.data;
  const refreshing = d.isFetching && d.isPlaceholderData;

  return (
    <section className="mx-auto max-w-[1200px] px-5 py-8" data-testid="vendor-analytics">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold">{t("analytics")}</h1>
          <p className="mt-1 max-w-2xl text-muted">{lead}</p>
        </div>
        {chosen ? <PeriodSwitch period={period} onChange={(p) => f.set({ period: p })} /> : null}
      </div>
      {chosen ? (
        <div className="mt-5 flex flex-wrap items-end gap-4">
          {options.length > 1 ? <BusinessSwitch options={options} chosen={chosen} onChange={(b) => (b.role === "gym_owner" ? window.location.assign(GYM_REPORTS_HREF) : f.set({ ...businessQuery(b), groundId: null }))} /> : null}
          {venue && groundList.length > 1 ? (
            <Dropdown
              id="analytics-ground"
              label={t("ground.label")}
              value={groundId}
              anyLabel={t("ground.all")}
              onChange={(v) => f.set({ groundId: v || null })}
              options={groundList.map((g) => ({ value: g.id, label: g.name }))}
              className="w-full max-w-xs"
              testId="ground-select"
            />
          ) : null}
          <AsOf iso={data?.asOf} className="ml-auto pb-1 text-xs text-muted" />
        </div>
      ) : null}
      <div className="mt-6">
        {!chosen ? (
          <EmptyState icon={<ChartLineUp aria-hidden />} title={t("noBusiness")} body={t("noBusinessBody")} action={<ButtonLink href="/vendor">{t("toHome")}</ButtonLink>} />
        ) : d.isError && !data ? (
          <DashboardError error={d.error} onRetry={() => void d.refetch()} />
        ) : !data ? (
          <AnalyticsSkeleton tiles={chosen.role === "organiser" ? 3 : 4} />
        ) : data.role === "ground_owner" ? (
          <VenueAnalytics d={data} groundId={groundId} refreshing={refreshing} />
        ) : data.role === "shop_owner" ? (
          <ShopAnalytics d={data} refreshing={refreshing} />
        ) : data.role === "gym_owner" ? (
          <GymAnalytics d={data} refreshing={refreshing} />
        ) : (
          <OrganiserAnalytics d={data} refreshing={refreshing} />
        )}
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
    <div data-testid="business-switch">
      {segments ? (
        <div className="hidden sm:block">
          <SegmentedControl label={t("business.label")} value={chosen.key} onChange={pick} options={options.map((o) => ({ value: o.key, label: label(o), testId: `business-${o.key}` }))} />
        </div>
      ) : null}
      <Dropdown id="analytics-business" label={t("business.label")} value={chosen.key} onChange={pick} options={options.map((o) => ({ value: o.key, label: label(o) }))} className={segments ? "max-w-sm sm:hidden" : "max-w-sm"} testId="business-dropdown" />
    </div>
  );
}

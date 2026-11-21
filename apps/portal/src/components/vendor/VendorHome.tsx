"use client";

import type { ReactNode } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowRight, Barbell, ChartLineUp, Check, Package, QrCode, ShoppingBag, SoccerBall, Storefront, Ticket, Trophy, Wallet, Warehouse } from "@phosphor-icons/react";
import { useAuth } from "@kriraghor/ui/auth";
import { publicEnv } from "@kriraghor/session/env";
import { Badge, buttonClass, ButtonLink, Card, cn, EmptyState, PageTitle, SectionHeading, Skeleton } from "@kriraghor/ui/kit";
import { checklist, dashboards, mergeActions, type ActionRole, type Period } from "@/lib/dashboard";
import { BUSINESS_ROLES, businessView, type BusinessRole } from "@/lib/panel-nav";
import { gymDesk } from "@/lib/vendor/gym";
import { gymHref } from "@/lib/links";
import { vendor } from "@/lib/vendor/grounds";
import { shopDesk } from "@/lib/vendor/market";
import { sportsConsole } from "@/lib/vendor/tournaments";
import { MePanel } from "../MePanel";
import { HOME_FILTERS, analyticsHref, isSportsOrg, type DashRole } from "@/lib/vendor/analytics";
import { useUrlFilters } from "@/lib/use-url-filters";
import { BusinessTiles, DashboardError, useBusinessDashboard } from "./BusinessDashboards";
import { ActionList, OwnerReliability, VenueSnapshot } from "./OwnerDashboard";
import { PeriodSwitch } from "./chart-parts";
import { SummaryStrip, usePayoutSummary } from "./SummaryStrip";
import { StaffHome } from "./Workplaces";

/**
 * vendor.kriraghor.com home: a home for each business the person runs. It follows the panel switcher
 * (`lastPanelRole`, as the sidebar does): one business, or "all" with a section per business and one
 * combined "Needs your action" list (M19-FR-11). Each business shows a short setup checklist while it
 * is new, always with the payout account; venue owners keep their Overview (M19 §6.2). Someone with
 * no business yet sees the steps to start one and the four kinds of business (applied for on
 * kriraghor.com with the same account). Esports is run by Kriraghor only (21 Oct 2026), so the
 * organiser section is sports events. Since Round B2 shops, gyms and each sports organisation show
 * their tiles too (M19 §6.3), and organisers' to-do items join the list. Since Round B3 the places
 * the person works at as staff follow ("You work at", with their to-do); someone who only works for
 * others gets that alone, without the owner's onboarding.
 *
 * Dashboards round 2 (20 Nov 2026): one period for the whole page (30 days by default, in the URL as
 * ?period=), a summary strip across the businesses (money per kind of business, payouts, to do), and
 * per business a compact card of two or three tiles with the way into its analytics.
 */
const ICON: Record<BusinessRole, typeof SoccerBall> = { ground_owner: SoccerBall, shop_owner: Storefront, gym_owner: Barbell, organiser: Trophy };
/** The `as` kriraghor.com's business page takes (the venue owner is its default). */
const APPLY_AS: Record<BusinessRole, string> = { ground_owner: "", shop_owner: "?as=shop", gym_owner: "?as=gym", organiser: "?as=organiser" };
const ACTIONS_FOR: Record<BusinessRole, ActionRole> = { ground_owner: "ground_owner", shop_owner: "shop_owner", gym_owner: "gym_owner", organiser: "organiser" };

type Me = Awaited<ReturnType<typeof vendor.me>>;
const roleStatus = (me: Me | undefined, role: string) => me?.roles.find((r) => r.role === role)?.status ?? null;

export function VendorHome() {
  const t = useTranslations("vendorHome");
  const { status } = useAuth();
  const signedIn = status === "signed_in";
  const me = useQuery({ queryKey: ["vendor-me"], enabled: signedIn, queryFn: () => vendor.me() });
  const f = useUrlFilters(HOME_FILTERS);
  const period = f.values.period as Period;
  const { active, view, shown } = businessView(me.data);
  const actionRoles = shown.map((r) => ACTIONS_FOR[r]).filter((r): r is ActionRole => Boolean(r));
  const combined = shown.length > 1;
  // One list for several businesses, and the strip's to-do count; the same keys as the sections' own lists.
  const actions = useQueries({
    queries: actionRoles.map((role) => ({ queryKey: ["owner-actions", role], enabled: signedIn, queryFn: () => dashboards.ownerActions(role) })),
  });
  const orgs = useQuery({ queryKey: ["my-orgs"], queryFn: () => sportsConsole.mine(), enabled: signedIn && shown.includes("organiser") });
  const sportsOrgIds = (orgs.data?.items ?? []).filter(isSportsOrg).map((o) => o.id);

  if (status !== "signed_in") return <MePanel signInHref="/vendor/sign-in" />;
  if (me.isPending) return <Skeleton className="mx-auto mt-10 h-48 max-w-3xl rounded-card" />;
  const working = (me.data?.workplaces.length ?? 0) > 0;
  if (!active.length && working) return <StaffOnlyHome />;
  if (!active.length) return <Onboarding me={me.data} />;

  const merged = mergeActions(actionRoles.map((role, i) => ({ role, items: actions[i]?.data?.items ?? [] })));
  const actionsLoading = actions.some((q) => q.isPending);
  const urgent = merged.filter((a) => a.severity === "high").length;
  const notHeld = BUSINESS_ROLES.filter((r) => !active.includes(r));

  return (
    <section className="mx-auto max-w-[1200px] px-5 pb-16 pt-8" data-testid="vendor-home">
      <PageTitle title={view === "all" ? t("title") : t(`sections.${view}`)} description={t("lead")} actions={<PeriodSwitch period={period} onChange={(p) => f.set({ period: p })} />} />
      <SummaryStrip period={period} roles={shown} orgIds={sportsOrgIds} actions={actionsLoading ? null : { lines: merged.length, urgent }} actionsHref={combined ? "#combined-actions" : "#needs-action"} />
      {combined && actionRoles.length ? (
        <div className="mt-8 scroll-mt-24" id="combined-actions" data-testid="combined-actions">
          <SectionHeading title={t("actionsTitle")} />
          <div className="mt-3">{actionsLoading && !merged.length ? <Skeleton className="h-20 rounded-card" /> : <ActionList items={merged} />}</div>
        </div>
      ) : null}
      {shown.map((role) => (
        <BusinessSection key={role} role={role} heading={shown.length > 1 || view === "all"}>
          {role === "ground_owner" ? <VenueHome me={me.data} showActions={!combined} period={period} /> : null}
          {role === "shop_owner" ? <ShopHome showActions={!combined} period={period} /> : null}
          {role === "gym_owner" ? <GymHome showActions={!combined} period={period} /> : null}
          {role === "organiser" ? <OrganiserHome showActions={!combined} period={period} /> : null}
        </BusinessSection>
      ))}
      {working ? <StaffHome own /> : null}
      {view === "all" && notHeld.length ? (
        <div className="mt-12" data-testid="add-business">
          <SectionHeading title={t("addMore")} />
          <p className="mt-1 text-sm text-muted">{t("addMoreLead")}</p>
          <BusinessTypes me={me.data} roles={notHeld} />
        </div>
      ) : null}
    </section>
  );
}

function BusinessSection({ role, heading, children }: { role: BusinessRole; heading: boolean; children: ReactNode }) {
  const t = useTranslations("vendorHome");
  const Icon = ICON[role];
  return (
    <section className="mt-10" data-testid={`business-${role}`} aria-label={t(`sections.${role}`)}>
      {heading ? (
        <h2 className="mb-4 flex items-center gap-3 font-display text-2xl font-bold">
          <span className="grid size-10 place-items-center rounded-control bg-brand-soft text-brand-text">
            <Icon size={22} weight="fill" aria-hidden />
          </span>
          {t(`sections.${role}`)}
        </h2>
      ) : null}
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

// ---------------- setup checklist (always with the payout account)

type Step = { key: string; done: boolean; href: string };

/** M07: where the earnings go. `null` while unknown (loading or failed): the step is left out then. */
function usePayoutStep(): Step | null {
  const q = usePayoutSummary();
  if (!q.data) return null;
  return { key: "payout", done: Boolean(q.data.account), href: "/vendor/payout-account" };
}

function SetupChecklist({ steps, testId }: { steps: Step[]; testId: string }) {
  const t = useTranslations("vendorHome");
  const list = checklist(steps);
  if (list.complete) return null;
  return (
    <Card data-testid={testId}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold">{t("setup.title")}</h3>
        <span className="text-sm font-semibold tabular-nums text-muted">{t("setup.progress", { done: list.doneCount, total: steps.length })}</span>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={list.doneCount} aria-label={t("setup.title")} className="mt-3 h-2 w-full overflow-hidden rounded-pill bg-surface-2">
        <span className="block h-full rounded-pill bg-brand transition-[width] duration-300" style={{ width: `${steps.length ? (list.doneCount / steps.length) * 100 : 0}%` }} />
      </div>
      <ol className="mt-4 flex flex-col gap-2">
        {steps.map((s, i) => {
          const now = i === list.current;
          return (
            <li key={s.key} className={cn("flex flex-wrap items-center gap-3 rounded-control border px-3 py-3", now ? "border-brand/40 bg-brand-soft/40" : "border-line")} data-testid={`setup-${s.key}`} data-done={s.done || undefined}>
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold", s.done ? "bg-brand text-on-brand" : now ? "rounded-card border border-brand text-brand-text" : "border border-line text-muted")}>
                {s.done ? <Check size={16} weight="bold" aria-label={t("setup.done")} /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block font-semibold", s.done && "text-muted line-through decoration-1")}>{t(`setup.step.${s.key}`)}</span>
                {!s.done ? <span className="block text-sm text-muted">{t(`setup.help.${s.key}`)}</span> : null}
              </span>
              {now ? (
                <ButtonLink href={s.href} size="sm" iconEnd={<ArrowRight size={16} aria-hidden />}>
                  {t(`setup.go.${s.key}`)}
                </ButtonLink>
              ) : null}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/** A business's own "Needs your action" (when the home is not showing the combined list). */
function OwnActions({ role }: { role: ActionRole }) {
  const t = useTranslations("dashboard");
  const { status } = useAuth();
  const q = useQuery({ queryKey: ["owner-actions", role], enabled: status === "signed_in", queryFn: () => dashboards.ownerActions(role) });
  return (
    <div data-testid={`actions-${role}`} id="needs-action" className="scroll-mt-24">
      <SectionHeading as="h3" title={t("actions.title")} />
      <div className="mt-2">{q.data ? <ActionList items={q.data.items} /> : q.isError ? <p className="text-sm text-muted">{t("loadFailed")}</p> : <Skeleton className="h-16 rounded-card" />}</div>
    </div>
  );
}

function ActiveCard({ testId, title, body, children }: { testId: string; title: ReactNode; body?: ReactNode; children?: ReactNode }) {
  return (
    <Card data-testid={testId} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        {body ? <p className="mt-1 text-sm text-muted">{body}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </Card>
  );
}

// ---------------- venue owner (M09, M19)

function VenueHome({ me, showActions, period }: { me: Me | undefined; showActions: boolean; period: Period }) {
  const tg = useTranslations("vendorGrounds");
  const { status } = useAuth();
  const web = publicEnv().WEB_URL;
  const mine = useQuery({ queryKey: ["vendor-grounds"], enabled: status === "signed_in", queryFn: () => vendor.mine(), retry: false });
  const payout = usePayoutStep();
  const steps: Step[] = [
    { key: "nid", done: roleStatus(me, "member") === "active", href: `${web}/account/verification` },
    { key: "docs", done: roleStatus(me, "ground_owner") === "active", href: `${web}/account/business` },
    { key: "list", done: (mine.data?.items.length ?? 0) > 0, href: "/vendor/venues" },
    ...(payout ? [payout] : []),
  ];
  return (
    <>
      <ActiveCard testId="owner-active" title={tg("home.active")} body={tg("home.groundsCount", { n: mine.data?.items.length ?? 0 })}>
        <ButtonLink href="/vendor/venues" icon={<SoccerBall size={18} aria-hidden />}>
          {tg("home.open")}
        </ButtonLink>
      </ActiveCard>
      {mine.isSuccess ? <SetupChecklist steps={steps} testId="venue-setup" /> : null}
      {showActions ? <OwnActions role="ground_owner" /> : null}
      <BusinessCard role="ground_owner" period={period} />
      <OwnerReliability />
    </>
  );
}

// ---------------- shop owner (M12, M13)

function ShopHome({ showActions, period }: { showActions: boolean; period: Period }) {
  const tm = useTranslations("vendorMarket");
  const tn = useTranslations("nav");
  const shop = useQuery({ queryKey: ["vendor-shop"], queryFn: () => shopDesk.profile(), retry: false });
  const products = useQuery({ queryKey: ["vendor-products"], queryFn: () => shopDesk.products(), retry: false, enabled: Boolean(shop.data) });
  const payout = usePayoutStep();
  const s = shop.data?.status;
  const steps: Step[] = [
    { key: "shopProfile", done: s === "pending_review" || s === "live" || s === "paused", href: "/vendor/shop" },
    { key: "firstProduct", done: Boolean(products.data?.items.some((p) => p.status === "live")), href: "/vendor/products" },
    ...(payout ? [payout] : []),
  ];
  const links = [
    { href: "/vendor/shop", key: "shop", icon: Storefront },
    { href: "/vendor/products", key: "products", icon: ShoppingBag },
    { href: "/vendor/inventory", key: "inventory", icon: Warehouse },
    { href: "/vendor/orders", key: "orders", icon: Package },
    { href: "/vendor/settlement", key: "settlement", icon: Wallet },
  ] as const;
  return (
    <>
      <ActiveCard testId="shop-owner-active" title={tm("home.active")} body={shop.data ? shop.data.name : undefined}>
        {links.map((l) => (
          <ButtonLink key={l.key} href={l.href} variant="secondary" icon={<l.icon size={18} aria-hidden />}>
            {tn(l.key)}
          </ButtonLink>
        ))}
      </ActiveCard>
      {!shop.isPending && (!shop.data || !products.isPending) ? <SetupChecklist steps={steps} testId="shop-setup" /> : null}
      {showActions ? <OwnActions role="shop_owner" /> : null}
      <BusinessCard role="shop_owner" period={period} />
    </>
  );
}

// ---------------- gym owner (M20): the gyms are managed on gym.kriraghor.com/manage (through /go/gym)

function GymHome({ showActions, period }: { showActions: boolean; period: Period }) {
  const t = useTranslations("vendorHome");
  const tg = useTranslations("vendorGym");
  const gyms = useQuery({ queryKey: ["vendor-gyms"], queryFn: () => gymDesk.mine(), retry: false });
  const payout = usePayoutStep();
  const items = gyms.data?.items ?? [];
  const steps: Step[] = [
    { key: "gymLive", done: items.some((g) => g.status === "live" || g.status === "paused"), href: gymHref("/manage") },
    { key: "packages", done: items.some((g) => g.packages.length > 0), href: items[0] ? gymHref(`/manage/${items[0].id}/edit`) : gymHref("/manage") },
    ...(payout ? [payout] : []),
  ];
  return (
    <>
      <ActiveCard testId="gym-owner-active" title={tg("home.active")}>
        <ButtonLink href={gymHref("/manage")} icon={<Barbell size={18} aria-hidden />}>
          {tg("home.open")}
        </ButtonLink>
      </ActiveCard>
      {gyms.isSuccess ? <SetupChecklist steps={steps} testId="gym-setup" /> : null}
      {showActions ? <OwnActions role="gym_owner" /> : null}
      <BusinessCard role="gym_owner" period={period} />
      <div data-testid="gym-quick">
        <SectionHeading as="h3" title={t("gymQuick")} />
        {gyms.isPending ? (
          <Skeleton className="mt-2 h-20 rounded-card" />
        ) : !items.length ? (
          <EmptyState className="mt-2" icon={<Barbell aria-hidden />} title={tg("empty")} action={<ButtonLink href={gymHref("/manage")}>{tg("add")}</ButtonLink>} />
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {items.slice(0, 6).map((g) => (
              <li key={g.id}>
                <Card padded={false} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{g.name}</span>
                    <Badge tone={g.status === "live" ? "brand" : g.status === "changes_requested" ? "warning" : "neutral"}>{tg(`status.${g.status}`)}</Badge>
                  </span>
                  <ButtonLink href={gymHref(`/manage/${g.id}/desk`)} size="sm" icon={<QrCode size={16} aria-hidden />}>
                    {tg("desk.open")}
                  </ButtonLink>
                  <ButtonLink href={gymHref(`/manage/${g.id}/passes`)} size="sm" variant="secondary" icon={<Ticket size={16} aria-hidden />}>
                    {tg("sold.open")}
                  </ButtonLink>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

// ---------------- sports-event organiser (M14)

function OrganiserHome({ showActions, period }: { showActions: boolean; period: Period }) {
  const t = useTranslations("vendorHome");
  const ts = useTranslations("sportsConsole");
  const { status } = useAuth();
  const web = publicEnv().WEB_URL;
  const orgs = useQuery({ queryKey: ["my-orgs"], queryFn: () => sportsConsole.mine(), enabled: status === "signed_in" });
  const payout = usePayoutStep();
  const sports = (orgs.data?.items ?? []).filter((o) => o.kind === "sports");
  const steps: Step[] = [
    { key: "orgVerified", done: sports.some((o) => o.status === "verified"), href: `${web}/account/business?as=organiser` },
    ...(payout ? [payout] : []),
  ];
  return (
    <>
      <ActiveCard testId="organiser-card" title={t("organiser.active")} body={t("organiser.lead")}>
        <ButtonLink href="/vendor/events" icon={<Trophy size={18} aria-hidden />} data-testid="open-sports-console">
          {t("organiser.open")}
        </ButtonLink>
      </ActiveCard>
      {orgs.isSuccess ? <SetupChecklist steps={steps} testId="organiser-setup" /> : null}
      {showActions ? <OwnActions role="organiser" /> : null}
      {sports.filter(isSportsOrg).map((o) => (
        <BusinessCard key={o.id} role="organiser" orgId={o.id} title={t("organiser.numbers", { name: o.name })} period={period} />
      ))}
      <div data-testid="organiser-orgs">
        <SectionHeading as="h3" title={t("organiser.orgs")} />
        {orgs.isPending ? (
          <Skeleton className="mt-2 h-20 rounded-card" />
        ) : !sports.length ? (
          <EmptyState
            className="mt-2"
            icon={<Trophy aria-hidden />}
            title={ts("applyFirst")}
            body={ts("applyHelp")}
            action={<ButtonLink href={`${web}/account/business?as=organiser`}>{t("organiser.apply")}</ButtonLink>}
          />
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {sports.map((o) => (
              <li key={o.id}>
                <Card padded={false} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 truncate font-semibold">{o.name}</span>
                  <Badge tone={o.status === "verified" ? "brand" : o.status === "suspended" || o.status === "rejected" ? "danger" : o.status === "changes_requested" ? "warning" : "neutral"}>{t(`orgStatus.${o.status}`)}</Badge>
                  {o.status === "verified" ? (
                    <ButtonLink href={`/vendor/events/${o.id}`} size="sm" variant="secondary" iconEnd={<ArrowRight size={16} aria-hidden />}>
                      {t("organiser.openOrg")}
                    </ButtonLink>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

// ---------------- a business's compact card (round 2)

/**
 * Two or three key tiles of one business for the page's period, and the way into its analytics
 * (the gym's reports on gym.kriraghor.com). Organisers get one card per sports organisation, named.
 * The same query as the summary strip, so the home asks once per business.
 */
function BusinessCard({ role, orgId, title, period }: { role: DashRole; orgId?: string; title?: string; period: Period }) {
  const t = useTranslations("dashboard");
  const d = useBusinessDashboard({ role, orgId }, period);
  const data = d.data;
  return (
    <div className="space-y-3" data-testid={`overview-${role}${orgId ? `-${orgId}` : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="min-w-0 font-display text-xl font-bold">{title ?? t("overview")}</h3>
        <ButtonLink
          href={analyticsHref(role, orgId)}
          size="sm"
          variant="secondary"
          icon={<ChartLineUp size={18} aria-hidden />}
          iconEnd={<ArrowRight size={16} aria-hidden />}
          data-testid={role === "ground_owner" ? "open-analytics" : `open-analytics-${role}`}
        >
          {t("openAnalytics")}
        </ButtonLink>
      </div>
      {d.isError && !data ? (
        <DashboardError error={d.error} onRetry={() => void d.refetch()} />
      ) : !data ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-card" />
          ))}
        </div>
      ) : (
        <div className={d.isFetching && d.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {data.role === "ground_owner" ? <VenueSnapshot d={data} /> : <BusinessTiles d={data} compact />}
        </div>
      )}
    </div>
  );
}

// ---------------- staff only (Round B3)

/** Someone who runs no business but works at one or more: their desks and to-do, and how to start their own. */
function StaffOnlyHome() {
  const t = useTranslations("vendorHome");
  const web = publicEnv().WEB_URL;
  return (
    <section className="mx-auto max-w-[1200px] px-5 pb-16 pt-8" data-testid="vendor-home-staff">
      <PageTitle title={t("staffTitle")} description={t("staffLead")} />
      <StaffHome own={false} />
      <p className="mt-10 text-sm text-muted">
        {t("staffOwn")}{" "}
        <a href={`${web}/account/business`} className="font-semibold text-brand-text underline">
          {t("staffOwnLink")}
        </a>
      </p>
    </section>
  );
}

// ---------------- no business yet, and adding another

/** The four kinds of business, each applied for on kriraghor.com with the same account. */
function BusinessTypes({ me, roles }: { me: Me | undefined; roles: BusinessRole[] }) {
  const t = useTranslations("vendorHome");
  const tg = useTranslations("vendorGrounds");
  const web = publicEnv().WEB_URL;
  return (
    <ul className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="business-types">
      {roles.map((role) => {
        const Icon = ICON[role];
        const st = roleStatus(me, role);
        return (
          <li key={role}>
            <Card className="flex h-full flex-col gap-3" data-testid={`business-type-${role}`}>
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-control bg-brand-soft text-brand-text">
                  <Icon size={22} weight="fill" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold">{t(`types.${role}.title`)}</p>
                  <p className="text-sm text-muted">{t(`types.${role}.body`)}</p>
                </div>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-2">
                {st ? <Badge tone={st === "rejected" || st === "suspended" ? "danger" : "info"}>{t("types.status", { status: tg(`roleStatus.${st}`) })}</Badge> : null}
                <ButtonLink href={`${web}/account/business${APPLY_AS[role]}`} size="sm" variant={st ? "primary" : "secondary"} className="ml-auto" iconEnd={<ArrowRight size={16} aria-hidden />}>
                  {st ? t("types.continue") : t("types.start")}
                </ButtonLink>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

/** Someone with no business yet: verify the NID, choose a business and send its papers, then set up here. */
function Onboarding({ me }: { me: Me | undefined }) {
  const t = useTranslations("vendorHome");
  const tg = useTranslations("vendorGrounds");
  const web = publicEnv().WEB_URL;
  const applied = BUSINESS_ROLES.map((r) => roleStatus(me, r)).find((s) => s && s !== "withdrawn") ?? null;
  const steps: Step[] = [
    { key: "nid", done: roleStatus(me, "member") === "active", href: `${web}/account/verification` },
    { key: "business", done: false, href: "#business-types" },
    { key: "setup", done: false, href: "#business-types" },
  ];
  const { current } = checklist(steps);
  return (
    <section className="mx-auto max-w-3xl px-5 pb-16 pt-8" data-testid="vendor-onboarding">
      <PageTitle title={t("title")} description={t("leadNew")} />
      <ol className="mt-6 flex flex-col gap-2" data-testid="owner-steps">
        {steps.map((s, i) => {
          const now = i === current;
          return (
            <li key={s.key} className={cn("flex flex-wrap items-center gap-3 rounded-card border bg-surface px-4 py-3", now ? "border-brand/40" : "border-line")}>
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-full font-bold", s.done ? "bg-brand text-on-brand" : now ? "rounded-card border border-brand text-brand-text" : "border border-line text-muted")}>
                {s.done ? <Check size={18} weight="bold" aria-label={t("setup.done")} /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t(`onboard.step.${s.key}`)}</span>
                <span className="block text-sm text-muted">{t(`onboard.help.${s.key}`, { status: applied ? tg(`roleStatus.${applied}`) : tg("roleStatus.none") })}</span>
              </span>
              {now ? (
                s.href.startsWith("#") ? (
                  <a href={s.href} className={buttonClass({ size: "sm" })}>
                    {t(`onboard.go.${s.key}`)}
                  </a>
                ) : (
                  <ButtonLink href={s.href} size="sm" iconEnd={<ArrowRight size={16} aria-hidden />}>
                    {t(`onboard.go.${s.key}`)}
                  </ButtonLink>
                )
              ) : null}
            </li>
          );
        })}
      </ol>
      <div id="business-types" className="mt-10 scroll-mt-24">
        <SectionHeading title={t("types.title")} />
        <BusinessTypes me={me} roles={BUSINESS_ROLES} />
      </div>
    </section>
  );
}

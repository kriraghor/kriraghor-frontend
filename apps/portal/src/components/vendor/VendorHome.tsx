"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { publicEnv } from "@/lib/env";
import { vendor } from "@/lib/vendor/grounds";
import { MePanel } from "../MePanel";
import { OwnerOverview } from "./OwnerDashboard";

const STEP_TONE: Record<string, string> = { done: "border-brand text-brand", now: "border-ink text-ink", later: "border-line text-muted" };

/**
 * vendor.kriraghor.com home (M09): where a ground owner stands. Verify the NID and send the business
 * documents on kriraghor.com (one account); once the ground_owner role is active, list grounds here,
 * and the home shows the owner's numbers (M19 Overview) and what needs doing. M12: a shop owner sees
 * their shop card (shop, products, inventory), or how far their shop owner application is.
 */
export function VendorHome() {
  const t = useTranslations("vendorGrounds");
  const { status } = useAuth();
  const me = useQuery({ queryKey: ["vendor-me"], enabled: status === "signed_in", queryFn: () => vendor.me() });
  const mine = useQuery({ queryKey: ["vendor-grounds"], enabled: status === "signed_in", queryFn: () => vendor.mine(), retry: false });
  if (status !== "signed_in") return <MePanel signInHref="/vendor/sign-in" />;
  if (me.isPending) return <div className="mx-auto mt-10 h-48 max-w-3xl animate-pulse bg-surface-2" />;
  const roles = me.data?.roles ?? [];
  const member = roles.find((r) => r.role === "member")?.status ?? null;
  const owner = roles.find((r) => r.role === "ground_owner")?.status ?? null;
  const shopOwner = roles.find((r) => r.role === "shop_owner")?.status ?? null;
  const gymOwner = roles.find((r) => r.role === "gym_owner")?.status ?? null;
  const organiserRole = roles.find((r) => r.role === "organiser")?.status ?? null;
  const web = publicEnv().WEB_URL;
  const steps = [
    { key: "nid", done: member === "active", href: `${web}/account/verification` },
    { key: "docs", done: owner === "active", href: `${web}/account/business` },
    { key: "list", done: (mine.data?.items.length ?? 0) > 0, href: "/vendor/venues" },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <section className={`mx-auto px-5 py-10 ${owner === "active" ? "max-w-[1200px]" : "max-w-3xl"}`}>
      <h1 className="text-3xl font-extrabold">{t("home.title")}</h1>
      <p className="mt-2 text-muted">{t("home.lead")}</p>
      {owner === "active" ? (
        <div className="mt-6 border-2 border-brand bg-surface p-5" data-testid="owner-active">
          <p className="font-bold">{t("home.active")}</p>
          <p className="mt-1 text-sm text-muted">{t("home.groundsCount", { n: mine.data?.items.length ?? 0 })}</p>
          <Link href="/vendor/venues" className="mt-4 inline-flex min-h-12 items-center bg-brand px-5 font-bold text-white hover:bg-brand-hover">
            {t("home.open")}
          </Link>
        </div>
      ) : null}
      {owner === "active" ? (
        <OwnerOverview />
      ) : (
        <ol className="mt-6 space-y-3" data-testid="owner-steps">
          {steps.map((s, i) => {
            const tone = s.done ? "done" : i === current ? "now" : "later";
            const external = s.href.startsWith("http");
            return (
              <li key={s.key} className={`flex flex-wrap items-center gap-4 border-2 bg-surface p-4 ${STEP_TONE[tone]}`}>
                <span className="grid h-9 w-9 place-items-center border-2 border-current font-extrabold">{s.done ? "✓" : i + 1}</span>
                <span className="flex-1">
                  <span className="block font-bold text-ink">{t(`home.step.${s.key}`)}</span>
                  <span className="block text-sm text-muted">{t(`home.stepHelp.${s.key}`, { status: owner ? t(`roleStatus.${owner}`) : t("roleStatus.none") })}</span>
                </span>
                {tone === "now" ? (
                  external ? (
                    <a href={s.href} className="inline-flex min-h-11 items-center bg-brand px-4 font-bold text-white">
                      {t(`home.go.${s.key}`)}
                    </a>
                  ) : (
                    <Link href={s.href} className="inline-flex min-h-11 items-center bg-brand px-4 font-bold text-white">
                      {t(`home.go.${s.key}`)}
                    </Link>
                  )
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      <ShopCard status={shopOwner} />
      <GymCard status={gymOwner} />
      <OrganiserCard status={organiserRole} />
    </section>
  );
}

/** M12: the shop owner's way in (or the application on kriraghor.com). */
function ShopCard({ status }: { status: string | null }) {
  const t = useTranslations("vendorMarket");
  const tg = useTranslations("vendorGrounds");
  const web = publicEnv().WEB_URL;
  if (status === "active")
    return (
      <div className="mt-8 border-2 border-brand bg-surface p-5" data-testid="shop-owner-active">
        <p className="font-bold">{t("home.active")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["shop", "products", "inventory"] as const).map((k) => (
            <Link key={k} href={`/vendor/${k}`} className="inline-flex min-h-11 items-center border-2 border-line px-4 font-bold hover:border-brand">
              {t(`nav.${k}`)}
            </Link>
          ))}
        </div>
      </div>
    );
  return (
    <div className="mt-8 border-2 border-line bg-surface p-5" data-testid="shop-owner-card">
      <p className="font-bold">{status ? t("home.applied", { status: tg(`roleStatus.${status}`) }) : t("home.sell")}</p>
      <a href={`${web}/account/business?as=shop`} className="mt-3 inline-flex min-h-11 items-center bg-brand px-4 font-bold text-white">
        {status ? t("home.continue") : t("home.start")}
      </a>
    </div>
  );
}

/** M20: the gym owner's way in (or the application on kriraghor.com). */
function GymCard({ status }: { status: string | null }) {
  const t = useTranslations("vendorGym");
  const tg = useTranslations("vendorGrounds");
  const web = publicEnv().WEB_URL;
  if (status === "active")
    return (
      <div className="mt-8 border-2 border-brand bg-surface p-5" data-testid="gym-owner-active">
        <p className="font-bold">{t("home.active")}</p>
        <Link href="/vendor/gyms" className="mt-3 inline-flex min-h-11 items-center bg-brand px-4 font-bold text-white">
          {t("home.open")}
        </Link>
      </div>
    );
  return (
    <div className="mt-8 border-2 border-line bg-surface p-5" data-testid="gym-owner-card">
      <p className="font-bold">{status ? t("home.applied", { status: tg(`roleStatus.${status}`) }) : t("home.sell")}</p>
      <a href={`${web}/account/business?as=gym`} className="mt-3 inline-flex min-h-11 items-center bg-brand px-4 font-bold text-white">
        {status ? t("home.continue") : t("home.start")}
      </a>
    </div>
  );
}

/** M22: the esports organiser's console (or the application on kriraghor.com). */
function OrganiserCard({ status }: { status: string | null }) {
  const t = useTranslations("organiser");
  const web = publicEnv().WEB_URL;
  return (
    <div className={`mt-8 border-2 bg-surface p-5 ${status === "active" ? "border-brand" : "border-line"}`} data-testid="organiser-card">
      <p className="font-bold">{status === "active" ? t("home.active") : t("home.sell")}</p>
      {status === "active" ? (
        <span className="mt-3 flex flex-wrap gap-2">
          <Link href="/vendor/esports" className="inline-flex min-h-11 items-center bg-brand px-4 font-bold text-white">
            {t("home.open")}
          </Link>
          <Link href="/vendor/events" className="inline-flex min-h-11 items-center border-2 border-line px-4 font-bold hover:border-brand" data-testid="open-sports-console">
            {t("home.openSports")}
          </Link>
        </span>
      ) : (
        <a href={`${web}/account/business?as=organiser`} className="mt-3 inline-flex min-h-11 items-center bg-brand px-4 font-bold text-white">
          {status ? t("home.continue") : t("home.start")}
        </a>
      )}
    </div>
  );
}

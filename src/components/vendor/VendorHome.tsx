"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { publicEnv } from "@/lib/env";
import { vendor } from "@/lib/vendor/grounds";
import { MePanel } from "../MePanel";

const STEP_TONE: Record<string, string> = { done: "border-brand text-brand", now: "border-ink text-ink", later: "border-line text-muted" };

/**
 * vendor.kriraghor.com home (M09): where a ground owner stands. Verify the NID and send the business
 * documents on kriraghor.com (one account); once the ground_owner role is active, list grounds here.
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
  const web = publicEnv().WEB_URL;
  const steps = [
    { key: "nid", done: member === "active", href: `${web}/account/verification` },
    { key: "docs", done: owner === "active", href: `${web}/account/business` },
    { key: "list", done: (mine.data?.items.length ?? 0) > 0, href: "/vendor/grounds" },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <section className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-3xl font-extrabold">{t("home.title")}</h1>
      <p className="mt-2 text-muted">{t("home.lead")}</p>
      {owner === "active" ? (
        <div className="mt-6 border-2 border-brand bg-surface p-5" data-testid="owner-active">
          <p className="font-bold">{t("home.active")}</p>
          <p className="mt-1 text-sm text-muted">{t("home.groundsCount", { n: mine.data?.items.length ?? 0 })}</p>
          <Link href="/vendor/grounds" className="mt-4 inline-flex min-h-12 items-center bg-brand px-5 font-bold text-white hover:bg-brand-hover">
            {t("home.open")}
          </Link>
        </div>
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
    </section>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname, useRouter } from "@kriraghor/ui/i18n/navigation";
import { formatTaka } from "@kriraghor/ui/format";
import { PageHeader } from "@kriraghor/ui/page-header";
import { gym, type GymSort } from "@/lib/gym";
import { webHref } from "@/lib/links";
import { GymCardItem } from "./GymCardItem";

const TABS = ["trainers", "gyms", "gear"] as const;
type Tab = (typeof TABS)[number];

/**
 * /gyms (M20 §4; kriraghor.com/gym until 25 Oct 2026): "Train with verified coaches". Three tabs, kept
 * in the URL:
 * - trainers: M11 fitness trainers with their monthly plans (each opens its hire page on kriraghor.com);
 * - gyms: live gyms with day and monthly prices, women-only hours and facilities;
 * - gear: a link to the gym category of the kriraghor.com shop (cart and checkout stay there, M13).
 * Dark theme with the lime accent (data-theme="gym", set on the whole site).
 */
export function GymHub() {
  const t = useTranslations("gym");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab: Tab = TABS.includes(params.get("tab") as Tab) ? (params.get("tab") as Tab) : "gyms";
  const sort = (["price", "rating", "newest"].includes(params.get("sort") ?? "") ? params.get("sort") : "price") as GymSort;
  const areaId = params.get("areaId") ?? undefined;
  const go = (next: Record<string, string | undefined>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };
  const gyms = useQuery({ queryKey: ["gyms", sort, areaId], queryFn: () => gym.list({ sort, areaId }), enabled: tab === "gyms" });
  const trainers = useQuery({ queryKey: ["gym-trainers"], queryFn: () => gym.trainers(), enabled: tab === "trainers" });
  const areas = useQuery({ queryKey: ["gym-areas"], queryFn: () => gym.areas(), staleTime: 300_000, enabled: tab === "gyms" });
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);

  return (
    <div data-theme="gym" className="min-h-[70dvh]">
      <section className="mx-auto max-w-[1320px] px-5 pb-6 pt-12">
        <PageHeader photo="/images/gym-training.jpg">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">{t("kicker")}</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl" data-testid="gym-title">
            {t.rich("title", { em: (chunks) => <span className="text-brand">{chunks}</span> })}
          </h1>
          <p className="mt-4 max-w-2xl text-muted">{t("lead")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => go({ tab: "trainers" })} className="inline-flex min-h-12 items-center bg-brand px-5 font-bold hover:bg-brand-hover">
              {t("bookTrainer")}
            </button>
            <Link href="/me/passes" className="inline-flex min-h-12 items-center border-2 border-line px-5 font-bold hover:border-brand">
              {t("myPasses")}
            </Link>
          </div>
        </PageHeader>
      </section>

      <nav aria-label={t("sections")} className="mx-auto max-w-[1320px] px-5">
        <div className="flex gap-1 border-b-2 border-line" role="tablist">
          {TABS.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => go({ tab: k })} className={`-mb-0.5 min-h-12 border-b-4 px-5 font-bold ${tab === k ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink"}`} data-testid={`gym-tab-${k}`}>
              {t(`tab.${k}`)}
            </button>
          ))}
        </div>
      </nav>

      <section className="mx-auto max-w-[1320px] px-5 py-8">
        {tab === "gyms" ? (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
                {t("area")}
                <select value={areaId ?? ""} onChange={(e) => go({ areaId: e.target.value || undefined })} className="min-h-11 field px-3 text-ink">
                  <option value="">{t("anyArea")}</option>
                  {(areas.data?.items ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {name(a)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ml-auto flex flex-col gap-1 text-sm font-semibold text-muted">
                {t("sortBy")}
                <select value={sort} onChange={(e) => go({ sort: e.target.value })} className="min-h-11 field px-3 text-ink">
                  {(["price", "rating", "newest"] as const).map((s) => (
                    <option key={s} value={s}>
                      {t(`sort.${s}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {gyms.isPending ? (
              <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="h-80 animate-pulse bg-surface-2" />
                ))}
              </ul>
            ) : gyms.isError ? (
              <p className="mt-6 border-2 border-danger p-6 font-bold">{t("error")}</p>
            ) : !gyms.data.items.length ? (
              <p className="mt-6 border-2 border-dashed border-line p-10 text-center font-bold" data-testid="gym-empty">
                {t("noGyms")}
              </p>
            ) : (
              <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="gym-cards">
                {gyms.data.items.map((g) => (
                  <GymCardItem key={g.id} card={g} />
                ))}
              </ul>
            )}
          </>
        ) : null}

        {tab === "trainers" ? (
          trainers.isPending ? (
            <div className="h-64 animate-pulse bg-surface-2" />
          ) : !trainers.data?.items.length ? (
            <p className="border-2 border-dashed border-line p-10 text-center font-bold">{t("noTrainers")}</p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="gym-trainers">
              {trainers.data.items.map((tr) => {
                return (
                  <li key={tr.id}>
                    <a href={webHref(`/hiring/${tr.slug}`)} className="flex h-full flex-col glass-card p-5 hover:border-brand">
                      <span className="text-xs font-bold uppercase tracking-wide text-brand">{t("verifiedCoach")}</span>
                      <span className="mt-1 text-xl font-extrabold">{tr.name}</span>
                      <span className="mt-1 text-sm text-muted">{tr.headline}</span>
                      <span className="mt-3 text-sm text-muted">
                        {t("years", { n: tr.years })}
                        {tr.area ? ` · ${name(tr.area)}` : ""}
                        {tr.ratingAvg !== null ? ` · ★ ${tr.ratingAvg.toFixed(1)}` : ""}
                      </span>
                      <span className="mt-auto pt-4 text-lg font-extrabold tabular-nums">
                        {tr.planFrom !== null ? t("planFrom", { price: formatTaka(tr.planFrom, locale) }) : tr.rateFrom !== null ? t("sessionFrom", { price: formatTaka(tr.rateFrom, locale) }) : ""}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}

        {tab === "gear" ? (
          <div className="glass-card flex flex-col items-start gap-3 p-6 md:flex-row md:items-center md:justify-between" data-testid="gym-gear">
            <div>
              <h2 className="text-2xl font-extrabold">{t("gearTitle")}</h2>
              <p className="mt-1 max-w-2xl text-muted">{t("gearLead")}</p>
            </div>
            <a href={webHref("/shop?category=gym")} className="inline-flex min-h-12 shrink-0 items-center bg-brand px-5 font-bold hover:bg-brand-hover" data-testid="gym-gear-shop">
              {t("allGear")}
            </a>
          </div>
        ) : null}
      </section>
    </div>
  );
}

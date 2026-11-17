"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { formatTaka } from "@kriraghor/ui/format";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { PageHeader } from "@kriraghor/ui/page-header";
import { gym } from "@/lib/gym";
import { webHref } from "@/lib/links";

/**
 * /trainers (M24 §4.1, moved out of /gyms?tab=trainers in prompt 3): fitness trainers with monthly
 * plans (M20 GET /gym/trainers, best rated first). Each card opens the trainer's hire page on
 * kriraghor.com, where a plan is subscribed to (trainers' own plans belong to Hire, M11).
 */
export function TrainerList() {
  const t = useTranslations("gym");
  const tp = useTranslations("gp.trainers");
  const locale = useLocale();
  const trainers = useQuery({ queryKey: ["gym-trainers"], queryFn: () => gym.trainers() });
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  return (
    <div data-theme="gym" className="min-h-[70dvh]">
      <section className="mx-auto max-w-[1320px] px-5 pb-6 pt-12">
        <PageHeader photo="/images/gym-training.jpg">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">{t("kicker")}</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl" data-testid="trainers-title">
            {tp("title")}
          </h1>
          <p className="mt-4 max-w-2xl text-muted">{tp("lead")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/gyms" className="rounded-control inline-flex min-h-12 items-center border border-line-strong/60 px-5 font-bold no-underline hover:border-brand">
              {tp("findGym")}
            </Link>
            <Link href="/me/subscriptions" className="rounded-control inline-flex min-h-12 items-center border border-line-strong/60 px-5 font-bold no-underline hover:border-brand">
              {tp("mine")}
            </Link>
          </div>
        </PageHeader>
      </section>
      <section className="mx-auto max-w-[1320px] px-5 pb-10">
        {trainers.isPending ? (
          <div className="rounded-card h-64 kg-shimmer bg-surface-2" />
        ) : trainers.isError ? (
          <p className="rounded-card border border-danger p-6 font-bold">{t("error")}</p>
        ) : !trainers.data.items.length ? (
          <p className="rounded-card border border-dashed border-line p-10 text-center font-bold" data-testid="trainers-empty">
            {t("noTrainers")}
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="gym-trainers">
            {trainers.data.items.map((tr) => (
              <li key={tr.id}>
                <a href={webHref(`/hiring/${tr.slug}`)} className="flex h-full flex-col surface-card p-5 hover:border-brand" data-testid="trainer-card">
                  <span className="flex items-center gap-3">
                    {tr.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={tr.avatarUrl} alt="" loading="lazy" className="size-12 shrink-0 rounded-pill object-cover" />
                    ) : null}
                    <span className="min-w-0">
                      <span className="block text-xs font-bold uppercase tracking-wide text-brand">{t("verifiedCoach")}</span>
                      <span className="block text-xl font-extrabold">{tr.name}</span>
                    </span>
                  </span>
                  <span className="mt-2 text-sm text-muted">{tr.headline}</span>
                  <span className="mt-3 text-sm text-muted">
                    {t("years", { n: tr.years })}
                    {tr.area ? ` · ${name(tr.area)}` : ""}
                    {tr.ratingAvg !== null ? ` · ★ ${tr.ratingAvg.toFixed(1)}` : ""}
                  </span>
                  {tr.availableToday ? <span className="mt-1 text-sm font-semibold text-brand">{tp("availableToday")}</span> : null}
                  <span className="mt-auto pt-4 text-lg font-extrabold tabular-nums">
                    {tr.planFrom !== null ? t("planFrom", { price: formatTaka(tr.planFrom, locale) }) : tr.rateFrom !== null ? t("sessionFrom", { price: formatTaka(tr.rateFrom, locale) }) : ""}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

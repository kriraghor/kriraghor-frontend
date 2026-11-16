"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Check, Sparkle } from "@phosphor-icons/react";
import { formatTaka } from "@kriraghor/ui/format";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { FEATURES, gymManage, tiersInOrder, type Pricing as PricingData } from "@/lib/gym-manage";

/**
 * The founding partner offer (M24-FR-88), shown while places are left: the first owners on a paid
 * plan get free months, then a discount for some months. Every number comes from the settings
 * (gym_saas.founding_*), read through GET /gym-manage/pricing.
 */
function FoundingOffer({ pricing }: { pricing: PricingData }) {
  const t = useTranslations("landing.pricing");
  const locale = useLocale();
  const n = (v: number) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-IN").format(v);
  const f = pricing.founding;
  return (
    <div className="mt-5 flex flex-col gap-3 rounded-card border border-brand bg-brand-soft p-5 md:flex-row md:items-center md:justify-between" data-testid="founding-offer">
      <div className="flex items-start gap-3">
        <Sparkle size={28} weight="fill" className="mt-0.5 shrink-0 text-brand-text" aria-hidden />
        <div>
          <p className="text-xl font-extrabold">{t("foundingTitle")}</p>
          <p className="mt-1 max-w-2xl">
            {f.discountPct > 0 && f.discountMonths > 0
              ? t("foundingBody", { free: f.freeMonths, pct: n(f.discountPct), months: f.discountMonths })
              : t("foundingBodyFree", { free: f.freeMonths })}
          </p>
          <p className="mt-1 text-sm font-semibold" data-testid="founding-left">
            {t("foundingLeft", { left: pricing.foundingPlacesLeft, leftText: n(pricing.foundingPlacesLeft), limit: n(f.limit) })}
          </p>
        </div>
      </div>
      <Link href="/start" className="inline-flex min-h-12 shrink-0 items-center bg-brand px-5 font-bold text-on-brand no-underline hover:bg-brand-hover">
        {t("foundingCta")}
      </Link>
    </div>
  );
}

/**
 * The landing page's prices (M24 §4.1): the four tiers from GET /gym-manage/pricing (prices, member
 * limits and features come from the platform settings; nothing is written into the page). While the
 * pricing can't be read, the page shows the start card without prices. The founding partner offer
 * shows while places are left (prompt 3).
 */
export function Pricing() {
  const t = useTranslations("landing.pricing");
  const tg = useTranslations("gm");
  const locale = useLocale();
  const pricing = useQuery({ queryKey: ["gym-pricing"], queryFn: () => gymManage.pricing(), staleTime: 10 * 60_000 });
  const n = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-IN");
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-10" aria-labelledby="pricing-title" data-testid="pricing">
      <h2 id="pricing-title" className="text-3xl font-extrabold md:text-4xl">
        {t("title")}
      </h2>
      {pricing.isPending ? (
        <div className="mt-6 h-32 kg-shimmer rounded-card bg-surface-2" />
      ) : pricing.data?.tiers.length ? (
        <>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="tiers">
            {tiersInOrder(pricing.data.tiers).map((tier) => (
              <li key={tier.key} className="glass-card flex flex-col gap-2 p-5" data-testid={`tier-${tier.key}`}>
                <span className="text-sm font-bold uppercase tracking-wide text-muted">{tg(`tier.${tier.key}`)}</span>
                <span className="text-3xl font-extrabold tabular-nums">{tier.pricePoisha ? t("perMonth", { price: formatTaka(tier.pricePoisha, locale) }) : t("free")}</span>
                <span className="text-sm">{tier.maxMembers ? t("upTo", { n: n.format(tier.maxMembers) }) : t("unlimited")}</span>
                {tier.minGyms ? <span className="text-xs text-muted">{tg("billing.minGyms", { n: tier.minGyms })}</span> : null}
                <ul className="mt-1 flex flex-col gap-1 text-sm">
                  <li className="flex items-start gap-1.5">
                    <Check size={16} className="mt-0.5 shrink-0 text-brand-text" aria-hidden /> {tg("billing.base")}
                  </li>
                  {FEATURES.filter((f) => tier.features.includes(f)).map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <Check size={16} className="mt-0.5 shrink-0 text-brand-text" aria-hidden /> {tg(`feature.${f}`)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {pricing.data.foundingPlacesLeft > 0 ? <FoundingOffer pricing={pricing.data} /> : null}
          <p className="mt-3 text-sm text-muted">{t("activeNote", { days: pricing.data.activeWindowDays })}</p>
          <Link href="/start" className="mt-4 inline-flex min-h-12 items-center bg-brand px-5 font-bold text-on-brand no-underline hover:bg-brand-hover" data-testid="pricing-start">
            {t("cta")}
          </Link>
        </>
      ) : (
        <div className="glass-card mt-6 flex flex-col items-start gap-3 p-6 md:flex-row md:items-center md:justify-between" data-testid="early-access">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-brand-soft text-brand-text">
              <Sparkle size={24} weight="fill" aria-hidden />
            </span>
            <div>
              <p className="text-2xl font-extrabold">{t("unavailable")}</p>
              <p className="mt-1 max-w-2xl text-muted">{t("unavailableBody")}</p>
            </div>
          </div>
          <Link href="/start" className="inline-flex min-h-12 shrink-0 items-center bg-brand px-5 font-bold text-on-brand no-underline hover:bg-brand-hover">
            {t("cta")}
          </Link>
        </div>
      )}
    </section>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Sparkle } from "@phosphor-icons/react";
import { formatTaka } from "@kriraghor/ui/format";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { fetchPublicSettings, tierName, tierPrices } from "@/lib/start";

/**
 * The landing page's prices: the gym system's tiers from the public settings (M24 prompt 2 adds the
 * gym.tier_* keys). Until they exist, or while the settings can't be read, it says the system is
 * free during early access. A price is never written into the page.
 */
export function Pricing() {
  const t = useTranslations("landing.pricing");
  const locale = useLocale();
  const settings = useQuery({ queryKey: ["public-settings", "api"], queryFn: fetchPublicSettings, staleTime: 5 * 60_000 });
  const tiers = tierPrices(settings.data);
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-10" aria-labelledby="pricing-title" data-testid="pricing">
      <h2 id="pricing-title" className="text-3xl font-extrabold md:text-4xl">
        {t("title")}
      </h2>
      {settings.isPending ? (
        <div className="mt-6 h-32 animate-pulse rounded-card bg-surface-2" />
      ) : tiers ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="tiers">
          {tiers.map((tier) => (
            <li key={tier.key} className="glass-card flex flex-col gap-2 p-5">
              <span className="text-sm font-bold uppercase tracking-wide text-muted">{t.has(`tiers.${tier.key}`) ? t(`tiers.${tier.key}`) : tierName(tier.key)}</span>
              <span className="text-3xl font-extrabold tabular-nums">{tier.poisha ? t("perMonth", { price: formatTaka(tier.poisha, locale) }) : t("free")}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="glass-card mt-6 flex flex-col items-start gap-3 p-6 md:flex-row md:items-center md:justify-between" data-testid="early-access">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-brand-soft text-brand-text">
              <Sparkle size={24} weight="fill" aria-hidden />
            </span>
            <div>
              <p className="text-2xl font-extrabold">{t("earlyAccess")}</p>
              <p className="mt-1 max-w-2xl text-muted">{t("earlyAccessBody")}</p>
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

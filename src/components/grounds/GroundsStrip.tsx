"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { grounds } from "@/lib/grounds";
import { formatTaka } from "@/lib/payments";

/** Home grounds section (M09): three live grounds, cheapest first, and the way to the full list. */
export function GroundsStrip() {
  const t = useTranslations("grounds");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["home-grounds"], queryFn: () => grounds.list({ sort: "cheapest" }) });
  const items = (q.data?.items ?? []).slice(0, 3);
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-12" aria-labelledby="home-grounds-title" data-testid="grounds-strip">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">{t("homeKicker")}</p>
          <h2 id="home-grounds-title" className="mt-2 text-3xl font-extrabold">
            {t("homeTitle")}
          </h2>
        </div>
        <Link href="/grounds" className="inline-flex min-h-12 items-center bg-brand px-5 font-bold text-white hover:bg-brand-hover">
          {t("homeAll")}
        </Link>
      </div>
      <ul className="mt-6 grid gap-4 md:grid-cols-3">
        {q.isPending
          ? [0, 1, 2].map((i) => <li key={i} className="h-56 animate-pulse bg-surface-2" />)
          : items.map((g) => (
              <li key={g.id}>
                <Link href={`/grounds/${g.slug}`} className="flex h-full flex-col border-2 border-line bg-surface hover:border-brand">
                  {g.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.coverUrl} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
                  ) : null}
                  <span className="flex flex-1 flex-col p-4">
                    <span className="text-lg font-extrabold">{g.name}</span>
                    <span className="text-sm text-muted">
                      {g.area ? name(g.area) : ""} · {g.sports.map(name).join(", ")}
                    </span>
                    <span className="mt-auto pt-3 font-extrabold tabular-nums">{t("from", { price: formatTaka(g.priceFromPoisha, locale) })}</span>
                  </span>
                </Link>
              </li>
            ))}
        {!q.isPending && !items.length ? <li className="border-2 border-dashed border-line p-6 text-muted md:col-span-3">{t("homeNone")}</li> : null}
      </ul>
    </section>
  );
}

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { grounds, hourLabel, hoursLines } from "@/lib/grounds";
import { formatTaka } from "@/lib/payments";
import { BookingWidget } from "./BookingWidget";
import { GroundReviews } from "../trust/GroundReviews";

const TONE: Record<string, string> = { low: "bg-brand/10", base: "bg-surface-2", high: "bg-amber-100 dark:bg-amber-900/40", peak: "bg-amber-300 dark:bg-amber-700/70" };

/**
 * /grounds/[slug] (M09 §4.8, FR-27): gallery, facts, courts and hours, facilities, rules, the price
 * table for the week and the v3 payment line. The aside books a slot (M10 BookingWidget).
 */
export function GroundDetail({ slug }: { slug: string }) {
  const t = useTranslations("grounds");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["ground", slug], queryFn: () => grounds.detail(slug), retry: false });
  const [photo, setPhoto] = useState(0);
  if (q.isPending) return <div className="mx-auto mt-10 h-96 max-w-[1320px] animate-pulse bg-surface-2" />;
  if (q.isError || !q.data)
    return (
      <section className="mx-auto max-w-[1320px] px-5 py-16">
        <h1 className="text-2xl font-extrabold">{t("notFound")}</h1>
        <Link href="/grounds" className="mt-3 inline-block font-semibold text-brand underline">
          {t("back")}
        </Link>
      </section>
    );
  const g = q.data;
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const money = (n: number) => formatTaka(n, locale);
  const days = (t.raw("days") as string[]) ?? [];
  const p = g.pricing;

  return (
    <section className="mx-auto max-w-[1320px] px-5 py-8">
      <Link href="/grounds" className="text-sm font-semibold text-brand underline">
        ← {t("title")}
      </Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <h1 className="text-4xl font-extrabold" data-testid="ground-name">
            {g.name}
          </h1>
          <p className="mt-1 text-muted">
            {g.addressLine}
            {g.area ? `, ${name(g.area)}` : ""}
          </p>
          {g.photos.length ? (
            <div className="mt-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.photos[photo]?.url} alt={t("photoOf", { name: g.name, n: photo + 1 })} className="aspect-[16/9] w-full object-cover" data-testid="ground-photo" />
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {g.photos.map((ph, i) => (
                  <button key={ph.id} type="button" onClick={() => setPhoto(i)} aria-label={t("photoOf", { name: g.name, n: i + 1 })} aria-pressed={i === photo} className={`shrink-0 border-2 ${i === photo ? "border-brand" : "border-transparent"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ph.url} alt="" className="h-16 w-24 object-cover" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <dl className="mt-6 grid grid-cols-2 gap-4 border-y-2 border-line py-4 text-sm sm:grid-cols-4">
            <Fact label={t("fact.sports")} value={[...new Set(g.courts.flatMap((c) => c.sports.map(name)))].join(", ")} />
            <Fact label={t("fact.courts")} value={String(g.courts.length)} />
            <Fact label={t("fact.place")} value={g.isIndoor ? t("indoorShort") : t("outdoorShort")} />
            <Fact label={t("fact.minimum")} value={t("minutes", { n: p.minBookingMin })} />
          </dl>

          {g.description ? <p className="mt-6 max-w-3xl whitespace-pre-line">{g.description}</p> : null}

          <h2 className="mt-8 text-2xl font-extrabold">{t("courtsTitle")}</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2" data-testid="ground-courts">
            {g.courts.map((c) => (
              <li key={c.id} className="border-2 border-line bg-surface p-4">
                <p className="font-bold">{c.name}</p>
                <p className="text-sm text-muted">
                  {c.sports.map(name).join(", ")}
                  {c.surface ? ` · ${name(c.surface)}` : ""}
                  {c.sizeText ? ` · ${c.sizeText}` : ""}
                  {c.capacityText ? ` · ${c.capacityText}` : ""}
                </p>
                <ul className="mt-2 text-sm">
                  {hoursLines(c.hours, days, t("closed")).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          {g.facilities.length ? (
            <>
              <h2 className="mt-8 text-2xl font-extrabold">{t("facilities")}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {g.facilities.map((f) => (
                  <li key={f.key} className="border-2 border-line px-3 py-1 text-sm font-semibold">
                    {name(f)}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <h2 className="mt-8 text-2xl font-extrabold">{t("rulesTitle")}</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {g.bookingCutoffMin ? <li>{t("cutoff", { n: g.bookingCutoffMin })}</li> : null}
            <li>{t("minimum", { n: p.minBookingMin })}</li>
            {g.rulesText ? <li className="whitespace-pre-line">{g.rulesText}</li> : null}
          </ul>

          <h2 className="mt-8 text-2xl font-extrabold">{t("priceTitle")}</h2>
          <p className="mt-1 text-sm text-muted">
            {t("priceLead", { peak: p.peakPct, from: hourLabel(p.peakFromHour), weekend: p.weekendPct, early: p.earlyPct, to: hourLabel(p.earlyToHour) })}
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-0.5 text-center text-xs tabular-nums" data-testid="price-table">
              <thead>
                <tr>
                  <th />
                  {p.week[0]?.cells.map((c) => (
                    <th key={c.hour} scope="col" className="font-semibold text-muted">
                      {hourLabel(c.hour)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.week.map((r) => (
                  <tr key={r.date}>
                    <th scope="row" className="pr-2 text-left font-semibold">
                      {new Date(`${r.date}T00:00:00+06:00`).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "short", day: "numeric", timeZone: "Asia/Dhaka" })}
                    </th>
                    {r.cells.map((c) => (
                      <td key={c.hour} className={`h-8 ${TONE[c.tone]}`} title={money(c.rate)}>
                        {Math.round(c.rate / 100).toLocaleString(locale === "bn" ? "bn-BD" : "en-IN")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <GroundReviews groundId={g.id} />
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start" data-testid="booking-aside">
          <div className="border-2 border-line-strong bg-surface p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{t("priceRange")}</p>
            <p className="text-3xl font-extrabold tabular-nums">
              {money(p.fromPoisha)}–{money(p.toPoisha)}
            </p>
            <p className="text-sm text-muted">{t("perHour")}</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>{t("payAdvance", { pct: p.advancePct })}</li>
              {g.payment.allowFullPayment ? <li>{t("payFull")}</li> : null}
              <li className="text-muted">{g.payment.advanceRefundable ? t("refundWindows", { full: g.payment.fullRefundHours ?? 0, half: g.payment.halfRefundHours ?? 0 }) : t("noRefund")}</li>
            </ul>
            <div className="mt-4 border-t-2 border-line pt-4">
              {g.bookingOpen ? (
                <>
                  <p className="mb-3 font-bold">{t("bookNow")}</p>
                  <BookingWidget groundId={g.id} slug={slug} />
                </>
              ) : (
                <>
                  <p className="font-bold">{t("bookingSoon")}</p>
                  <p className="text-sm text-muted">{t("bookingSoonHelp")}</p>
                </>
              )}
            </div>
            {g.owner.displayName ? <p className="mt-4 text-sm text-muted">{t("owner", { name: g.owner.displayName })}</p> : null}
            {g.owner.reliability !== null && g.owner.reliability !== undefined ? (
              <p className="mt-1 text-sm font-semibold" data-testid="owner-reliability" title={t("reliabilityHelp")}>
                {t("reliability", { score: g.owner.reliability })}
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-bold">{value || "–"}</dd>
    </div>
  );
}

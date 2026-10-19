"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { gym, weekOf } from "@/lib/gym";
import { formatTaka } from "@/lib/payments";
import { PassBuy } from "./PassBuy";

/**
 * /gym/gyms/[slug] (M20 §4): gallery, address, facilities, the week's hours (Saturday first, women-only
 * windows marked) and the live packages. The aside buys a day, month or quarter pass (PassBuy).
 */
export function GymDetail({ slug }: { slug: string }) {
  const t = useTranslations("gym");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["gym", slug], queryFn: () => gym.page(slug), retry: false });
  const [photo, setPhoto] = useState(0);
  if (q.isPending) return <div data-theme="gym" className="min-h-[70dvh]"><div className="mx-auto h-96 max-w-[1320px] animate-pulse bg-surface-2" /></div>;
  if (q.isError || !q.data)
    return (
      <div data-theme="gym" className="min-h-[70dvh]">
        <section className="mx-auto max-w-[1320px] px-5 py-16">
          <h1 className="text-2xl font-extrabold">{t("notFound")}</h1>
          <Link href="/gym?tab=gyms" className="mt-3 inline-block font-semibold text-brand underline">
            {t("back")}
          </Link>
        </section>
      </div>
    );
  const g = q.data;
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const days = (t.raw("days") as string[]) ?? [];
  const today = new Date(`${g.today}T00:00:00Z`).getUTCDay();

  return (
    <div data-theme="gym" className="min-h-[70dvh]">
      <section className="mx-auto max-w-[1320px] px-5 py-8">
        <Link href="/gym?tab=gyms" className="text-sm font-semibold text-brand underline">
          ← {t("tab.gyms")}
        </Link>
        <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide">
              <span className={g.openNow ? "text-brand" : "text-muted"}>{g.openNow ? t("openNow") : t("closedNow")}</span>
              {g.ratingAvg !== null ? <span className="text-muted"> · ★ {g.ratingAvg.toFixed(1)} ({g.ratingCount})</span> : null}
            </p>
            <h1 className="mt-1 text-4xl font-extrabold md:text-5xl" data-testid="gym-name">
              {g.name}
            </h1>
            <p className="mt-1 text-muted">
              {g.addressLine}
              {g.area ? `, ${name(g.area)}` : ""}
            </p>

            {g.photos.length ? (
              <div className="mt-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.photos[photo]?.url} alt={t("photoOf", { name: g.name, n: photo + 1 })} className="aspect-[16/9] w-full object-cover" data-testid="gym-photo" />
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

            {g.about ? <p className="mt-6 max-w-3xl whitespace-pre-line">{g.about}</p> : null}

            {g.facilities.length ? (
              <>
                <h2 className="mt-8 text-2xl font-extrabold">{t("facilities")}</h2>
                <ul className="mt-3 flex flex-wrap gap-2" data-testid="gym-facilities">
                  {g.facilities.map((f) => (
                    <li key={f.id} className="border-2 border-line px-3 py-1 text-sm font-semibold">
                      {name(f)}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <h2 className="mt-8 text-2xl font-extrabold">{t("hours")}</h2>
            <table className="mt-3 w-full max-w-xl text-sm" data-testid="gym-hours">
              <tbody>
                {weekOf(g.hours).map((d) => (
                  <tr key={d.dow} className={`border-b border-line ${d.dow === today ? "font-bold" : ""}`}>
                    <th scope="row" className="py-2 pr-4 text-left font-semibold">
                      {days[d.dow]}
                    </th>
                    <td className="py-2">
                      {d.windows.length ? (
                        <span className="flex flex-wrap gap-x-4 gap-y-1">
                          {d.windows.map((w) => (
                            <span key={w.openTime} className="tabular-nums">
                              {w.openTime}–{w.closeTime}
                              {w.womenOnly ? <span className="ml-1 text-xs font-bold uppercase text-brand">{t("womenOnly")}</span> : null}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-muted">{t("closed")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 className="mt-8 text-2xl font-extrabold">{t("packages")}</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-3" data-testid="gym-packages">
              {g.packages.map((p) => (
                <li key={p.id} className="glass-card p-4">
                  <span className="block text-xs font-bold uppercase tracking-wide text-muted">{t(`kind.${p.kind}`)}</span>
                  <span className="mt-1 block font-bold">{p.title}</span>
                  <span className="mt-2 block text-2xl font-extrabold tabular-nums">{formatTaka(p.price, locale)}</span>
                  <span className="text-sm text-muted">{p.kind === "day" ? t("oneVisit") : t("forDays", { n: p.days })}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 max-w-3xl text-sm text-muted">{t("refundRule")}</p>
          </div>

          <aside className="h-fit glass-card p-5 lg:sticky lg:top-24">
            <PassBuy page={g} />
          </aside>
        </div>
      </section>
    </div>
  );
}

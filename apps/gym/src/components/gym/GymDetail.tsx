"use client";

import { useState } from "react";
import { GymExtras } from "./GymExtras";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { formatDateLabel, localDigits } from "@kriraghor/ui/date";
import { MapPin, WhatsappLogo } from "@phosphor-icons/react";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { ShareButton } from "@kriraghor/ui/share";
import { publicEnv } from "@kriraghor/session/env";
import { gym, weekOf } from "@/lib/gym";
import { formatTaka } from "@kriraghor/ui/format";
import { RatingLine, SubjectReviews } from "@kriraghor/ui/trust";
import { PassBuy } from "./PassBuy";
import { JoinCta } from "./Join";
import { VisitCta } from "./Visit";
import { BackLink, buttonClass } from "@kriraghor/ui/kit";
import { chatHref, gymMessage, gymPageUrl, packageMessage, type WaSay } from "@/lib/whatsapp";

/**
 * /gyms/[slug] (M20 §4; on gym.kriraghor.com since 25 Oct 2026): gallery, address, facilities, the week's hours (Saturday first, women-only
 * windows marked), a map pin and the live packages. The aside buys a subscription (PassBuy), asks to join
 * while the gym takes join requests (JoinCta, M24-FR-16) and books a free trial visit while the gym takes
 * them (VisitCta, M24-FR-110, 9 Nov 2026). With a chat number (M24-FR-158, 21 Nov 2026), a WhatsApp button
 * beside Share and "Ask on WhatsApp" on each subscription and class, the message prefilled.
 */
export function GymDetail({ slug }: { slug: string }) {
  const t = useTranslations("gym");
  const tp = useTranslations("gp.join");
  const tw = useTranslations("gym.wa");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["gym", slug], queryFn: () => gym.page(slug), retry: false });
  const [photo, setPhoto] = useState(0);
  if (q.isPending) return <div data-theme="gym" className="min-h-[70dvh]"><div className="rounded-card mx-auto h-96 max-w-[1320px] kg-shimmer bg-surface-2" /></div>;
  if (q.isError || !q.data)
    return (
      <div data-theme="gym" className="min-h-[70dvh]">
        <section className="mx-auto max-w-[1320px] px-5 py-16">
          <h1 className="text-2xl font-extrabold">{t("notFound")}</h1>
          <Link href="/gyms" className="mt-3 inline-block font-semibold text-brand underline">
            {t("back")}
          </Link>
        </section>
      </div>
    );
  const g = q.data;
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const days = (t.raw("days") as string[]) ?? [];
  const today = new Date(`${g.today}T00:00:00Z`).getUTCDay();
  const pageUrl = gymPageUrl(publicEnv().GYM_URL, slug);
  const say: WaSay = (key, values) => tw(`msg.${key}`, values);
  const waPage = chatHref(g.whatsapp, gymMessage(say, { gym: g.name, url: pageUrl }));

  return (
    <div data-theme="gym" className="min-h-[70dvh]">
      <section className="mx-auto max-w-[1320px] px-5 py-8">
        <BackLink href="/gyms">{t("tab.gyms")}</BackLink>
        <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide">
              <span className={g.openNow ? "text-brand" : "text-muted"} data-testid="gym-open-state">
                {g.specialToday?.kind === "closed" ? t("closedToday", { title: g.specialToday.title }) : g.openNow ? t("openNow") : t("closedNow")}
              </span>
              <span className="text-muted"> · </span>
              <RatingLine avg={g.ratingAvg} count={g.ratingCount} className="text-muted" />
            </p>
            <h1 className="mt-1 text-4xl font-extrabold md:text-5xl" data-testid="gym-name">
              {g.name}
            </h1>
            <p className="mt-1 text-muted">
              {g.addressLine}
              {g.area ? `, ${name(g.area)}` : ""}
            </p>
            {g.lat !== null && g.lng !== null ? (
              <a href={`https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lng}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-brand underline" data-testid="gym-map">
                <MapPin size={16} aria-hidden /> {tp("map")}
              </a>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <ShareButton url={pageUrl} title={g.area ? `${g.name}, ${name(g.area)}` : g.name} testId="gym-share" />
              {waPage ? (
                <a href={waPage} target="_blank" rel="noopener noreferrer" aria-label={tw("buttonLabel", { gym: g.name })} className={buttonClass({ variant: "secondary" })} data-testid="gym-whatsapp">
                  <WhatsappLogo size={18} weight="fill" className="text-[#1f7a4d]" aria-hidden />
                  {tw("button")}
                </a>
              ) : null}
            </div>

            {g.photos.length ? (
              <div className="mt-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.photos[photo]?.url} alt={t("photoOf", { name: g.name, n: photo + 1 })} className="aspect-[16/9] w-full object-cover" data-testid="gym-photo" />
                <div className="mt-2 flex gap-2 overflow-x-auto">
                  {g.photos.map((ph, i) => (
                    <button key={ph.id} type="button" onClick={() => setPhoto(i)} aria-label={t("photoOf", { name: g.name, n: i + 1 })} aria-pressed={i === photo} className={`rounded-card shrink-0 border ${i === photo ? "border-brand" : "border-transparent"}`}>
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
                    <li key={f.id} className="rounded-card border border-line px-3 py-1 text-sm font-semibold">
                      {name(f)}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <h2 className="mt-8 text-2xl font-extrabold">{t("hours")}</h2>
            {/* Tester feedback, 28 Nov 2026: one column for everyone's hours, one headed "Women only". */}
            <HoursTable hours={g.hours} today={today} days={days} />
            {g.specialDays.length ? (
              <div className="mt-4 max-w-xl" data-testid="gym-special-days">
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted">{t("specialDays")}</h3>
                <ul className="mt-1 flex flex-col divide-y divide-line text-sm">
                  {g.specialDays.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
                      <span>
                        <span className="font-semibold">{d.fromOn === d.toOn ? formatDateLabel(d.fromOn, locale) : `${formatDateLabel(d.fromOn, locale)} – ${formatDateLabel(d.toOn, locale)}`}</span>
                        <span className="text-muted"> · {d.title}</span>
                      </span>
                      <span className={d.kind === "closed" ? "font-bold text-danger" : "tabular-nums"}>
                        {d.kind === "closed" ? t("closed") : d.windows.map((w) => localDigits(`${w.openTime}–${w.closeTime}`, locale)).join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <h2 className="mt-8 text-2xl font-extrabold">{t("packages")}</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-3" data-testid="gym-packages">
              {g.packages.map((p) => {
                const ask = chatHref(g.whatsapp, packageMessage(say, locale, { gym: g.name, title: p.title, pricePoisha: p.price, days: p.days, url: pageUrl }));
                return (
                  <li key={p.id} className="surface-card flex flex-col p-4">
                    <span className="block text-xs font-bold uppercase tracking-wide text-muted">{t(`kind.${p.kind}`)}</span>
                    <span className="mt-1 block font-bold">{p.title}</span>
                    <span className="mt-2 block text-2xl font-extrabold tabular-nums">{formatTaka(p.price, locale)}</span>
                    <span className="text-sm text-muted">{t("forDays", { n: p.days })}</span>
                    {ask ? (
                      <a href={ask} target="_blank" rel="noopener noreferrer" aria-label={tw("askPackage", { gym: g.name, package: p.title })} className="mt-auto inline-flex min-h-11 items-center gap-1.5 pt-2 text-sm font-semibold text-brand-text underline-offset-4 hover:underline" data-testid="package-whatsapp">
                        <WhatsappLogo size={18} aria-hidden />
                        {tw("ask")}
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 max-w-3xl text-sm text-muted">{t("refundRule")}</p>

            {/* M27-FR-66: "Ask the gym". */}
            <GymExtras slug={slug} gymName={g.name} whatsapp={g.whatsapp} />

            {/* M20-FR-10, M17-FR-35: one review per member who visited, with the gym's replies. */}
            <SubjectReviews subjectType="gym" subjectId={g.id} testId="gym-reviews" />
          </div>

          <aside className="h-fit surface-card p-5 lg:sticky lg:top-24">
            <PassBuy page={g} />
            <JoinCta page={g} />
            <VisitCta slug={slug} />
          </aside>
        </div>
      </section>
    </div>
  );
}

/** The week's hours as a table: Day, Open hours and, when the gym has any, a Women only column. */
function HoursTable({ hours, today, days }: { hours: Parameters<typeof weekOf>[0]; today: number; days: string[] }) {
  const t = useTranslations("gym");
  const locale = useLocale();
  const week = weekOf(hours);
  const hasWomen = week.some((d) => d.windows.some((w) => w.womenOnly));
  const span = (ws: { openTime: string; closeTime: string }[]) =>
    ws.length ? (
      <span className="flex flex-col gap-0.5">
        {ws.map((w) => (
          <span key={w.openTime} className="whitespace-nowrap tabular-nums">
            {localDigits(`${w.openTime}–${w.closeTime}`, locale)}
          </span>
        ))}
      </span>
    ) : (
      <span className="text-muted" aria-label={t("hoursNone")}>
        –
      </span>
    );
  return (
    <div className="mt-3 max-w-xl overflow-hidden rounded-card border border-line">
      <table className="w-full text-sm" data-testid="gym-hours">
        <thead className="bg-surface-2 text-left text-xs font-bold uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className="px-4 py-2.5">
              {t("hoursDay")}
            </th>
            <th scope="col" className="px-4 py-2.5">
              {t("hoursOpen")}
            </th>
            {hasWomen ? (
              <th scope="col" className="px-4 py-2.5 text-brand-text" data-testid="gym-hours-women">
                {t("hoursWomen")}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {week.map((d) => {
            const isToday = d.dow === today;
            return (
              <tr key={d.dow} className={`border-t border-line ${isToday ? "bg-brand-soft/60 font-bold" : ""}`} aria-current={isToday ? "date" : undefined}>
                <th scope="row" className="px-4 py-2.5 text-left font-semibold">
                  {days[d.dow]}
                  {isToday ? <span className="ml-2 rounded-pill bg-brand px-2 py-0.5 text-[11px] font-bold text-on-brand">{t("today")}</span> : null}
                </th>
                {d.windows.length ? (
                  <>
                    <td className="px-4 py-2.5">{span(d.windows.filter((w) => !w.womenOnly))}</td>
                    {hasWomen ? <td className="px-4 py-2.5">{span(d.windows.filter((w) => w.womenOnly))}</td> : null}
                  </>
                ) : (
                  <td colSpan={hasWomen ? 2 : 1} className="px-4 py-2.5 text-muted">
                    {t("closed")}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

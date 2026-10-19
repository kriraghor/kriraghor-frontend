"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { problemOf } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { busyByDay, hire, nextDays, type ProfilePage } from "@/lib/hire";
import { formatTaka } from "@/lib/payments";
import { TrainerPlans } from "../gym/TrainerPlans";
import { RequestForm } from "./RequestForm";

/**
 * /hiring/[slug] (M11 FR-05, FR-06): who they are, the verified credential level, the rate card
 * (base per hour or per match format, night and short-notice surcharges, travel by zone), a 14-day
 * strip of busy times, the shortlist and the request form with a live server quote.
 */
export function HireProfileView({ slug }: { slug: string }) {
  const t = useTranslations("hire");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["hire-profile", slug], queryFn: () => hire.page(slug), retry: false });
  if (q.isPending) return <div className="mx-auto mt-10 h-96 max-w-[1320px] animate-pulse bg-surface-2" />;
  if (q.isError || !q.data)
    return (
      <section className="mx-auto max-w-[1320px] px-5 py-16">
        <h1 className="text-2xl font-extrabold">{t("notFound")}</h1>
        <Link href="/hiring" className="mt-3 inline-block font-semibold text-brand underline">
          {t("back")}
        </Link>
      </section>
    );
  const p = q.data;
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const credential = p.credential ? (locale === "bn" ? p.credential.labelBn : p.credential.labelEn) ?? t(`level.${p.credential.level}`) : null;

  return (
    <section className="mx-auto max-w-[1320px] px-5 py-8" data-testid="hire-profile">
      <Link href="/hiring" className="text-sm font-semibold text-brand underline">
        ← {t("title")}
      </Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-muted">{name(p.role)}</p>
          <h1 className="mt-1 text-4xl font-extrabold">{p.name}</h1>
          <p className="mt-2 text-lg">{p.headline}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
            <span className="bg-surface-2 px-2 py-1">{t(`level.${p.experienceLevel}`)}</span>
            {p.years ? <span className="bg-surface-2 px-2 py-1">{t("years", { n: p.years })}</span> : null}
            {p.area ? <span className="bg-surface-2 px-2 py-1">{t("basedIn", { area: name(p.area) })}</span> : null}
            {credential ? (
              <span className="border-2 border-brand px-2 py-0.5 text-brand" data-testid="hire-credential">
                ✓ {t("verifiedCredential", { label: credential })}
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-muted">
            {p.ratingAvg !== null ? t("rating", { avg: p.ratingAvg.toFixed(1), n: p.ratingCount }) : t("noRating")} · {t("jobsDone", { n: p.jobsDone })}
          </p>
          {p.bio ? <p className="mt-6 max-w-[65ch] whitespace-pre-line leading-relaxed">{p.bio}</p> : null}

          <Rates p={p} />
          <BusyStrip busy={p.busy} />
          <div className="mt-8">
            <ShortlistButton profileId={p.id} on={p.shortlisted} slug={slug} />
          </div>
        </div>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          {/* M20: a fitness trainer also sells monthly plans. */}
          {p.role.key === "fitness_trainer" ? (
            <div className="glass-card p-5">
              <TrainerPlans profileId={p.id} slug={slug} />
            </div>
          ) : null}
          <div className="glass-card p-5">
            {p.taking ? <RequestForm profile={p} /> : <p className="font-bold">{t("notTaking")}</p>}
          </div>
        </aside>
      </div>
    </section>
  );
}

function Rates({ p }: { p: ProfilePage }) {
  const t = useTranslations("hire");
  const locale = useLocale();
  const money = (n: number) => formatTaka(n, locale);
  const c = p.rateCard;
  if (!c) return null;
  return (
    <div className="mt-8">
      <h2 className="text-xl font-extrabold">{t("rates")}</h2>
      <table className="mt-3 w-full max-w-xl text-left" data-testid="hire-rates">
        <tbody className="divide-y-2 divide-line">
          {c.items.map((i) => (
            <tr key={`${i.unit}-${i.format ?? ""}`}>
              <th className="py-2 font-semibold">{i.unit === "match" ? (i.format ? t("perMatchFormat", { format: i.format }) : t("perMatch")) : t("perHour")}</th>
              <td className="py-2 text-right font-extrabold tabular-nums">{money(i.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        {c.nightPct ? <li>{t("nightNote", { pct: c.nightPct })}</li> : null}
        {c.shortNoticePct ? <li>{t("shortNote", { pct: c.shortNoticePct, hours: c.shortNoticeHours })}</li> : null}
        <li>{t("travelNote", { north: money(c.travel.north), south: money(c.travel.south), outside: money(c.travel.outside) })}</li>
        <li>{t("maxPerDay", { n: c.maxJobsPerDay })}</li>
      </ul>
    </div>
  );
}

/** The next 14 Dhaka days, each marked free or with its busy times (no details of the other jobs). */
function BusyStrip({ busy }: { busy: { start: string; end: string }[] }) {
  const t = useTranslations("hire");
  const locale = useLocale();
  const byDay = busyByDay(busy);
  const fmt = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });
  const time = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });
  return (
    <div className="mt-8">
      <h2 className="text-xl font-extrabold">{t("availability")}</h2>
      <ol className="mt-3 grid grid-cols-7 gap-1" data-testid="hire-busy">
        {nextDays(14).map((d) => {
          const b = byDay.get(d) ?? [];
          return (
            <li key={d} className={`min-h-16 border-2 p-1 text-xs ${b.length ? "border-amber-500" : "border-line"}`}>
              <span className="block font-bold">{fmt.format(new Date(`${d}T00:00:00Z`))}</span>
              {b.length ? b.map((x) => <span key={x.start} className="block tabular-nums">{`${time.format(new Date(x.start))}–${time.format(new Date(x.end))}`}</span>) : <span className="text-muted">{t("free")}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ShortlistButton({ profileId, on, slug }: { profileId: string; on: boolean; slug: string }) {
  const t = useTranslations("hire");
  const { status } = useAuth();
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: () => hire.setShortlisted(profileId, !on),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ["hire-profile", slug] }), qc.invalidateQueries({ queryKey: ["hire-shortlist"] })]),
  });
  if (status !== "signed_in") return null;
  const code = toggle.error ? problemOf(toggle.error)?.code : null;
  return (
    <div>
      <button type="button" aria-pressed={on} disabled={toggle.isPending} onClick={() => toggle.mutate()} className="min-h-11 border-2 border-line px-4 font-bold hover:border-brand disabled:opacity-50" data-testid="hire-shortlist">
        {on ? t("shortlisted") : t("shortlist")}
      </button>
      {code ? (
        <p role="alert" className="mt-1 text-sm text-danger">
          {code === "SHORTLIST_LIMIT" ? t("shortlistFull") : t("error")}
        </p>
      ) : null}
    </div>
  );
}

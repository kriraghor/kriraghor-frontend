"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { formatTaka } from "@/lib/admin/finance";
import { hireAdmin } from "@/lib/admin/hire";
import { Notice } from "../../ui";

type Diff = Record<string, { from: unknown; to: unknown }>;

/**
 * The `hire_profile` panel on the Moderation desk (M11 FR-12): what changed since the live version,
 * then the working copy the reviewer approves:
 * - the person, role, experience and base area;
 * - the verified credential (M02, per hire role);
 * - the headline and bio (no contact details);
 * - the rate card against the role's limits.
 * Checks, rubric and the decision are the desk's (M05).
 */
export function HireProfilePanel({ payload }: { payload: Record<string, unknown> }) {
  const t = useTranslations("hireAdmin");
  const locale = useLocale();
  const id = String(payload.profileId);
  const q = useQuery({ queryKey: ["admin-hire-profile", id], queryFn: () => hireAdmin.profile(id) });
  if (q.isPending) return <div className="mt-4 h-40 animate-pulse bg-surface-2" />;
  if (q.isError || !q.data) return <Notice tone="error">{t("failed")}</Notice>;
  const p = q.data;
  const money = (n: number) => formatTaka(n, locale);
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const diff = Object.entries((payload.diff ?? {}) as Diff);
  const c = p.rateCard;
  return (
    <div className="mt-6 space-y-4 border-t-2 border-line pt-4" data-testid="hire-profile-panel">
      <div>
        <h3 className="font-bold">{payload.isEdit ? t("whatChanged") : t("firstReview")}</h3>
        {payload.isEdit && diff.length ? (
          <ul className="mt-1 list-disc pl-5 text-sm">
            {diff.map(([field, d]) => (
              <li key={field}>{t("diffField", { field, from: JSON.stringify(d.from ?? "–"), to: JSON.stringify(d.to ?? "–") })}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">{t("person")}</dt>
        <dd className="font-semibold">{p.owner.displayName ?? "–"}</dd>
        <dt className="text-muted">{t("role")}</dt>
        <dd>{p.role ? name(p.role) : "–"}</dd>
        <dt className="text-muted">{t("experience")}</dt>
        <dd>
          {p.experienceLevel ? t(`level.${p.experienceLevel}`) : "–"} · {t("years", { n: p.years ?? 0 })}
        </dd>
        <dt className="text-muted">{t("baseArea")}</dt>
        <dd>{p.baseArea ? name(p.baseArea) : "–"}</dd>
        <dt className="text-muted">{t("credentialLabel")}</dt>
        <dd data-testid="hire-panel-credential">{p.credential ? `${t(`level.${p.credential.level}`)}${p.credential.issuer ? ` · ${p.credential.issuer}` : ""}${p.credential.expiresOn ? ` · ${t("until", { date: p.credential.expiresOn })}` : ""}` : t("noCredential")}</dd>
        <dt className="text-muted">{t("headline")}</dt>
        <dd>{p.headline}</dd>
        <dt className="text-muted">{t("bio")}</dt>
        <dd className="whitespace-pre-line">{p.bio ?? "–"}</dd>
        <dt className="text-muted">{t("u16")}</dt>
        <dd>{p.worksWithU16 ? t("yes") : t("no")}</dd>
      </dl>
      {c ? (
        <div>
          <h3 className="font-bold">{t("rateCard", { n: c.version })}</h3>
          <table className="mt-2 w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-1 font-semibold">{t("unit")}</th>
                <th className="py-1 font-semibold">{t("rate")}</th>
                <th className="py-1 font-semibold">{t("limits")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {c.items.map((i) => {
                const lim = p.limits[`${i.unit}:${i.format ?? ""}`];
                const out = lim ? i.rate < lim.min || i.rate > lim.max : false;
                return (
                  <tr key={`${i.unit}-${i.format ?? ""}`}>
                    <td className="py-1">{i.unit === "match" ? i.format ?? t("perMatch") : t("perHour")}</td>
                    <td className={`py-1 font-semibold tabular-nums ${out ? "text-danger" : ""}`}>{money(i.rate)}</td>
                    <td className="py-1 tabular-nums text-muted">{lim ? `${money(lim.min)}–${money(lim.max)}` : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-sm text-muted">{t("surcharges", { night: c.nightPct, short: c.shortNoticePct, hours: c.shortNoticeHours, north: money(c.travel.north), south: money(c.travel.south), outside: money(c.travel.outside), max: c.maxJobsPerDay })}</p>
        </div>
      ) : (
        <Notice tone="error">{t("noRates")}</Notice>
      )}
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { formatTaka } from "@/lib/admin/finance";
import { tournamentsAdmin } from "@/lib/vendor/tournaments";
import { formatDhaka } from "../useAdminMe";

/**
 * The Moderation desk panel for kind `tournament` (M14): what the organiser submitted (sport, format,
 * teams and squads, fee, prizes, dates, eligibility, venues, the rules summary). Checks, rubric and the
 * decision stay with the desk.
 */
export function TournamentPanel({ payload }: { payload: Record<string, unknown> }) {
  const t = useTranslations("tournamentsAdmin");
  const locale = useLocale();
  const id = String(payload.tournamentId ?? "");
  const q = useQuery({ queryKey: ["admin-tournament", id], queryFn: () => tournamentsAdmin.get(id), enabled: Boolean(id) });
  if (!q.data) return <div className="mt-6 h-32 animate-pulse bg-surface-2" />;
  const x = q.data;
  const elig = x.eligibility as { ageMin?: number; ageMax?: number; gender?: string };
  const row = (label: string, value: string) => (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </>
  );
  return (
    <div className="mt-6 border-t-2 border-line pt-4" data-testid="tournament-panel">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {row(t("sport"), `${locale === "bn" ? x.sport.nameBn : x.sport.nameEn} · ${t(`format.${x.format}`)}`)}
        {row(t("teams"), `${x.minTeams}–${x.maxTeams} · ${t("squad", { min: x.squadMin, max: x.squadMax })}`)}
        {row(t("fee"), x.entryFeePoisha ? formatTaka(x.entryFeePoisha, locale) : t("free"))}
        {row(t("prize"), x.prizePoolPoisha ? `${formatTaka(x.prizePoolPoisha, locale)} (${x.prizeSplit.map((p) => `${p.label} ${p.pct}%`).join(", ")})` : (x.prizeText ?? "–"))}
        {row(t("registration"), `${formatDhaka(x.registrationOpensAt, locale)} – ${formatDhaka(x.registrationClosesAt, locale)}`)}
        {row(t("matchDays"), `${x.startDate ?? "–"} – ${x.endDate ?? "–"}`)}
        {row(t("eligibility"), [elig.ageMin || elig.ageMax ? t("age", { min: elig.ageMin ?? "–", max: elig.ageMax ?? "–" }) : null, elig.gender && elig.gender !== "open" ? t(`gender.${elig.gender}`) : null].filter(Boolean).join(" · ") || t("open"))}
        {row(t("venues"), x.venues.map((v) => `${v.venueText ?? t("ground")}${v.courts.length ? ` (${v.courts.join(", ")})` : ""}`).join("; ") || "–")}
      </dl>
      {x.description ? <p className="mt-3 whitespace-pre-line text-sm">{x.description}</p> : null}
      <p className="mt-3 text-sm text-muted">{locale === "bn" ? x.rules.summaryBn : x.rules.summaryEn}</p>
    </div>
  );
}

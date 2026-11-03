import type { OgStat } from "@kriraghor/ui/share/og";

/**
 * What the link-preview cards say (Round B1 part 5), from the same public reads as the page
 * metadata. Pure, so it is unit-tested; the opengraph-image routes draw it with ShareCard.
 */

export type Locale = "en" | "bn";
export type CardContent = { eyebrow: string | null; title: string; subtitle: string | null; stats: OgStat[] };

type Named = { nameEn?: string | null; nameBn?: string | null } | null | undefined;
const pick = (n: Named, locale: Locale) => (n ? (locale === "bn" ? n.nameBn || n.nameEn : n.nameEn || n.nameBn) || "" : "");
const joinDot = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ") || null;

/** Numbers in the reader's digits (Bangla digits in Bangla). */
export const num = (n: number, locale: Locale, digits = 0) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);

type Hire = { name?: string; headline?: string | null; specialisation?: string | null; role?: Named; area?: Named; ratingAvg?: number | null; ratingCount?: number; jobsDone?: number; years?: number };

/** A hire profile: role above the name, specialisation and area under it, then rating, jobs and years. */
export function hireCard(data: unknown, locale: Locale, labels: { rating: string; jobs: string; years: string }): CardContent | null {
  const h = (data ?? {}) as Hire;
  if (!h.name) return null;
  const stats: OgStat[] = [];
  if (h.ratingAvg != null && (h.ratingCount ?? 0) > 0) stats.push({ label: labels.rating, value: `${num(h.ratingAvg, locale, 1)} (${num(h.ratingCount ?? 0, locale)})`, star: true });
  if (h.jobsDone) stats.push({ label: labels.jobs, value: num(h.jobsDone, locale) });
  if (h.years) stats.push({ label: labels.years, value: num(h.years, locale) });
  return { eyebrow: pick(h.role, locale) || null, title: h.name, subtitle: joinDot(h.specialisation, pick(h.area, locale)) ?? h.headline ?? null, stats };
}

type Player = {
  displayName?: string;
  handle?: string;
  sports?: { nameEn: string; nameBn: string; positions: { en: string; bn: string }[] }[];
};

/** A player page: "Player" above the name, sports with positions under it, then the team count. */
export function playerCard(data: unknown, locale: Locale, labels: { player: string; sports: string }): CardContent | null {
  const p = (data ?? {}) as Player;
  if (!p.displayName) return null;
  const sports = (p.sports ?? []).map((s) => {
    const positions = s.positions.map((x) => (locale === "bn" ? x.bn : x.en)).join(", ");
    return positions ? `${locale === "bn" ? s.nameBn : s.nameEn} (${positions})` : locale === "bn" ? s.nameBn : s.nameEn;
  });
  const stats: OgStat[] = [];
  if (p.sports?.length) stats.push({ label: labels.sports, value: num(p.sports.length, locale) });
  return { eyebrow: labels.player, title: p.displayName, subtitle: sports.join(" · ") || null, stats };
}

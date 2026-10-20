"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { risk } from "@/lib/trust";

type Score = { kind: string; score: number | null; shown: boolean; sample: number; minSample?: number; detail?: Record<string, number> | null };

/**
 * "My reliability" on /me (M18 §6.3): the booker score with what lowers it. Owners see theirs on
 * vendor.kriraghor.com. Venues see a booker's score only once there are enough bookings.
 */
export function MyReliability() {
  const t = useTranslations("trust.reliability");
  const q = useQuery({ queryKey: ["my-trust"], queryFn: () => risk.myTrust() });
  const s = (q.data?.items as Score[] | undefined)?.find((x) => x.kind === "booker");
  if (!s) return null;
  return (
    <section className="glass-card p-5" data-testid="my-reliability">
      <p className="text-sm font-semibold text-muted">{t("title")}</p>
      <p className="mt-1 font-display text-3xl font-bold tabular-nums">{s.score === null ? "–" : `${s.score}%`}</p>
      <p className="text-sm text-muted">{s.shown ? t("shown", { n: s.sample }) : t("hidden", { n: s.sample, min: s.minSample ?? 0 })}</p>
      <p className="mt-1 text-xs text-muted">{t("how", { noShows: s.detail?.booker_no_show ?? 0, late: s.detail?.booker_late_cancel ?? 0 })}</p>
    </section>
  );
}

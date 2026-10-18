"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { tournaments } from "@/lib/tournaments";
import { TournamentCard } from "./TournamentCard";

/** Home tournaments section (M14): three tournaments open for teams, and the way to all of them. */
export function TournamentsStrip() {
  const t = useTranslations("tournaments");
  const q = useQuery({ queryKey: ["home-tournaments"], queryFn: () => tournaments.list({ status: "open" }) });
  const items = (q.data?.items ?? []).slice(0, 3);
  if (!q.isPending && !items.length) return null;
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-12" aria-labelledby="home-tournaments-title" data-testid="tournaments-strip">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">{t("homeKicker")}</p>
          <h2 id="home-tournaments-title" className="mt-2 text-3xl font-extrabold">
            {t("homeTitle")}
          </h2>
        </div>
        <Link href="/tournaments" className="inline-flex min-h-12 items-center bg-brand px-5 font-bold text-white hover:bg-brand-hover">
          {t("homeAll")}
        </Link>
      </div>
      <ul className="mt-6 grid gap-4 md:grid-cols-3">
        {q.isPending
          ? [0, 1, 2].map((i) => <li key={i} className="h-48 animate-pulse bg-surface-2" />)
          : items.map((x) => (
              <li key={x.id}>
                <TournamentCard t={x} />
              </li>
            ))}
      </ul>
    </section>
  );
}

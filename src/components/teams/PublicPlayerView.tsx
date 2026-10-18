"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { publicEnv } from "@/lib/env";
import { teams } from "@/lib/teams";

/** /players/[handle] (M16-FR-05): the public player page. Never gender, DOB, age or phone. */
export function PublicPlayerView({ handle }: { handle: string }) {
  const t = useTranslations("teams");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["player", handle], queryFn: () => teams.player(handle), retry: false });
  const bn = locale === "bn";

  if (q.isPending) return <div className="mx-auto mt-10 h-96 max-w-[900px] animate-pulse bg-surface-2" />;
  if (q.isError || !q.data)
    return (
      <section className="mx-auto max-w-[640px] px-5 py-16">
        <h1 className="text-2xl font-extrabold">{t("playerNotFound")}</h1>
      </section>
    );
  const p = q.data;

  return (
    <section className="mx-auto max-w-[900px] px-5 py-10" data-testid="public-player">
      <p className="font-mono text-sm text-muted">@{p.handle}</p>
      <h1 className="text-4xl font-extrabold" data-testid="player-name">
        {p.displayName}
      </h1>
      {p.bio ? <p className="mt-3 max-w-[65ch] leading-relaxed">{p.bio}</p> : null}

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="text-xl font-extrabold">{t("sportsAndPositions")}</h2>
          {p.sports.length ? (
            <ul className="mt-3 flex flex-col gap-3" data-testid="player-sports">
              {p.sports.map((s) => (
                <li key={s.sportKey} className="border-l-4 border-brand pl-3">
                  <span className="block font-bold">{bn ? s.nameBn : s.nameEn}</span>
                  <span className="text-sm text-muted">{s.positions.map((x) => (bn ? x.bn : x.en)).join(" · ") || "–"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-muted">–</p>
          )}
        </div>
        <div>
          <h2 className="text-xl font-extrabold">{t("teams")}</h2>
          {p.teams.length ? (
            <ul className="mt-3 divide-y-2 divide-line border-y-2 border-line" data-testid="player-teams">
              {p.teams.map((team) => (
                <li key={team.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 font-bold">{team.name}</span>
                  <span className="text-sm text-muted">
                    {team.sport ? (bn ? team.sport.nameBn : team.sport.nameEn) : ""} · {t(`role.${team.role}`)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-muted">{t("noTeamsYet")}</p>
          )}
        </div>
      </div>

      {p.hireProfiles.length || p.esports ? (
        <nav className="mt-8 flex flex-wrap gap-3" aria-label={t("elsewhere")}>
          {p.hireProfiles.map((h) => (
            <Link key={h.slug} href={`/hiring/${h.slug}`} className="inline-flex min-h-11 items-center border-2 border-line px-4 font-bold hover:border-brand">
              {t("hireMe")}
            </Link>
          ))}
          {p.esports ? (
            <a href={`${publicEnv().ESPORTS_URL}/p/${p.esports.handle}`} className="inline-flex min-h-11 items-center border-2 border-line px-4 font-bold hover:border-brand">
              {t("esportsProfile")}
            </a>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}

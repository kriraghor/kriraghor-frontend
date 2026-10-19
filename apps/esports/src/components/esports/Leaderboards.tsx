"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { esports } from "@/lib/esports";
import { Empty } from "./bits";

/** /leaderboards: top players per game, rolling or by season; the formula is published (FR-28, Q125). */
export function Leaderboards() {
  const t = useTranslations("esports");
  const locale = useLocale();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const games = useQuery({ queryKey: ["es-games"], queryFn: () => esports.games() });
  const gameList = (games.data?.items ?? []) as { key: string; nameEn: string; nameBn: string }[];
  const game = params.get("game") ?? gameList[0]?.key ?? "";
  const scope = (params.get("scope") as "rolling" | "season") ?? "rolling";
  const season = params.get("season") ?? undefined;
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set(k, v);
    else next.delete(k);
    router.replace(`${pathname}?${next.toString()}`);
  };
  const q = useQuery({ queryKey: ["es-lb", game, scope, season], enabled: Boolean(game), queryFn: () => esports.leaderboard({ game, scope, ...(season ? { season } : {}) }) });
  const data = q.data as (typeof q.data & { seasons?: string[]; formula?: { halfLifeDays: number; minTournaments: number; tierWeights: Record<string, number> } }) | undefined;

  return (
    <section className="mx-auto max-w-[1000px] px-5 py-10">
      <h1 className="text-3xl font-extrabold">{t("lb.title")}</h1>
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label={t("list.game")}>
        {gameList.map((g) => (
          <button key={g.key} type="button" role="tab" aria-selected={game === g.key} onClick={() => set("game", g.key)} className={`min-h-11 border-2 px-4 text-sm font-bold ${game === g.key ? "border-line-strong bg-line-strong text-bg" : "border-line text-muted"}`}>
            {locale === "bn" ? g.nameBn : g.nameEn}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {(["rolling", "season"] as const).map((s) => (
          <button key={s} type="button" aria-pressed={scope === s} onClick={() => set("scope", s)} className={`min-h-11 border-b-4 px-3 text-sm font-bold ${scope === s ? "border-brand" : "border-transparent text-muted"}`}>
            {t(`lb.${s}`)}
          </button>
        ))}
        {scope === "season" && data?.seasons?.length ? (
          <select value={season ?? data.seasonKey} onChange={(e) => set("season", e.target.value)} aria-label={t("lb.season")} className="min-h-11 field px-3">
            {data.seasons.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {q.isPending && game ? <div className="mt-6 h-64 animate-pulse bg-surface-2" /> : null}
      {data?.items.length ? (
        <ol className="mt-6 glass-card divide-y divide-[var(--glass-edge)] px-4" data-testid="leaderboard">
          {data.items.map((r) => {
            const row = r as typeof r & { username: string | null; displayName: string | null; ign: string | null; tournaments: number };
            return (
              <li key={row.userId} className="flex items-center gap-4 py-3">
                <span className={`w-10 font-display text-2xl font-extrabold tabular-nums ${row.rank <= 3 ? "text-amber-700 dark:text-amber-400" : "text-muted"}`}>{row.rank}</span>
                <div>
                  <Link href={`/p/${row.username ?? row.userId}`} className="font-bold underline-offset-2 hover:underline">
                    {row.ign ?? row.displayName ?? "—"}
                  </Link>
                  <p className="text-xs text-muted">{t("lb.played", { n: row.tournaments })}</p>
                </div>
                <span className="ml-auto font-display text-lg font-extrabold tabular-nums">{Math.round(row.points * 10) / 10}</span>
              </li>
            );
          })}
        </ol>
      ) : data ? (
        <div className="mt-6">
          <Empty title={t("lb.empty")} />
        </div>
      ) : null}
      {data?.formula ? (
        <details className="mt-8 glass-card p-4">
          <summary className="cursor-pointer font-bold">{t("lb.how")}</summary>
          <p className="mt-2 text-sm text-muted">{t("lb.formula", { half: data.formula.halfLifeDays, min: data.formula.minTournaments })}</p>
        </details>
      ) : null}
    </section>
  );
}

/** /p/[handle]: a player's public page (IGNs, masked UIDs, ranks; never the real name). */
export function PlayerProfile({ handle }: { handle: string }) {
  const t = useTranslations("esports");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["es-player", handle], queryFn: () => esports.player(handle) });
  if (q.isPending) return <div className="mx-auto mt-10 h-64 max-w-3xl animate-pulse bg-surface-2" />;
  if (q.isError) return <p className="mx-auto max-w-3xl px-5 py-16 text-danger">{t("notFound")}</p>;
  const p = q.data as unknown as { username: string | null; userId: string; displayName: string | null; tournaments: number; wins: number; kills: number; games: { game: { key: string; nameEn: string; nameBn: string } | null; ign: string; uidMasked: string; rank: number | null; tournaments: number; wins: number; kills: number }[] };
  return (
    <section className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-3xl font-extrabold">{p.games[0]?.ign ?? p.username ?? "—"}</h1>
      {p.username ? <p className="text-muted">@{p.username}</p> : null}
      <dl className="glass-card mt-6 grid grid-cols-3 gap-4 p-4 text-center">
        {(["tournaments", "wins", "kills"] as const).map((k) => (
          <div key={k}>
            <dt className="text-xs uppercase tracking-wide text-muted">{t(`player.${k}`)}</dt>
            <dd className="font-display text-3xl font-extrabold tabular-nums">{p[k]}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-6 space-y-3">
        {p.games.map((g) => (
          <li key={g.game?.key ?? g.ign} className="flex flex-wrap items-center gap-3 glass-card p-4">
            <span className="font-bold">{g.game ? (locale === "bn" ? g.game.nameBn : g.game.nameEn) : ""}</span>
            <span>{g.ign}</span>
            <span className="font-mono text-sm text-muted">{g.uidMasked}</span>
            <span className="ml-auto text-sm">{g.rank ? t("player.rank", { n: g.rank }) : t("player.unranked")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname, useRouter } from "@kriraghor/ui/i18n/navigation";
import { ShareButton } from "@kriraghor/ui/share";
import { publicEnv } from "@kriraghor/session/env";
import { dayLabel } from "@/lib/bookings";
import { formatTaka } from "@/lib/payments";
import { bracket, byDay, refLabel, scoreLine, statusTone, TONE, tournaments, type Hub, type Match, type Ref } from "@/lib/tournaments";

const TABS = ["overview", "fixtures", "standings", "bracket", "teams"] as const;
type Tab = (typeof TABS)[number];

/** One side of a match: the team when known, else its placeholder ("Winner of M5", "1st, Group A"). */
function Side({ side, bold }: { side: Match["teamA"]; bold: boolean }) {
  const t = useTranslations("tournaments");
  if (side.team?.name) return <span className={bold ? "font-extrabold" : "font-semibold"}>{side.team.name}</span>;
  const l = refLabel(side.ref as Ref);
  return <span className="italic text-muted">{t(l.key, l.values)}</span>;
}

function MatchRow({ m, hub }: { m: Match; hub: Hub }) {
  const t = useTranslations("tournaments");
  const locale = useLocale();
  const time = m.scheduledStart ? new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" }).format(new Date(m.scheduledStart)) : t("timeTbc");
  const venue = hub.fixtures.venues.find((v) => v.id === m.venueId);
  const winner = m.result?.winnerTeamId;
  return (
    <li className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 py-3" data-testid="hub-match">
      <span className="font-mono text-sm font-bold text-muted">M{m.matchNo}</span>
      <span className="min-w-0">
        <span className="block">
          <Side side={m.teamA} bold={Boolean(winner && winner === m.teamA.team?.id)} /> <span className="text-muted">v</span> <Side side={m.teamB} bold={Boolean(winner && winner === m.teamB.team?.id)} />
        </span>
        <span className="block text-sm text-muted">
          {time}
          {venue ? ` · ${venue.venueText ?? ""}${m.court ? `, ${m.court}` : ""}` : ""}
          {m.roundName ? ` · ${t(`round.${m.roundName}`, { n: m.roundName.replace("round_of_", "") })}` : ""}
        </span>
      </span>
      <span className="text-right">
        {scoreLine(m) ? <span className="font-bold tabular-nums">{scoreLine(m)}</span> : <span className={`border-2 px-2 py-0.5 text-xs font-bold ${TONE[statusTone(m.status)]}`}>{t(`matchStatus.${m.status}`)}</span>}
      </span>
    </li>
  );
}

/** /tournaments/[slug] (M14 §4.7): the hub. Public: names and NID ticks only, never DOB, gender or phone. */
export function TournamentHub({ slug }: { slug: string }) {
  const t = useTranslations("tournaments");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab: Tab = TABS.includes(params.get("tab") as Tab) ? (params.get("tab") as Tab) : "overview";
  const q = useQuery({ queryKey: ["tournament", slug], queryFn: () => tournaments.hub(slug), retry: false, refetchInterval: (query) => (query.state.data?.status === "live" ? 30_000 : false) });

  if (q.isPending) return <div className="mx-auto mt-10 h-96 max-w-[1320px] animate-pulse bg-surface-2" />;
  if (q.isError || !q.data)
    return (
      <section className="mx-auto max-w-[640px] px-5 py-16">
        <h1 className="text-2xl font-extrabold">{t("notFound")}</h1>
        <Link href="/events" className="mt-3 inline-block font-semibold text-brand underline">
          {t("title")}
        </Link>
      </section>
    );
  const h = q.data;
  const sport = locale === "bn" ? h.sport.nameBn : h.sport.nameEn;
  const leagueMatches = h.fixtures.matches.filter((m) => m.groupId || !m.roundName);
  const rounds = bracket(h.fixtures.matches);
  const visible = TABS.filter((x) => (x === "bracket" ? rounds.length > 0 : x === "standings" ? h.standings.length > 0 : true));
  const fact = (label: string, value: string) => (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-extrabold">{value}</dd>
    </div>
  );
  const canRegister = h.window === "open";
  const elig = h.eligibility as { ageMin?: number; ageMax?: number; gender?: string };

  return (
    <div>
      <section className="border-b-2 border-line bg-surface">
        <div className="mx-auto grid max-w-[1320px] gap-6 px-5 py-10 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">
              {sport} · {t(`format.${h.format}`)}
            </p>
            <h1 className="mt-2 text-4xl font-extrabold leading-tight" data-testid="hub-name">
              {h.name}
            </h1>
            {h.organisation ? <p className="mt-1 text-muted">{t("by", { org: h.organisation.name })}</p> : null}
            <span className={`mt-3 inline-block border-2 px-2 py-0.5 text-sm font-bold ${TONE[statusTone(h.status)]}`} data-testid="hub-status">
              {t(`status.${h.status}`)}
            </span>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            {canRegister ? (
              <Link href={`/events/${h.slug}/register`} className="inline-flex min-h-12 items-center bg-brand px-6 font-bold text-white hover:bg-brand-hover" data-testid="hub-register">
                {t("registerTeam")}
              </Link>
            ) : h.window === "not_yet" && h.registrationOpensAt ? (
              <p className="font-semibold">{t("opensOn", { date: dayLabel(h.registrationOpensAt.slice(0, 10), locale) })}</p>
            ) : null}
            <p className="text-sm text-muted">{t("placesTaken", { n: h.approved, max: h.maxTeams })}</p>
            <ShareButton url={`${publicEnv().WEB_URL}/events/${encodeURIComponent(h.slug)}`} title={h.name} text={sport} testId="hub-share" />
          </div>
        </div>
        <dl className="mx-auto grid max-w-[1320px] grid-cols-2 gap-4 px-5 pb-8 sm:grid-cols-4 lg:grid-cols-6">
          {fact(t("dates"), h.startDate ? `${dayLabel(h.startDate, locale)}${h.endDate && h.endDate !== h.startDate ? ` – ${dayLabel(h.endDate, locale)}` : ""}` : "–")}
          {fact(t("fee"), h.entryFeePoisha ? formatTaka(h.entryFeePoisha, locale) : t("free"))}
          {fact(t("teams"), `${h.minTeams}–${h.maxTeams}`)}
          {fact(t("squad"), `${h.squadMin}–${h.squadMax}`)}
          {fact(t("prize"), h.prizePoolPoisha ? formatTaka(h.prizePoolPoisha, locale) : (h.prizeText ?? "–"))}
          {fact(t("venue"), h.venues[0]?.venueText ?? "–")}
        </dl>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-8">
        <div className="flex gap-1 overflow-x-auto border-b-2 border-line" role="tablist">
          {visible.map((x) => (
            <button key={x} type="button" role="tab" aria-selected={tab === x} onClick={() => router.replace(`${pathname}?tab=${x}`, { scroll: false })} className={`-mb-0.5 min-h-12 whitespace-nowrap border-b-4 px-4 font-bold ${tab === x ? "border-brand" : "border-transparent text-muted hover:text-ink"}`}>
              {t(`tab.${x}`)}
            </button>
          ))}
        </div>

        {tab === "overview" ? (
          <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
            <div>
              {h.description ? <p className="max-w-[65ch] whitespace-pre-line leading-relaxed">{h.description}</p> : null}
              <h2 className="mt-6 text-xl font-extrabold">{t("rules")}</h2>
              <p className="mt-2 max-w-[75ch] text-sm leading-relaxed text-muted">{locale === "bn" ? h.rules.summaryBn : h.rules.summaryEn}</p>
              <p className="mt-2 text-sm">
                <span className="font-semibold">{t("tiebreakers")}:</span> {h.rules.tiebreakers.map((k) => t(`tb.${k}`)).join(" → ")}
              </p>
            </div>
            <aside className="flex flex-col gap-4">
              <div className="border-2 border-line p-4">
                <h2 className="font-extrabold">{t("eligibility")}</h2>
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  <li>{t("elig.nid")}</li>
                  {elig.ageMin || elig.ageMax ? <li>{t("elig.age", { min: elig.ageMin ?? "–", max: elig.ageMax ?? "–" })}</li> : null}
                  {elig.gender && elig.gender !== "open" ? <li>{t(`elig.gender.${elig.gender}`)}</li> : null}
                </ul>
              </div>
              {h.prizeSplit.length ? (
                <div className="border-2 border-line p-4">
                  <h2 className="font-extrabold">{t("prizes")}</h2>
                  <ul className="mt-2 flex flex-col gap-1 text-sm">
                    {h.prizeSplit.map((p) => (
                      <li key={p.label} className="flex justify-between gap-3">
                        <span>{p.label}</span>
                        <span className="font-bold tabular-nums">{h.prizePoolPoisha ? formatTaka(Math.round((h.prizePoolPoisha * p.pct) / 100), locale) : `${p.pct}%`}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted">{t("prizeNote")}</p>
                </div>
              ) : null}
            </aside>
          </div>
        ) : null}

        {tab === "fixtures" ? (
          !leagueMatches.length && !rounds.length ? (
            <p className="mt-6 border-2 border-dashed border-line p-8 text-center font-semibold">{t("noFixtures")}</p>
          ) : (
            <div className="mt-6 flex flex-col gap-6" data-testid="hub-fixtures">
              {byDay(h.fixtures.matches).map((d) => (
                <div key={d.day ?? "tbc"}>
                  <h3 className="font-extrabold">{d.day ? dayLabel(d.day, locale) : t("dateTbc")}</h3>
                  <ul className="mt-2 glass-card divide-y divide-[var(--glass-edge)] px-4">
                    {d.matches.map((m) => (
                      <MatchRow key={m.id} m={m} hub={h} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )
        ) : null}

        {tab === "standings" ? (
          <div className="mt-6 grid gap-8 lg:grid-cols-2" data-testid="hub-standings">
            {h.standings.map((tb) => (
              <div key={`${tb.stageId}-${tb.group ?? "L"}`} className="overflow-x-auto">
                <h3 className="font-extrabold">{tb.group ? t("group", { name: tb.group }) : t("table")}</h3>
                <table className="mt-2 w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b-2 border-line text-left text-muted">
                      <th className="py-2 pr-2">#</th>
                      <th className="py-2">{t("team")}</th>
                      <th className="py-2 text-right">{t("col.p")}</th>
                      <th className="py-2 text-right">{t("col.w")}</th>
                      <th className="py-2 text-right">{t("col.d")}</th>
                      <th className="py-2 text-right">{t("col.l")}</th>
                      <th className="py-2 text-right">{h.sport.engine === "ball_by_ball" ? t("col.nrr") : t("col.diff")}</th>
                      <th className="py-2 text-right">{t("col.pts")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tb.rows.map((r) => (
                      <tr key={r.teamId} className="border-b border-line" data-testid="standings-row">
                        <td className="py-2 pr-2 font-bold tabular-nums">{r.position}</td>
                        <td className="py-2 font-semibold">
                          {r.team?.name ?? "–"}
                          {r.needsLots ? <span className="ml-2 text-xs text-amber-600">{t("lots")}</span> : null}
                        </td>
                        <td className="py-2 text-right tabular-nums">{r.played}</td>
                        <td className="py-2 text-right tabular-nums">{r.won}</td>
                        <td className="py-2 text-right tabular-nums">{r.drawn}</td>
                        <td className="py-2 text-right tabular-nums">{r.lost}</td>
                        <td className="py-2 text-right tabular-nums">{h.sport.engine === "ball_by_ball" ? r.nrr.toFixed(3) : h.sport.engine === "rally" ? r.setsFor - r.setsAgainst : r.for - r.against}</td>
                        <td className="py-2 text-right font-extrabold tabular-nums">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : null}

        {tab === "bracket" ? (
          <div className="mt-6 flex gap-6 overflow-x-auto pb-4" data-testid="hub-bracket">
            {rounds.map((r) => (
              <div key={r.name} className="flex min-w-[240px] flex-col gap-3">
                <h3 className="font-extrabold">{t(`round.${r.name}`, { n: r.name.replace("round_of_", "") })}</h3>
                {r.matches.map((m) => (
                  <div key={m.id} className="glass-card p-3 text-sm">
                    <p className="font-mono text-xs text-muted">M{m.matchNo}</p>
                    <p>
                      <Side side={m.teamA} bold={m.result?.winnerTeamId === m.teamA.team?.id} />
                    </p>
                    <p>
                      <Side side={m.teamB} bold={m.result?.winnerTeamId === m.teamB.team?.id} />
                    </p>
                    {scoreLine(m) ? <p className="mt-1 font-bold tabular-nums">{scoreLine(m)}</p> : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : null}

        {tab === "teams" ? (
          h.teams.length ? (
            <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="hub-teams">
              {h.teams.map((x) => (
                <li key={x.teamId} className="border-2 border-line p-4">
                  <p className="font-extrabold">{x.name}</p>
                  <p className="text-sm text-muted">{t("verifiedOf", { verified: x.verified, players: x.players })}</p>
                  <ul className="mt-2 text-sm">
                    {x.roster.map((p, i) => (
                      <li key={`${p.displayName}-${i}`} className="flex justify-between gap-2">
                        <span>{p.username ? <Link href={`/players/${p.username}`}>{p.displayName}</Link> : p.displayName}</span>
                        {p.nidVerified ? <span className="text-brand">✓</span> : null}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 border-2 border-dashed border-line p-8 text-center font-semibold">{t("noTeams")}</p>
          )
        ) : null}
      </section>
    </div>
  );
}

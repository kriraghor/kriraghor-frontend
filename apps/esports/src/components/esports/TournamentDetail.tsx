"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { useAuth } from "@kriraghor/ui/auth";
import { ShareButton } from "@kriraghor/ui/share";
import { publicEnv } from "@kriraghor/session/env";
import { ctaFor, dhakaTime, esports, takaOf, useRoom } from "@/lib/esports";
import { events } from "@/lib/events";
import { Chip, Countdown, LinkButton, Prize, SlotsBar, StatusChip } from "./bits";
import { StreamPlayer } from "./StreamPlayer";

/** /t/[slug]: everything about one tournament, live (slots, status, standings over the socket). */
const UPCOMING = ["scheduled", "registration_open", "registration_closed", "check_in"];

export function TournamentDetail({ slug }: { slug: string }) {
  const t = useTranslations("esports");
  const locale = useLocale();
  const qc = useQueryClient();
  const { status } = useAuth();
  const signedIn = status === "signed_in";
  const q = useQuery({ queryKey: ["es-t", slug], queryFn: () => esports.get(slug) });
  const id = q.data?.id ?? null;
  const standings = useQuery({ queryKey: ["es-standings", id], enabled: Boolean(id), queryFn: () => esports.standings(id!) });
  const mine = useQuery({ queryKey: ["es-mine"], enabled: signedIn, queryFn: () => esports.mine() });
  const partOf = useQuery({ queryKey: ["es-events", "of", id], enabled: Boolean(id), queryFn: () => events.list({ tournamentId: id! }) });
  const event = partOf.data?.items[0] ?? null;
  useRoom(id ? `esports_tournament:${id}` : null, {
    "esports.slots_updated": () => void qc.invalidateQueries({ queryKey: ["es-t", slug] }),
    "esports.status_changed": () => void qc.invalidateQueries({ queryKey: ["es-t", slug] }),
    "esports.standings_updated": () => void qc.invalidateQueries({ queryKey: ["es-standings", id] }),
  });

  if (q.isPending) return <div className="rounded-control mx-auto mt-10 h-96 max-w-[1320px] kg-shimmer bg-surface-2" />;
  if (q.isError) return <p className="mx-auto max-w-[1320px] px-5 py-16 text-danger">{t("notFound")}</p>;
  const d = q.data;
  const entry = (mine.data?.items ?? []).find((r) => r.tournamentId === d.id && !["withdrawn", "cancelled", "refunded"].includes(r.status)) ?? null;
  const cta = ctaFor(d, entry);
  const title = locale === "bn" ? d.titleBn : d.titleEn;

  return (
    <article className="mx-auto max-w-[1320px] px-5 py-10">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={d.status} />
            <Chip>{locale === "bn" ? d.game?.nameBn : d.game?.nameEn}</Chip>
            <Chip>{locale === "bn" ? d.mode?.nameBn : d.mode?.nameEn}</Chip>
            <Chip>{t(`tier.${d.tier}`)}</Chip>
            {d.entryPolicy === "invite" ? <Chip tone="warn">{t("inviteOnly")}</Chip> : null}
          </div>
          {event ? (
            <p className="mt-3 text-sm font-semibold" data-testid="part-of-event">
              {t("partOf")}{" "}
              <Link href={`/showcases/${event.slug}`} className="underline">
                {locale === "bn" ? event.titleBn : event.titleEn}
              </Link>
            </p>
          ) : null}
          <h1 className="mt-4 text-3xl font-extrabold leading-tight md:text-5xl" data-testid="tournament-title">
            {title}
          </h1>
          <p className="mt-2 text-muted">
            {t("startsAt", { when: dhakaTime(d.startsAt, locale) })} · {t(`format.${d.format}`)} · {t(d.entryUnit === "squad" ? "perSquad" : "perPlayer")}
          </p>
          <ShareButton
            url={`${publicEnv().ESPORTS_URL}/events/${encodeURIComponent(d.slug)}`}
            title={title}
            text={[locale === "bn" ? d.game?.nameBn : d.game?.nameEn, d.prizePool.amount > 0 ? t("sharePrize", { amount: takaOf(d.prizePool, locale) }) : null].filter(Boolean).join(" · ")}
            className="mt-4"
            testId="tournament-share"
          />

          <section className="mt-8" aria-labelledby="prizes-h">
            <h2 id="prizes-h" className="text-xl font-extrabold">
              {t("prizes")}
            </h2>
            <ol className="mt-3 surface-card divide-y divide-[var(--glass-edge)] px-4" data-testid="prize-table">
              {d.prizes.map((p) => (
                <li key={p.place} className="flex items-center justify-between py-3">
                  <span className="font-bold">{t("place", { n: p.place })}</span>
                  <Prize money={p.amount} className="text-xl" />
                </li>
              ))}
              {d.killReward.amount > 0 ? (
                <li className="flex items-center justify-between py-3">
                  <span className="font-bold">{t("perKill")}</span>
                  <Prize money={d.killReward} className="text-xl" />
                </li>
              ) : null}
            </ol>
            <p className="mt-2 text-sm text-muted">{t("guaranteed")}</p>
          </section>

          <section className="mt-8" aria-labelledby="schedule-h">
            <h2 id="schedule-h" className="text-xl font-extrabold">
              {t("schedule")}
            </h2>
            <ul className="mt-3 surface-card divide-y divide-[var(--glass-edge)] px-4">
              {d.matches.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="font-bold">{t("match", { n: m.seq })}</span>
                  <span className="text-muted">{locale === "bn" ? m.map?.nameBn : m.map?.nameEn}</span>
                  <span className="ml-auto text-sm tabular-nums">{dhakaTime(m.startsAt, locale)}</span>
                  <StatusChip status={m.status === "final" ? "finalised" : m.status} />
                </li>
              ))}
            </ul>
            {d.stages[0] ? <p className="mt-2 text-sm text-muted">{t("checkinWindow", { from: dhakaTime(d.stages[0].checkinOpensAt, locale, { timeStyle: "short" }), to: dhakaTime(d.stages[0].checkinClosesAt, locale, { timeStyle: "short" }) })}</p> : null}
          </section>

          {d.streams.length ? (
            <section className="mt-8" aria-labelledby="streams-h">
              <h2 id="streams-h" className="text-xl font-extrabold">
                {t("streams")}
              </h2>
              <div className="mt-3">
                <StreamPlayer streams={d.streams} />
              </div>
            </section>
          ) : null}

          <section className="mt-8" aria-labelledby="standings-h">
            <h2 id="standings-h" className="text-xl font-extrabold">
              {t("standings")}
            </h2>
            {standings.data?.items.length ? (
              <div className="rounded-card mt-3 overflow-x-auto border border-line">
                <table className="w-full min-w-[480px] text-sm" data-testid="standings">
                  <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">{t("entry")}</th>
                      <th className="px-3 py-2 text-right">{t("pts")}</th>
                      <th className="px-3 py-2 text-right">{t("wins")}</th>
                      <th className="px-3 py-2 text-right">{t("kills")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.data.items.map((s) => (
                      <tr key={s.registrationId} className="border-t border-line">
                        <td className="px-3 py-2 font-display font-extrabold tabular-nums">{s.rank}</td>
                        <td className="px-3 py-2 font-semibold">{(s as { entry?: { name?: string } }).entry?.name ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums">{s.totalPoints}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{s.wins}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{s.kills}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-3 py-2 text-xs text-muted">{t("tieBreak")}</p>
              </div>
            ) : (
              <p className="mt-3 text-muted">{t("standingsSoon")}</p>
            )}
          </section>

          {d.rulesMd ? (
            <section className="mt-8" aria-labelledby="rules-h">
              <h2 id="rules-h" className="text-xl font-extrabold">
                {t("rules")}
              </h2>
              <p className="mt-3 max-w-[70ch] whitespace-pre-wrap text-muted">{d.rulesMd}</p>
            </section>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="glass-strong rounded-card p-5" data-testid="entry-box">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{t("prizePool")}</p>
            <Prize money={d.prizePool} className="text-4xl" />
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted">{t("entryFee")}</dt>
                <dd className="text-lg font-extrabold">{d.entryFee.amount === 0 ? t("free") : takaOf(d.entryFee, locale)}</dd>
              </div>
              <div>
                {/* Once play has started the countdown means nothing: show when it started instead. */}
                <dt className="text-muted">{UPCOMING.includes(d.status) ? t("startsIn") : t("startedAt")}</dt>
                <dd className="text-lg font-extrabold">
                  {UPCOMING.includes(d.status) ? <Countdown to={d.startsAt} done={t("status.live")} /> : dhakaTime(d.startsAt, locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                </dd>
              </div>
            </dl>
            <div className="mt-4">
              <SlotsBar taken={d.slotsTaken} max={d.maxSlots} />
              {d.waitlist ? <p className="mt-1 text-xs text-muted">{t("waitlistCount", { n: d.waitlist })}</p> : null}
            </div>
            <div className="mt-5">
              {cta === "register" || cta === "waitlist" ? (
                <LinkButton href={signedIn ? `/events/${d.slug}/register` : `/sign-in?next=/events/${d.slug}/register`} testId="cta-register">
                  {t(cta === "register" ? "register" : "joinWaitlist")}
                </LinkButton>
              ) : cta === "pay" && entry ? (
                <LinkButton href="/me/matches" testId="cta-pay">
                  {t("finishPayment")}
                </LinkButton>
              ) : cta === "view_entry" ? (
                <LinkButton href="/me/matches" tone="outline" testId="cta-entry">
                  {t("viewEntry")}
                </LinkButton>
              ) : cta === "soon" ? (
                <p className="font-semibold">{t("opensAt", { when: dhakaTime(d.registrationOpensAt, locale) })}</p>
              ) : (
                <p className="font-semibold text-muted">{t(`cta.${cta}`)}</p>
              )}
            </div>
            {d.status === "registration_open" ? <p className="mt-3 text-xs text-muted">{t("closesAt", { when: dhakaTime(d.registrationClosesAt, locale) })}</p> : null}
          </div>
          <p className="mt-3 text-xs text-muted">
            {t("minNote", { n: d.minParticipants })} <Link href="/leaderboards" className="underline">{t("home.leaderboards")}</Link>
          </p>
        </aside>
      </div>
    </article>
  );
}

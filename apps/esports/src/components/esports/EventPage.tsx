"use client";

import { useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { problemOf } from "@/lib/api/client";
import { dhakaTime, esports, takaOf, useRoom } from "@/lib/esports";
import { byFinal, events, jitter, type EventBundle, type EventPoll, type FeedItem } from "@/lib/events";
import { Chip, Countdown, Prize, StatusChip } from "./bits";
import { StreamPlayer } from "./StreamPlayer";

/**
 * /e/[slug]: a big event (M23). The banner, title sponsor, dates and prize total; the stream player;
 * live standings per stage; the feed; polls; the road from qualifiers to the final; sponsors. The page
 * is the public bundle (cacheable) plus the viewer's own follow and votes. Room pings (stream, feed,
 * polls, phase) and the active tournament's standings pings re-fetch after a small random delay.
 */
export function EventPage({ slug }: { slug: string }) {
  const t = useTranslations("esports.events");
  const te = useTranslations("esports");
  const locale = useLocale();
  const qc = useQueryClient();
  const { status } = useAuth();
  const signedIn = status === "signed_in";
  const q = useQuery({ queryKey: ["es-event", slug], queryFn: () => events.get(slug) });
  const id = q.data?.event.id ?? null;
  const me = useQuery({ queryKey: ["es-event-me", id], enabled: signedIn && Boolean(id), queryFn: () => events.me(id!) });
  const refetch = () => setTimeout(() => void qc.invalidateQueries({ queryKey: ["es-event", slug] }), jitter());
  useRoom(id ? `esports_event:${id}` : null, {
    "esports_event.feed_added": refetch,
    "esports_event.stream_changed": refetch,
    "esports_event.poll_updated": refetch,
    "esports_event.phase_changed": refetch,
  });

  if (q.isPending) return <div className="mx-auto mt-10 h-96 max-w-[1320px] animate-pulse bg-surface-2" />;
  if (q.isError) return <p className="mx-auto max-w-[1320px] px-5 py-16 text-danger">{t("notFound")}</p>;
  const b = q.data;
  const e = b.event;
  const bn = locale === "bn";
  const title = bn ? e.titleBn : e.titleEn;
  const tagline = bn ? (e.taglineBn ?? e.taglineEn) : (e.taglineEn ?? e.taglineBn);
  const about = bn ? e.aboutMdBn || e.aboutMdEn : e.aboutMdEn || e.aboutMdBn;
  const titleSponsor = b.sponsors.find((s) => s.tier === "title") ?? null;
  const style = { "--event-accent": e.accentHex } as CSSProperties;

  return (
    <div style={style} data-testid="event-page">
      <header className="relative overflow-hidden border-b-4 border-[var(--event-accent)] bg-band text-band-text">
        {e.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        ) : null}
        <div className="relative mx-auto grid max-w-[1320px] gap-6 px-5 py-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:py-14">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={e.phase === "live" ? "live" : e.phase === "cancelled" ? "bad" : "muted"}>{t(`phase.${e.phase}`)}</Chip>
              {titleSponsor ? <span className="text-sm font-semibold text-band-text/80">{t("presentedBy", { name: titleSponsor.name })}</span> : null}
            </div>
            <h1 className="mt-3 max-w-[22ch] text-4xl font-extrabold leading-[1.05] md:text-6xl" data-testid="event-title">
              {title}
            </h1>
            {tagline ? <p className="mt-3 max-w-[52ch] text-lg text-band-text/80">{tagline}</p> : null}
            <p className="mt-3 text-sm text-band-text/70">
              {dhakaTime(e.startsAt, locale, { dateStyle: "medium" })} – {dhakaTime(e.endsAt, locale, { dateStyle: "medium" })}
            </p>
            {e.phase === "cancelled" && e.cancelReason ? <p className="mt-3 font-semibold text-amber-300">{t("cancelled", { reason: e.cancelReason })}</p> : null}
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <div className="md:text-right">
              <p className="text-xs font-bold uppercase tracking-wide text-band-text/60">{t("prizeTotal")}</p>
              <p className="font-display text-4xl font-extrabold text-[var(--event-accent)]" data-testid="event-prize">
                {takaOf(e.prizeTotal, locale)}
              </p>
            </div>
            {e.phase === "upcoming" ? (
              <p className="text-sm">
                {t("startsIn")} <Countdown to={e.startsAt} />
              </p>
            ) : null}
            {e.status === "published" ? <FollowButton id={e.id} slug={slug} signedIn={signedIn} following={Boolean(me.data?.following)} followers={e.followers} /> : null}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1320px] gap-8 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-10">
          {b.streams.length ? (
            <section aria-labelledby="watch-h">
              <h2 id="watch-h" className="mb-3 text-xl font-extrabold">
                {t("watch")}
              </h2>
              <StreamPlayer streams={b.streams} />
            </section>
          ) : null}
          <Standings bundle={b} />
          <Road bundle={b} />
          {about ? (
            <section aria-labelledby="about-h">
              <h2 id="about-h" className="text-xl font-extrabold">
                {t("about")}
              </h2>
              <p className="mt-3 max-w-[70ch] whitespace-pre-wrap text-muted">{about}</p>
            </section>
          ) : null}
        </div>
        <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
          {b.polls.map((p) => (
            <Poll key={p.id} eventId={e.id} poll={p} myVote={me.data?.votes?.[p.id] ?? null} signedIn={signedIn} slug={slug} />
          ))}
          <Feed items={b.feed.items} />
          {b.sponsors.length ? (
            <section aria-labelledby="sponsors-h" data-testid="event-sponsors">
              <h2 id="sponsors-h" className="text-lg font-extrabold">
                {t("sponsors")}
              </h2>
              <ul className="mt-3 grid grid-cols-2 gap-3">
                {b.sponsors.map((s) => {
                  const body = (
                    <>
                      {s.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.logoUrl} alt={s.name} className="h-10 w-full object-contain" />
                      ) : (
                        <span className="font-bold">{s.name}</span>
                      )}
                      <span className="mt-1 block text-xs text-muted">{t(`tier.${s.tier}`)}</span>
                    </>
                  );
                  return (
                    <li key={s.id} className={`border-2 p-3 text-center ${s.tier === "title" ? "col-span-2 border-[var(--event-accent)]" : "border-line"}`}>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="sponsored noopener noreferrer" className="block">
                          {body}
                        </a>
                      ) : (
                        body
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
          <p className="text-xs text-muted">
            {te("guaranteed")} <Link href="/events" className="underline">{t("allTournaments")}</Link>
          </p>
        </aside>
      </div>
    </div>
  );
}

function FollowButton({ id, slug, signedIn, following, followers }: { id: string; slug: string; signedIn: boolean; following: boolean; followers: number }) {
  const t = useTranslations("esports.events");
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => (following ? events.unfollow(id) : events.follow(id)),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["es-event-me", id] });
      await qc.invalidateQueries({ queryKey: ["es-event", slug] });
    },
  });
  if (!signedIn)
    return (
      <Link href={`/sign-in?next=/showcases/${slug}`} className="inline-flex min-h-11 items-center bg-[var(--event-accent)] px-5 font-bold text-black" data-testid="event-follow">
        {t("follow")} · {followers}
      </Link>
    );
  return (
    <button type="button" onClick={() => m.mutate()} disabled={m.isPending} aria-pressed={following} className={`inline-flex min-h-11 items-center px-5 font-bold ${following ? "border-2 border-band-text/40" : "bg-[var(--event-accent)] text-black"}`} data-testid="event-follow">
      {following ? t("following") : t("follow")} · {followers}
    </button>
  );
}

/** Live standings, one tab per stage; the active tab's tournament room keeps it fresh. */
function Standings({ bundle }: { bundle: EventBundle }) {
  const t = useTranslations("esports.events");
  const te = useTranslations("esports");
  const locale = useLocale();
  const qc = useQueryClient();
  const tabs = bundle.stages.filter((s) => s.tournament);
  const [active, setActive] = useState<string | null>(null);
  const current = tabs.find((s) => s.tournament!.id === active) ?? tabs.find((s) => ["check_in", "live", "results_pending"].includes(s.tournament!.status)) ?? tabs[0] ?? null;
  const tid = current?.tournament?.id ?? null;
  const q = useQuery({ queryKey: ["es-standings", tid], enabled: Boolean(tid), queryFn: () => esports.standings(tid!) });
  useRoom(tid ? `esports_tournament:${tid}` : null, { "esports.standings_updated": () => setTimeout(() => void qc.invalidateQueries({ queryKey: ["es-standings", tid] }), jitter()) });
  if (!tabs.length) return null;
  return (
    <section aria-labelledby="standings-h">
      <h2 id="standings-h" className="text-xl font-extrabold">
        {t("standings")}
      </h2>
      <div role="tablist" className="mt-3 flex flex-wrap gap-2">
        {tabs.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={s.id === current?.id} onClick={() => setActive(s.tournament!.id)} className={`min-h-11 border-2 px-4 text-sm font-bold ${s.id === current?.id ? "border-brand bg-brand text-white" : "border-line"}`}>
            {locale === "bn" ? s.labelBn : s.labelEn}
          </button>
        ))}
      </div>
      {current ? (
        <div className="mt-3 border-2 border-line" role="tabpanel">
          <div className="flex flex-wrap items-center gap-2 border-b-2 border-line bg-surface-2 px-3 py-2 text-sm">
            <Link href={`/events/${current.tournament!.slug}`} className="font-bold underline">
              {locale === "bn" ? current.tournament!.titleBn : current.tournament!.titleEn}
            </Link>
            <StatusChip status={current.tournament!.status} />
          </div>
          {q.data?.items.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm" data-testid="event-standings">
                <thead className="text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">{te("entry")}</th>
                    <th className="px-3 py-2 text-right">{te("pts")}</th>
                    <th className="px-3 py-2 text-right">{te("kills")}</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.items.map((s) => (
                    <tr key={s.registrationId} className={`border-t border-line ${current.role === "qualifier" && current.qualifyCount && s.rank <= current.qualifyCount ? "bg-[color-mix(in_srgb,var(--event-accent)_14%,transparent)]" : ""}`}>
                      <td className="px-3 py-2 font-display font-extrabold tabular-nums">{s.rank}</td>
                      <td className="px-3 py-2 font-semibold">{(s as { entry?: { name?: string } }).entry?.name ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{s.totalPoints}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.kills}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {current.role === "qualifier" && current.qualifyCount ? <p className="px-3 py-2 text-xs text-muted">{t("cutLine", { n: current.qualifyCount })}</p> : null}
            </div>
          ) : (
            <p className="px-3 py-4 text-muted">{te("standingsSoon")}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

/** The road to the final: qualifiers (with how many go through) and who has a place. */
function Road({ bundle }: { bundle: EventBundle }) {
  const t = useTranslations("esports.events");
  const locale = useLocale();
  const finals = bundle.stages.filter((s) => s.role === "final" && s.tournament);
  if (!finals.length) return null;
  const places = byFinal(bundle.qualifications);
  return (
    <section aria-labelledby="road-h" data-testid="event-road">
      <h2 id="road-h" className="text-xl font-extrabold">
        {t("road")}
      </h2>
      {finals.map((f) => {
        const feeders = bundle.stages.filter((s) => s.role === "qualifier" && s.finalTournamentId === f.tournament!.id);
        const list = places.get(f.tournament!.id) ?? [];
        return (
          <div key={f.id} className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <ol className="space-y-2">
              {feeders.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2 border-2 border-line p-3">
                  <Link href={`/events/${s.tournament!.slug}`} className="font-bold underline">
                    {locale === "bn" ? s.labelBn : s.labelEn}
                  </Link>
                  <StatusChip status={s.tournament!.status} />
                  <span className="ml-auto text-sm text-muted">{t("topN", { n: s.qualifyCount ?? 0 })}</span>
                </li>
              ))}
              <li className="flex flex-wrap items-center gap-2 border-2 border-[var(--event-accent)] p-3">
                <Link href={`/events/${f.tournament!.slug}`} className="font-extrabold underline">
                  {locale === "bn" ? f.labelBn : f.labelEn}
                </Link>
                <StatusChip status={f.tournament!.status} />
                <Prize money={f.tournament!.prizePool} className="ml-auto text-lg" />
              </li>
            </ol>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted">{t("qualified", { n: list.filter((x) => x.status !== "missed").length })}</h3>
              {list.length ? (
                <ul className="mt-2 divide-y divide-line border-y-2 border-line" data-testid="event-qualified">
                  {list.map((x) => (
                    <li key={x.id} className="flex items-center gap-2 py-2 text-sm">
                      <span className="font-semibold">{x.entry.name}</span>
                      {x.entry.tag ? <span className="text-muted">[{x.entry.tag}]</span> : null}
                      <span className="ml-auto">
                        <Chip tone={x.status === "missed" ? "warn" : x.status === "entered" ? "ok" : "muted"}>{t(`qualStatus.${x.status}`)}</Chip>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted">{t("noneYet")}</p>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function feedText(i: FeedItem, t: ReturnType<typeof useTranslations>, locale: string): string {
  const title = i.tournament ? (locale === "bn" ? i.tournament.titleBn : i.tournament.titleEn) : "";
  const text = locale === "bn" ? (i.textBn ?? i.textEn) : (i.textEn ?? i.textBn);
  if (i.kind === "announcement") return text ?? "";
  if (i.kind === "event_cancelled") return t("feed.event_cancelled", { reason: text ?? "" });
  if (i.kind === "qualified") return t(i.data.late ? "feed.qualified_late" : "feed.qualified", { n: Number(i.data.count ?? 0), title });
  if (i.kind === "stream_live") return title ? t("feed.stream_live_t", { title }) : t("feed.stream_live");
  return t(`feed.${i.kind}`, { title });
}

function Feed({ items }: { items: FeedItem[] }) {
  const t = useTranslations("esports.events");
  const locale = useLocale();
  return (
    <section aria-labelledby="feed-h" aria-live="polite">
      <h2 id="feed-h" className="text-lg font-extrabold">
        {t("feedTitle")}
      </h2>
      {items.length ? (
        <ol className="mt-3 space-y-3" data-testid="event-feed">
          {items.map((i) => (
            <li key={i.id} className={`border-l-4 pl-3 ${i.kind === "announcement" ? "border-[var(--event-accent)]" : "border-line"}`}>
              <p className="text-sm font-semibold">{feedText(i, t, locale)}</p>
              <p className="text-xs text-muted">{dhakaTime(i.createdAt, locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-muted">{t("feedEmpty")}</p>
      )}
    </section>
  );
}

function Poll({ eventId, poll, myVote, signedIn, slug }: { eventId: string; poll: EventPoll; myVote: string | null; signedIn: boolean; slug: string }) {
  const t = useTranslations("esports.events");
  const locale = useLocale();
  const qc = useQueryClient();
  const vote = useMutation({
    mutationFn: (optionId: string) => events.vote(eventId, poll.id, optionId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["es-event-me", eventId] });
      await qc.invalidateQueries({ queryKey: ["es-event", slug] });
    },
  });
  const voted = myVote ?? (vote.data?.myVote as string | undefined) ?? null;
  const showResults = Boolean(voted) || poll.status === "closed";
  const results = vote.data?.results ?? poll.results;
  const pct = (id: string) => results.items.find((r) => r.optionId === id)?.pct ?? 0;
  return (
    <section className="border-2 border-line p-4" data-testid="event-poll">
      <div className="flex items-start gap-2">
        <h2 className="flex-1 font-extrabold">{locale === "bn" ? poll.questionBn : poll.questionEn}</h2>
        {poll.status === "closed" ? <Chip>{t("pollClosed")}</Chip> : null}
      </div>
      <ul className="mt-3 space-y-2">
        {poll.options.map((o) => (
          <li key={o.id}>
            {showResults ? (
              <div className="relative overflow-hidden border-2 border-line px-3 py-2 text-sm">
                <span className="absolute inset-y-0 left-0 bg-[color-mix(in_srgb,var(--event-accent)_30%,transparent)]" style={{ width: `${pct(o.id)}%` }} aria-hidden />
                <span className="relative flex items-center gap-2 font-semibold">
                  {locale === "bn" ? o.labelBn : o.labelEn}
                  {voted === o.id ? <span className="text-xs text-muted">({t("yourVote")})</span> : null}
                  <span className="ml-auto tabular-nums">{pct(o.id)}%</span>
                </span>
              </div>
            ) : signedIn ? (
              <button type="button" disabled={vote.isPending} onClick={() => vote.mutate(o.id)} className="min-h-11 w-full border-2 border-line px-3 text-left text-sm font-semibold hover:border-brand">
                {locale === "bn" ? o.labelBn : o.labelEn}
              </button>
            ) : (
              <Link href={`/sign-in?next=/showcases/${slug}`} className="flex min-h-11 items-center border-2 border-line px-3 text-sm font-semibold">
                {locale === "bn" ? o.labelBn : o.labelEn}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">{t("votes", { n: results.total })}</p>
      {vote.error ? <p className="mt-2 text-sm text-danger">{problemOf(vote.error)?.title ?? t("failed")}</p> : null}
    </section>
  );
}

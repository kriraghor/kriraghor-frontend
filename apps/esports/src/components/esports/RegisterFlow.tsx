"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { problemOf, type Problem } from "@/lib/api/client";
import { esports, takaOf } from "@/lib/esports";
import { Button, Notice } from "../ui";
import { Empty, LinkButton, Prize } from "./bits";

type Member = { userId: string; profileId: string | null; ign: string | null; username: string | null; status: string; role: string };

/**
 * /t/[slug]/register: solo (confirm your UID) or squad (the captain picks the players and substitutes,
 * each with a verified UID). Paid entries continue to the payment page; a full tournament puts the
 * entry on the waitlist (pay only when offered a slot).
 */
export function RegisterFlow({ slug }: { slug: string }) {
  const t = useTranslations("esports");
  const locale = useLocale();
  const router = useRouter();
  const tq = useQuery({ queryKey: ["es-t", slug], queryFn: () => esports.get(slug) });
  const profiles = useQuery({ queryKey: ["es-profiles"], queryFn: () => esports.profiles() });
  const squads = useQuery({ queryKey: ["es-squads"], queryFn: () => esports.squads() });
  const [squadId, setSquadId] = useState("");
  const [players, setPlayers] = useState<string[]>([]);
  const [subs, setSubs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [waitlisted, setWaitlisted] = useState(false);

  if (tq.isPending || profiles.isPending) return <div className="mx-auto mt-10 h-64 max-w-3xl animate-pulse bg-surface-2" />;
  if (tq.isError) return <p className="mx-auto max-w-3xl px-5 py-16 text-danger">{t("notFound")}</p>;
  const d = tq.data;
  const mine = (profiles.data?.items ?? []).find((p) => p.gameId === d.game?.id && p.status === "verified");
  const teamSize = (d.mode as { teamSize?: number } | null)?.teamSize ?? 1;
  const maxSubs = (d.mode as { maxSubs?: number } | null)?.maxSubs ?? 0;
  const mySquads = (squads.data?.items ?? []).filter((s) => s.gameId === d.game?.id && (s as { myStatus?: string }).myStatus === "active");
  const squad = mySquads.find((s) => s.id === squadId);
  const members = ((squad?.members ?? []) as Member[]).filter((m) => m.status === "active");

  async function submit() {
    setBusy(true);
    setProblem(null);
    try {
      const body = d.entryUnit === "squad" ? { squadId, players, substitutes: subs } : { players: [mine!.id] };
      const r = await esports.register(d.id, body);
      if (r.payment) {
        window.location.assign(r.payment.payUrl);
        return;
      }
      if (r.waitlisted) setWaitlisted(true);
      else router.push("/me/matches");
    } catch (err) {
      setProblem(problemOf(err) ?? { code: "UNKNOWN", title: t("failed"), status: 0 });
    } finally {
      setBusy(false);
    }
  }

  const toggle = (list: string[], set: (v: string[]) => void, id: string, max: number) => set(list.includes(id) ? list.filter((x) => x !== id) : list.length < max ? [...list, id] : list);

  return (
    <section className="mx-auto max-w-3xl px-5 py-10">
      <Link href={`/t/${d.slug}`} className="text-sm font-semibold text-brand underline">
        ← {locale === "bn" ? d.titleBn : d.titleEn}
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold">{t("reg.title")}</h1>
      <div className="mt-4 flex flex-wrap gap-6 border-y-2 border-line py-4">
        <div>
          <p className="text-xs uppercase text-muted">{t("entryFee")}</p>
          <p className="text-xl font-extrabold">{d.entryFee.amount === 0 ? t("free") : takaOf(d.entryFee, locale)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted">{t("prizePool")}</p>
          <Prize money={d.prizePool} className="text-xl" />
        </div>
        <div>
          <p className="text-xs uppercase text-muted">{t("slotsLeft")}</p>
          <p className="text-xl font-extrabold tabular-nums">{Math.max(0, d.maxSlots - d.slotsTaken)}</p>
        </div>
      </div>

      {waitlisted ? (
        <div className="mt-6">
          <Notice>{t("reg.waitlisted")}</Notice>
          <div className="mt-4">
            <LinkButton href="/me/matches">{t("myMatches")}</LinkButton>
          </div>
        </div>
      ) : !mine ? (
        <div className="mt-6">
          <Empty title={t("reg.needUid")} body={t("reg.needUidBody")} action={<LinkButton href="/me/esports">{t("home.addUid")}</LinkButton>} />
        </div>
      ) : d.entryUnit === "player" ? (
        <div className="mt-6 border-2 border-line bg-surface p-5">
          <p className="text-sm text-muted">{t("reg.playingAs")}</p>
          <p className="mt-1 text-xl font-extrabold">
            {mine.ign} <span className="font-mono text-base text-muted">{mine.uidMasked}</span>
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {!mySquads.length ? (
            <Empty title={t("reg.needSquad")} body={t("reg.needSquadBody", { n: teamSize })} action={<LinkButton href="/me/esports">{t("squads.title")}</LinkButton>} />
          ) : (
            <>
              <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
                {t("reg.squad")}
                <select value={squadId} onChange={(e) => (setSquadId(e.target.value), setPlayers([]), setSubs([]))} className="min-h-12 border-2 border-line bg-surface px-3 text-base text-ink">
                  <option value="">{t("reg.chooseSquad")}</option>
                  {mySquads.map((s) => (
                    <option key={s.id} value={s.id}>
                      [{s.tag}] {s.name}
                    </option>
                  ))}
                </select>
              </label>
              {squad ? (
                <fieldset className="border-2 border-line p-4">
                  <legend className="px-1 font-bold">{t("reg.pick", { n: teamSize, subs: maxSubs })}</legend>
                  <ul className="divide-y divide-line">
                    {members.map((m) => {
                      const id = m.profileId;
                      const isPlayer = Boolean(id && players.includes(id));
                      const isSub = Boolean(id && subs.includes(id));
                      return (
                        <li key={m.userId} className="flex flex-wrap items-center gap-3 py-3">
                          <span className="font-semibold">{m.ign ?? m.username ?? "—"}</span>
                          {!id ? <span className="text-xs text-danger">{t("reg.noUid")}</span> : null}
                          <span className="ml-auto flex gap-2">
                            <button type="button" disabled={!id} aria-pressed={isPlayer} onClick={() => (id ? (setSubs(subs.filter((x) => x !== id)), toggle(players, setPlayers, id, teamSize)) : null)} className={`min-h-11 border-2 px-3 text-sm font-bold disabled:opacity-40 ${isPlayer ? "border-brand bg-brand text-white" : "border-line"}`}>
                              {t("reg.player")}
                            </button>
                            {maxSubs > 0 ? (
                              <button type="button" disabled={!id} aria-pressed={isSub} onClick={() => (id ? (setPlayers(players.filter((x) => x !== id)), toggle(subs, setSubs, id, maxSubs)) : null)} className={`min-h-11 border-2 px-3 text-sm font-bold disabled:opacity-40 ${isSub ? "border-line-strong bg-surface-2" : "border-line"}`}>
                                {t("reg.sub")}
                              </button>
                            ) : null}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-2 text-sm text-muted">{t("reg.picked", { n: players.length, of: teamSize })}</p>
                </fieldset>
              ) : null}
            </>
          )}
        </div>
      )}

      {!waitlisted && mine && (d.entryUnit === "player" || (squad && players.length === teamSize)) ? (
        <div className="mt-6">
          {problem ? (
            <div className="mb-3">
              <Notice tone="error">{problem.title}</Notice>
            </div>
          ) : null}
          <Button type="button" busy={busy} onClick={() => void submit()} data-testid="confirm-register">
            {d.slotsTaken >= d.maxSlots ? t("joinWaitlist") : d.entryFee.amount === 0 ? t("reg.confirmFree") : t("reg.confirmPay", { amount: takaOf(d.entryFee, locale) })}
          </Button>
          <p className="mt-2 text-xs text-muted">{t("reg.refundNote")}</p>
        </div>
      ) : null}
    </section>
  );
}

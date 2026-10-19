"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { problemOf } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { newKey } from "@/lib/bookings";
import { formatTaka } from "@/lib/payments";
import { safeNext, teams as teamsApi } from "@/lib/teams";
import { squadOk, tournaments } from "@/lib/tournaments";
import { Button, Notice } from "../ui";

/**
 * /tournaments/[slug]/register (M14 §4.7): pick a team I captain or vice-captain in this sport, pick
 * the squad from its members (NID ticks shown), accept the rules, then pay the entry fee into escrow
 * (or join the reserve list when the tournament is full). Entering needs a verified NID (M14 gate).
 */
export function RegisterTeam({ slug }: { slug: string }) {
  const t = useTranslations("tournaments");
  const locale = useLocale();
  const router = useRouter();
  const { status } = useAuth();
  const hub = useQuery({ queryKey: ["tournament", slug], queryFn: () => tournaments.hub(slug), retry: false });
  const mine = useQuery({ queryKey: ["my-teams"], queryFn: teamsApi.mine, enabled: status === "signed_in" });
  const [teamId, setTeamId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [rules, setRules] = useState(false);
  const [key, setKey] = useState(newKey);
  const team = useQuery({ queryKey: ["team", teamId], queryFn: () => teamsApi.get(teamId!), enabled: Boolean(teamId) });
  const mineHere = useMemo(() => (mine.data?.items ?? []).filter((x) => x.status === "active" && x.sport?.key === hub.data?.sport.key && ["captain", "vice_captain"].includes(x.myRole ?? "")), [mine.data, hub.data]);
  const squad = picked ?? [];
  const submit = useMutation({
    mutationFn: () => tournaments.register(hub.data!.id, { teamId: teamId!, rosterUserIds: squad }, key),
    onSuccess: (r) => {
      if (r.payment) window.location.assign(r.payment.payUrl);
      else router.push("/me/events");
    },
    onError: () => setKey(newKey()),
  });

  if (status === "signed_out")
    return (
      <section className="mx-auto max-w-[640px] px-5 py-16">
        <p>{t("signInToRegister")}</p>
        <Link href={`/sign-in?next=${encodeURIComponent(safeNext(`/events/${slug}/register`))}`} className="mt-4 inline-flex min-h-12 items-center bg-brand px-5 font-bold text-white">
          {t("signIn")}
        </Link>
      </section>
    );
  if (hub.isPending || mine.isPending) return <div className="mx-auto mt-10 h-96 max-w-[760px] animate-pulse bg-surface-2" />;
  if (hub.isError || !hub.data) return <p className="mx-auto max-w-[760px] px-5 py-16">{t("notFound")}</p>;
  const h = hub.data;
  if (h.window !== "open")
    return (
      <section className="mx-auto max-w-[640px] px-5 py-16">
        <h1 className="text-2xl font-extrabold">{h.name}</h1>
        <p className="mt-2">{t(h.window === "not_yet" ? "notOpenYet" : "closed")}</p>
      </section>
    );
  const p = problemOf(submit.error);
  const error = p ? (t.has(`errors.${p.code}`) ? t(`errors.${p.code}`) : (p.title ?? t("failed"))) : null;
  const full = h.approved >= h.maxTeams;

  return (
    <section className="mx-auto max-w-[760px] px-5 py-10" data-testid="register-team">
      <Link href={`/events/${h.slug}`} className="text-sm font-semibold text-brand underline">
        ← {h.name}
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold">{t("registerTeam")}</h1>
      <p className="mt-1 text-muted">{t("registerLead", { min: h.squadMin, max: h.squadMax })}</p>

      <h2 className="mt-8 text-lg font-extrabold">{t("step.team")}</h2>
      {mineHere.length ? (
        <ul className="mt-2 flex flex-col gap-2">
          {mineHere.map((x) => (
            <li key={x.id}>
              <label className={`flex min-h-12 cursor-pointer items-center gap-3 border-2 px-3 ${teamId === x.id ? "border-brand" : "border-line"}`}>
                <input type="radio" name="team" className="size-5" checked={teamId === x.id} onChange={() => (setTeamId(x.id), setPicked(null))} data-testid="pick-team" />
                <span className="font-bold">{x.name}</span>
                <span className="text-sm text-muted">{t(`role.${x.myRole}`)}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-2 border-2 border-dashed border-line p-4">
          <p>{t("noTeamOfSport", { sport: locale === "bn" ? h.sport.nameBn : h.sport.nameEn })}</p>
          <Link href="/me/teams" className="mt-2 inline-block font-semibold text-brand underline">
            {t("createTeam")}
          </Link>
        </div>
      )}

      {teamId && team.data ? (
        <>
          <h2 className="mt-8 text-lg font-extrabold">{t("step.squad", { n: squad.length })}</h2>
          <ul className="mt-2 divide-y-2 divide-line border-y-2 border-line">
            {team.data.members.map((m) => {
              const on = (picked ?? []).includes(m.userId);
              return (
                <li key={m.userId}>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2">
                    <input type="checkbox" className="size-5" checked={on} onChange={() => setPicked(on ? squad.filter((x) => x !== m.userId) : [...squad, m.userId])} data-testid="pick-player" />
                    <span className="min-w-0 flex-1 font-semibold">{m.displayName}</span>
                    <span className={`border-2 px-2 py-0.5 text-xs font-bold ${m.nidVerified ? "border-brand text-brand" : "border-line text-muted"}`}>{m.nidVerified ? t("nid") : t("noNid")}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-sm text-muted">{t("squadHint")}</p>

          <label className="mt-6 flex min-h-12 items-start gap-3">
            <input type="checkbox" className="mt-1 size-5" checked={rules} onChange={(e) => setRules(e.target.checked)} data-testid="accept-rules" />
            <span>{t("acceptRules")}</span>
          </label>
          {full ? <Notice>{t("fullReserve")}</Notice> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
          <div className="mt-4">
            <Button type="button" busy={submit.isPending} disabled={!rules || !squadOk(squad.length, h.squadMin, h.squadMax)} onClick={() => submit.mutate()} data-testid="register-submit">
              {full ? t("joinReserve") : h.entryFeePoisha ? t("payEntry", { fee: formatTaka(h.entryFeePoisha, locale) }) : t("enterFree")}
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}

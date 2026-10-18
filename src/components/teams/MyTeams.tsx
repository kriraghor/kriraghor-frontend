"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { api, problemOf } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { teams, teamSports } from "@/lib/teams";
import { MePanel } from "../MePanel";
import { Button, Field, Notice } from "../ui";
import { AddPhone } from "./AddPhone";

/** /me/teams (M16 §16): invites waiting for me, my teams, and create a team (a verified phone is needed). */
export function MyTeams() {
  const t = useTranslations("teams");
  const locale = useLocale();
  const { status } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const on = status === "signed_in";
  const me = useQuery({ queryKey: ["me"], enabled: on, queryFn: async () => ((await api().GET("/me")).data ?? null) });
  const list = useQuery({ queryKey: ["my-teams"], enabled: on, queryFn: teams.mine });
  const invites = useQuery({ queryKey: ["my-team-invites"], enabled: on, queryFn: teams.myInvites });
  const sports = useQuery({ queryKey: ["catalog-sports"], queryFn: teams.sports, staleTime: 3600_000 });
  const [form, setForm] = useState({ sportKey: "football", name: "", shortCode: "" });
  const create = useMutation({
    mutationFn: () => teams.create({ sportKey: form.sportKey, name: form.name, ...(form.shortCode ? { shortCode: form.shortCode } : {}) }),
    onSuccess: (team) => {
      qc.invalidateQueries({ queryKey: ["my-teams"] });
      router.push(`/me/teams/${team.id}`);
    },
  });
  const answer = useMutation({
    mutationFn: async ({ id, yes }: { id: string; yes: boolean }): Promise<{ teamId?: string }> => (yes ? teams.accept(id) : (await teams.decline(id), {})),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["my-team-invites"] });
      qc.invalidateQueries({ queryKey: ["my-teams"] });
      if (r.teamId) router.push(`/me/teams/${r.teamId}`);
    },
  });

  if (status === "signed_out") return <MePanel />;
  const name = (s: { nameEn: string; nameBn: string } | null | undefined) => (s ? (locale === "bn" ? s.nameBn : s.nameEn) : "–");
  const problem = problemOf(create.error);
  const answerProblem = problemOf(answer.error);
  const err = (p: ReturnType<typeof problemOf>) => (p ? (t.has(`errors.${p.code}`) ? t(`errors.${p.code}`) : (p.title ?? t("failed"))) : null);
  const pending = invites.data?.items.filter((i) => i.status === "pending" && !i.expired) ?? [];

  return (
    <section className="mx-auto max-w-[1100px] px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold">{t("myTeams")}</h1>
        <nav className="flex flex-wrap gap-x-5">
          <Link href="/me/player" className="inline-flex min-h-11 items-center font-semibold underline">
            {t("playerProfile")}
          </Link>
          <Link href="/me/eligibility" className="inline-flex min-h-11 items-center font-semibold underline">
            {t("eligibility")}
          </Link>
        </nav>
      </div>

      {pending.length ? (
        <div className="mt-6 border-2 border-brand bg-surface p-4" data-testid="team-invites">
          <h2 className="text-lg font-extrabold">{t("invitesForYou")}</h2>
          <ul className="mt-2 divide-y-2 divide-line">
            {pending.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 py-3" data-testid="team-invite">
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{i.team?.name ?? "–"}</span>
                  <span className="block text-sm text-muted">
                    {name(i.team?.sport)} · {t("invitedBy", { name: i.invitedBy ?? "–" })}
                  </span>
                </span>
                <Button type="button" busy={answer.isPending} onClick={() => answer.mutate({ id: i.id, yes: true })} data-testid="accept-invite">
                  {t("accept")}
                </Button>
                <button type="button" className="min-h-12 border-2 border-line px-4 font-bold hover:border-danger" onClick={() => answer.mutate({ id: i.id, yes: false })}>
                  {t("decline")}
                </button>
              </li>
            ))}
          </ul>
          {answerProblem ? <Notice tone="error">{err(answerProblem)}</Notice> : null}
        </div>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          {list.isPending ? (
            <div className="h-40 animate-pulse bg-surface-2" />
          ) : list.isError ? (
            <Notice tone="error">{t("failed")}</Notice>
          ) : !list.data.items.length ? (
            <p className="border-2 border-dashed border-line p-8 text-center font-semibold" data-testid="my-teams-empty">
              {t("noTeams")}
            </p>
          ) : (
            <ul className="divide-y-2 divide-line border-y-2 border-line" data-testid="my-teams">
              {list.data.items.map((team) => (
                <li key={team.id}>
                  <Link href={`/me/teams/${team.id}`} className="flex items-center gap-3 py-3 hover:bg-surface-2" data-testid="my-team">
                    {team.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={team.logoUrl} alt="" className="size-12 border-2 border-line object-cover" />
                    ) : (
                      <span className="grid size-12 place-items-center border-2 border-line font-extrabold" aria-hidden>
                        {team.shortCode ?? team.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{team.name}</span>
                      <span className="block text-sm text-muted">
                        {name(team.sport)} · {t("membersCount", { n: team.members ?? 0 })}
                      </span>
                    </span>
                    {team.myRole ? <span className="border-2 border-line px-2 py-0.5 text-sm font-bold">{t(`role.${team.myRole}`)}</span> : null}
                    {team.status === "archived" ? <span className="border-2 border-line px-2 py-0.5 text-sm font-bold text-muted">{t("archived")}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside>
          {me.data && !me.data.phoneVerified ? (
            <AddPhone />
          ) : (
            <form
              className="flex flex-col gap-3 border-2 border-line bg-surface p-4"
              data-testid="create-team"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <h2 className="text-lg font-extrabold">{t("createTeam")}</h2>
              <div className="flex flex-col gap-1">
                <label htmlFor="team-sport" className="text-sm font-semibold text-muted">
                  {t("sport")}
                </label>
                <select id="team-sport" className="min-h-12 border-2 border-line bg-surface px-3" value={form.sportKey} onChange={(e) => setForm({ ...form, sportKey: e.target.value })}>
                  {teamSports(sports.data ?? []).map((s) => (
                    <option key={s.key} value={s.key}>
                      {name(s)}
                    </option>
                  ))}
                </select>
              </div>
              <Field id="team-name" label={t("teamName")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={40} hint={t("teamNameHint")} />
              <Field id="team-short" label={t("shortCode")} value={form.shortCode} onChange={(e) => setForm({ ...form, shortCode: e.target.value.toUpperCase() })} maxLength={4} hint={t("shortCodeHint")} />
              {problem ? <Notice tone="error">{err(problem)}</Notice> : null}
              <Button type="submit" busy={create.isPending}>
                {t("create")}
              </Button>
            </form>
          )}
        </aside>
      </div>
    </section>
  );
}

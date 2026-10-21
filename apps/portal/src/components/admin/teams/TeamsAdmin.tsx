"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { teamsAdmin, type Gender, type StaffUser } from "@/lib/admin/teams";
import { problemOf, type Problem } from "@kriraghor/api-client";
import { Notice } from "@kriraghor/ui/primitives";
import { Chip, inputCls } from "../finance/shared";
import { formatDhaka, useAdminMe } from "../useAdminMe";

/**
 * /admin/teams (M16 step 1, manage_users): find teams, open one (members with the NID ✓ only, pending
 * invites with masked numbers), archive with a reason. A second tab corrects a member's
 * self-declared gender with a reason; it is audited and never shown outside staff desks.
 */
export function TeamsAdmin() {
  const t = useTranslations("teamsAdmin");
  const [tab, setTab] = useState<"teams" | "gender">("teams");
  const { me } = useAdminMe();
  const allowed = Boolean(me && (me.isMaster || me.permissions.includes("manage_users" as never)));
  return (
    <>
      <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-8">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t("intro")}</p>
        {me && !allowed ? (
          <div className="mt-6">
            <Notice tone="error">{t("needPermission")}</Notice>
          </div>
        ) : (
          <>
            <div className="mt-6 flex gap-2" role="tablist">
              {(["teams", "gender"] as const).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-11 border-2 px-4 font-bold ${tab === k ? "border-brand bg-brand text-white" : "border-line"}`} data-testid={`teams-tab-${k}`}>
                  {t(`tab.${k}`)}
                </button>
              ))}
            </div>
            {tab === "teams" ? <Teams /> : <GenderFix />}
          </>
        )}
      </div>
    </>
  );
}

function Teams() {
  const t = useTranslations("teamsAdmin");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready } = useAdminMe();
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "active" | "archived">("");
  const [open, setOpen] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const list = useQuery({ queryKey: ["admin-teams", search, status], queryFn: () => teamsAdmin.list({ q: search || undefined, status: status || undefined }), enabled: ready });
  const team = useQuery({ queryKey: ["admin-team", open], queryFn: () => teamsAdmin.get(open!), enabled: ready && Boolean(open) });
  const sport = (s: { nameEn: string; nameBn: string } | null) => (s ? (locale === "bn" ? s.nameBn : s.nameEn) : "–");

  async function archive() {
    if (!open) return;
    setProblem(null);
    if (reason.trim().length < 5) return setProblem({ code: "VALIDATION_FAILED", title: t("reasonNeeded"), status: 422 });
    try {
      await teamsAdmin.archive(open, reason.trim());
      setArchiving(false);
      setReason("");
      await Promise.all([qc.invalidateQueries({ queryKey: ["admin-teams"] }), qc.invalidateQueries({ queryKey: ["admin-team", open] })]);
    } catch (err) {
      setProblem(problemOf(err));
    }
  }

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1fr]">
      <div>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(text.trim());
          }}
        >
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
            {t("name")}
            <input value={text} onChange={(e) => setText(e.target.value)} className={inputCls} data-testid="teams-search" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
            {t("status")}
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputCls}>
              <option value="">{t("all")}</option>
              <option value="active">{t("teamStatus.active")}</option>
              <option value="archived">{t("teamStatus.archived")}</option>
            </select>
          </label>
          <button type="submit" className="min-h-11 border-2 border-brand bg-brand px-4 font-bold text-white">
            {t("find")}
          </button>
        </form>
        {list.isError ? (
          <div className="mt-4">
            <Notice tone="error">{problemOf(list.error)?.title ?? t("failed")}</Notice>
          </div>
        ) : null}
        <ul className="mt-6 flex flex-col gap-2" data-testid="admin-teams">
          {list.isPending ? <li className="h-32 animate-pulse bg-surface-2" /> : null}
          {list.data && !list.data.items.length ? <li className="text-muted">{t("none")}</li> : null}
          {(list.data?.items ?? []).map((x) => (
            <li key={x.id}>
              <button type="button" onClick={() => (setOpen(x.id), setArchiving(false), setProblem(null))} aria-pressed={open === x.id} className={`flex w-full flex-wrap items-center gap-3 border-2 p-3 text-left ${open === x.id ? "border-brand" : "border-line hover:border-brand"}`}>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{x.name}</span>
                  <span className="block text-sm text-muted">
                    {sport(x.sport)}
                    {x.shortCode ? ` · ${x.shortCode}` : ""} · {formatDhaka(x.createdAt, locale)}
                  </span>
                </span>
                <Chip tone={x.status === "active" ? "ok" : "muted"}>{t(`teamStatus.${x.status}`)}</Chip>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        {!open ? (
          <p className="border-2 border-dashed border-line p-8 text-center text-muted">{t("pick")}</p>
        ) : team.isPending ? (
          <div className="h-64 animate-pulse bg-surface-2" />
        ) : team.isError || !team.data ? (
          <Notice tone="error">{problemOf(team.error)?.title ?? t("failed")}</Notice>
        ) : (
          <div className="border-2 border-line p-4" data-testid="admin-team">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="min-w-0 flex-1 text-xl font-extrabold">{team.data.name}</h2>
              <Chip tone={team.data.status === "active" ? "ok" : "muted"}>{t(`teamStatus.${team.data.status}`)}</Chip>
            </div>
            <p className="text-sm text-muted">{sport(team.data.sport)}</p>
            {team.data.archiveReason ? <p className="mt-2 border-l-4 border-line pl-3 text-sm">{t("archivedFor", { reason: team.data.archiveReason })}</p> : null}
            <h3 className="mt-4 font-bold">{t("members", { n: team.data.members.length })}</h3>
            <ul className="mt-2 divide-y divide-line">
              {team.data.members.map((m) => (
                <li key={m.userId} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-1 font-semibold">{m.displayName}</span>
                  <span className="text-muted">{t(`role.${m.role}`)}</span>
                  <Chip tone={m.nidVerified ? "ok" : "muted"}>{m.nidVerified ? t("nidVerified") : t("nidNot")}</Chip>
                </li>
              ))}
            </ul>
            {team.data.invites.length ? (
              <>
                <h3 className="mt-4 font-bold">{t("invites")}</h3>
                <ul className="mt-2 divide-y divide-line">
                  {team.data.invites.map((i) => (
                    <li key={i.id} className="flex flex-wrap gap-2 py-2 text-sm">
                      <span className="min-w-0 flex-1 font-mono">{i.phoneMasked}</span>
                      <span className="text-muted">{t("until", { date: formatDhaka(i.expiresAt, locale) })}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {team.data.status === "active" ? (
              archiving ? (
                <form
                  className="mt-4 flex flex-col gap-3 border-2 border-danger p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void archive();
                  }}
                >
                  <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
                    {t("reason")}
                    <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} minLength={5} maxLength={255} required data-testid="team-archive-reason" />
                  </label>
                  {problem ? <Notice tone="error">{problem.title}</Notice> : null}
                  <div className="flex gap-3">
                    <button type="submit" className="min-h-11 bg-danger px-4 font-bold text-white" data-testid="team-archive-confirm">
                      {t("archive")}
                    </button>
                    <button type="button" className="min-h-11 px-3 font-semibold underline" onClick={() => setArchiving(false)}>
                      {t("cancel")}
                    </button>
                  </div>
                </form>
              ) : (
                <button type="button" onClick={() => setArchiving(true)} className="mt-4 min-h-11 border-2 border-danger px-3 text-sm font-bold text-danger" data-testid="team-archive">
                  {t("archive")}
                </button>
              )
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function GenderFix() {
  const t = useTranslations("teamsAdmin");
  const [text, setText] = useState("");
  const [found, setFound] = useState<StaffUser[] | null>(null);
  const [user, setUser] = useState<StaffUser | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [done, setDone] = useState(false);

  async function find() {
    setProblem(null);
    setUser(null);
    try {
      setFound((await teamsAdmin.findUser(text.trim())).data);
    } catch (err) {
      setProblem(problemOf(err));
    }
  }
  async function save() {
    if (!user || !gender) return;
    setProblem(null);
    if (reason.trim().length < 5) return setProblem({ code: "VALIDATION_FAILED", title: t("reasonNeeded"), status: 422 });
    try {
      setUser(await teamsAdmin.correctGender(user.id, gender, reason.trim()));
      setReason("");
      setDone(true);
    } catch (err) {
      setProblem(problemOf(err));
    }
  }

  return (
    <div className="mt-6 max-w-2xl">
      <p className="text-muted">{t("genderIntro")}</p>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void find();
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
          {t("findMember")}
          <input value={text} onChange={(e) => setText(e.target.value)} className={inputCls} minLength={3} required />
        </label>
        <button type="submit" className="min-h-11 border-2 border-brand bg-brand px-4 font-bold text-white">
          {t("find")}
        </button>
      </form>
      {found && !found.length ? <p className="mt-4 text-muted">{t("noMember")}</p> : null}
      {found?.length && !user ? (
        <ul className="mt-4 flex flex-col gap-2">
          {found.map((u) => (
            <li key={u.id}>
              <button type="button" onClick={() => (setUser(u), setGender(null), setDone(false))} className="flex w-full flex-wrap gap-3 border-2 border-line p-3 text-left hover:border-brand">
                <span className="min-w-0 flex-1 font-bold">{u.displayName}</span>
                <span className="text-sm text-muted">{u.phone ?? u.email ?? "–"}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {user ? (
        <form
          className="mt-4 flex flex-col gap-3 border-2 border-line p-4"
          data-testid="gender-fix"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <p className="font-bold">{user.displayName}</p>
          <p className="text-sm">
            {t("current", { gender: user.gender ? t(`genders.${user.gender}`) : t("notRecorded"), source: user.genderSource ? t(`source.${user.genderSource}`) : "–" })}
          </p>
          <fieldset className="flex flex-wrap gap-x-6">
            <legend className="text-sm font-semibold text-muted">{t("correctTo")}</legend>
            {(["male", "female", "third"] as const).map((g) => (
              <label key={g} className="flex min-h-11 items-center gap-2">
                <input type="radio" name="gender" className="size-5" checked={gender === g} onChange={() => setGender(g)} />
                {t(`genders.${g}`)}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
            {t("reason")}
            <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} minLength={5} maxLength={255} required />
          </label>
          {problem ? <Notice tone="error">{problem.title}</Notice> : null}
          {done ? <Notice>{t("corrected")}</Notice> : null}
          <div className="flex gap-3">
            <button type="submit" disabled={!gender} className="min-h-11 border-2 border-brand bg-brand px-4 font-bold text-white disabled:opacity-50">
              {t("save")}
            </button>
            <button type="button" className="min-h-11 px-3 font-semibold underline" onClick={() => setUser(null)}>
              {t("cancel")}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

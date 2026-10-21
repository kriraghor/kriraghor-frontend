"use client";

import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { problemOf, type Problem } from "@kriraghor/api-client";
import { Badge, Button, Card, DataTable, DetailLayout, Field, FilterBar, Notice, PageTitle, Skeleton, Tabs, type Column } from "@kriraghor/ui/kit";
import { teamsAdmin, type Gender, type StaffUser } from "@/lib/admin/teams";
import { useUrlFilters } from "@/lib/use-url-filters";
import { formatDhaka, useAdminMe } from "../useAdminMe";

type Row = Awaited<ReturnType<typeof teamsAdmin.list>>["items"][number];
const TABS = ["teams", "gender"] as const;
const STATUSES = ["active", "archived"] as const;

/**
 * /admin/teams (M16 step 1, manage_users): find teams, open one (members with the NID check only,
 * pending invites with masked numbers), archive with a reason. A second tab corrects a member's
 * self-declared gender with a reason; it is audited and never shown outside staff desks.
 */
export function TeamsAdmin() {
  // The tab, the filters and the open team live in the URL (useSearchParams), so the desk renders inside Suspense.
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-10 h-64 max-w-[1320px]" />}>
      <Desk />
    </Suspense>
  );
}

function Desk() {
  const t = useTranslations("teamsAdmin");
  const { me } = useAdminMe();
  const { values, set } = useUrlFilters({ tab: { default: "teams", allowed: TABS } });
  const allowed = Boolean(me && (me.isMaster || me.permissions.includes("manage_users" as never)));
  return (
    <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
      <PageTitle title={t("title")} description={t("intro")} />
      {me && !allowed ? (
        <Notice tone="error" className="mt-6 max-w-3xl">
          {t("needPermission")}
        </Notice>
      ) : (
        <Tabs
          className="mt-6"
          label={t("title")}
          value={values.tab}
          onValueChange={(v) => set({ tab: v, q: null, status: null, id: null })}
          items={TABS.map((k) => ({ value: k, label: t(`tab.${k}`), testId: `teams-tab-${k}`, content: k === "teams" ? <Teams /> : <GenderFix /> }))}
        />
      )}
    </div>
  );
}

function Teams() {
  const t = useTranslations("teamsAdmin");
  const locale = useLocale();
  const { ready } = useAdminMe();
  const { values, set, clear, params } = useUrlFilters({ q: { default: "" }, status: { default: "", allowed: ["", ...STATUSES] } });
  const search = values.q;
  const status = values.status as (typeof STATUSES)[number] | "";
  const open = params.get("id");
  const list = useQuery({ queryKey: ["admin-teams", search, status], queryFn: () => teamsAdmin.list({ q: search || undefined, status: status || undefined }), enabled: ready });
  const sport = (s: { nameEn: string; nameBn: string } | null) => (s ? (locale === "bn" ? s.nameBn : s.nameEn) : "–");
  const openName = list.data?.items.find((x) => x.id === open)?.name;

  const columns: Column<Row>[] = [
    {
      id: "name",
      header: t("name"),
      primary: true,
      sort: (x) => x.name,
      cell: (x) => (
        <>
          <span className="block font-semibold">{x.name}</span>
          <span className="block text-xs font-normal text-muted">
            {sport(x.sport)}
            {x.shortCode ? ` · ${x.shortCode}` : ""} · {formatDhaka(x.createdAt, locale)}
          </span>
        </>
      ),
    },
    { id: "status", header: t("status"), sort: (x) => x.status, cell: (x) => <Badge tone={x.status === "active" ? "brand" : "neutral"}>{t(`teamStatus.${x.status}`)}</Badge> },
  ];

  return (
    <DetailLayout open={Boolean(open)} onClose={() => set({ id: null })} title={openName ?? t("title")} pane={open ? <TeamPane key={open} id={open} /> : null} testId="admin-team">
      <div className="flex flex-col gap-4">
        <FilterBar
          search={{ value: search, onChange: (v) => set({ q: v }), label: t("name"), testId: "teams-search" }}
          selects={[{ id: "status", label: t("status"), value: status, onChange: (v) => set({ status: v }), anyLabel: t("all"), options: STATUSES.map((s) => ({ value: s, label: t(`teamStatus.${s}`) })) }]}
          onClear={clear}
        />
        <DataTable
          label={t("tab.teams")}
          testId="admin-teams"
          columns={columns}
          rows={list.data?.items}
          rowId={(x) => x.id}
          loading={list.isPending}
          error={list.error}
          onRetry={() => void list.refetch()}
          empty={{ title: t("none") }}
          onRowClick={(x) => set({ id: x.id })}
          selectedId={open}
        />
      </div>
    </DetailLayout>
  );
}

function TeamPane({ id }: { id: string }) {
  const t = useTranslations("teamsAdmin");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready } = useAdminMe();
  const [reason, setReason] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const team = useQuery({ queryKey: ["admin-team", id], queryFn: () => teamsAdmin.get(id), enabled: ready });
  const sport = (s: { nameEn: string; nameBn: string } | null) => (s ? (locale === "bn" ? s.nameBn : s.nameEn) : "–");

  async function archive() {
    setProblem(null);
    if (reason.trim().length < 5) return setProblem({ code: "VALIDATION_FAILED", title: t("reasonNeeded"), status: 422 });
    setBusy(true);
    try {
      await teamsAdmin.archive(id, reason.trim());
      setArchiving(false);
      setReason("");
      await Promise.all([qc.invalidateQueries({ queryKey: ["admin-teams"] }), qc.invalidateQueries({ queryKey: ["admin-team", id] })]);
    } catch (err) {
      setProblem(problemOf(err));
    } finally {
      setBusy(false);
    }
  }

  if (team.isError) return <Notice tone="error">{problemOf(team.error)?.title ?? t("failed")}</Notice>;
  if (!team.data) return <Skeleton className="h-64" />;
  const d = team.data;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={d.status === "active" ? "brand" : "neutral"}>{t(`teamStatus.${d.status}`)}</Badge>
        <span className="text-sm text-muted">{sport(d.sport)}</span>
      </div>
      {d.archiveReason ? <Notice>{t("archivedFor", { reason: d.archiveReason })}</Notice> : null}
      <section>
        <h3 className="font-semibold">{t("members", { n: d.members.length })}</h3>
        <ul className="mt-2 divide-y divide-line rounded-card border border-line">
          {d.members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 font-semibold">{m.displayName}</span>
              <span className="text-muted">{t(`role.${m.role}`)}</span>
              <Badge tone={m.nidVerified ? "brand" : "neutral"}>{m.nidVerified ? t("nidVerified") : t("nidNot")}</Badge>
            </li>
          ))}
        </ul>
      </section>
      {d.invites.length ? (
        <section>
          <h3 className="font-semibold">{t("invites")}</h3>
          <ul className="mt-2 divide-y divide-line rounded-card border border-line">
            {d.invites.map((i) => (
              <li key={i.id} className="flex flex-wrap gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 font-mono">{i.phoneMasked}</span>
                <span className="text-muted">{t("until", { date: formatDhaka(i.expiresAt, locale) })}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {d.status === "active" ? (
        archiving ? (
          <form
            className="flex flex-col gap-3 rounded-card border border-danger/40 bg-danger-soft/30 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void archive();
            }}
          >
            <Field id="team-archive-reason" label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} maxLength={255} required data-testid="team-archive-reason" />
            {problem ? <Notice tone="error">{problem.title}</Notice> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="danger" busy={busy} data-testid="team-archive-confirm">
                {t("archive")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setArchiving(false)}>
                {t("cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <div>
            <Button type="button" variant="secondary" className="text-danger" onClick={() => setArchiving(true)} data-testid="team-archive">
              {t("archive")}
            </Button>
          </div>
        )
      ) : null}
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
    <div className="max-w-2xl">
      <p className="text-muted">{t("genderIntro")}</p>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void find();
        }}
      >
        <Field id="gender-find" label={t("findMember")} value={text} onChange={(e) => setText(e.target.value)} minLength={3} required className="w-full sm:w-80" />
        <Button type="submit" icon={<MagnifyingGlass size={18} aria-hidden />}>
          {t("find")}
        </Button>
      </form>
      {problem && !user ? (
        <Notice tone="error" className="mt-4">
          {problem.title}
        </Notice>
      ) : null}
      {found && !found.length ? <p className="mt-4 text-muted">{t("noMember")}</p> : null}
      {found?.length && !user ? (
        <ul className="mt-4 divide-y divide-line rounded-card border border-line bg-surface">
          {found.map((u) => (
            <li key={u.id}>
              <button type="button" onClick={() => (setUser(u), setGender(null), setDone(false))} className="flex min-h-12 w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                <span className="min-w-0 flex-1 font-semibold">{u.displayName}</span>
                <span className="text-sm text-muted">{u.phone ?? u.email ?? "–"}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {user ? (
        <Card className="mt-4">
          <form
            className="flex flex-col gap-4"
            data-testid="gender-fix"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div>
              <p className="font-semibold">{user.displayName}</p>
              <p className="text-sm text-muted">
                {t("current", { gender: user.gender ? t(`genders.${user.gender}`) : t("notRecorded"), source: user.genderSource ? t(`source.${user.genderSource}`) : "–" })}
              </p>
            </div>
            <fieldset className="flex flex-wrap gap-x-6">
              <legend className="mb-1 text-sm font-semibold">{t("correctTo")}</legend>
              {(["male", "female", "third"] as const).map((g) => (
                <label key={g} className="flex min-h-11 items-center gap-2">
                  <input type="radio" name="gender" className="size-5 accent-[var(--kg-brand)]" checked={gender === g} onChange={() => setGender(g)} />
                  {t(`genders.${g}`)}
                </label>
              ))}
            </fieldset>
            <Field id="gender-reason" label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} maxLength={255} required />
            {problem ? <Notice tone="error">{problem.title}</Notice> : null}
            {done ? <Notice tone="success">{t("corrected")}</Notice> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!gender}>
                {t("save")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setUser(null)}>
                {t("cancel")}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}

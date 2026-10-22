"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@kriraghor/ui/i18n/navigation";
import { ArrowLeft, ArrowsClockwise, CalendarX, DotsThree, DownloadSimple, Flag, PauseCircle, UsersThree } from "@phosphor-icons/react";
import { Button, Dialog, Field as KitField, Menu, ReasonDialog, Select, Textarea, type MenuItem } from "@kriraghor/ui/kit";
import { problemOf } from "@kriraghor/api-client";
import { publicEnv } from "@kriraghor/session/env";
import { useAuth } from "@kriraghor/ui/auth";
import { formatTaka } from "@/lib/admin/finance";
import { csvErrorKey } from "@/lib/dashboard";
import { canExportRegistrations, fromLocalInput, matchActions, oversToBalls, presetValues, resultBody, sportsConsole as api, toLocalInput, type Match, type MatchAction, type RuleField, type Seeding, type Tournament } from "@/lib/vendor/tournaments";
import { MePanel } from "../../MePanel";
import { OrgMembers } from "../esports/OrganiserConsole";
import { Notice } from "@kriraghor/ui/primitives";
import { Chip, Field, inputCls } from "../../admin/finance/shared";
import { formatDhaka } from "../../admin/useAdminMe";

const btn = "min-h-11 border-2 px-4 text-sm font-bold disabled:opacity-50";
const primary = `${btn} border-brand bg-brand text-white`;
const TONE: Record<string, "ok" | "warn" | "bad" | "muted"> = {
  draft: "muted",
  pending_review: "warn",
  changes_requested: "bad",
  rejected: "bad",
  registration_open: "ok",
  registration_closed: "warn",
  live: "ok",
  completed: "muted",
  cancelled: "bad",
  pending_payment: "warn",
  pending_approval: "warn",
  reserve: "muted",
  offered: "warn",
  approved: "ok",
  lapsed: "muted",
  withdrawn: "muted",
  removed: "bad",
};
const dhakaDay = (ms: number) => new Date(ms + 6 * 3600000).toISOString().slice(0, 10);

/** A problem title, or the console's own words for codes it knows. */
function useErr() {
  const t = useTranslations("sportsConsole");
  return (e: unknown) => {
    const p = problemOf(e);
    if (!p) return null;
    return t.has(`errors.${p.code}`) ? t(`errors.${p.code}`) : (p.title ?? t("failed"));
  };
}

/** /vendor/tournaments: my verified sports organisations (one goes straight in). */
export function SportsHome() {
  const t = useTranslations("sportsConsole");
  const { status } = useAuth();
  const router = useRouter();
  const q = useQuery({ queryKey: ["my-orgs"], queryFn: () => api.mine(), enabled: status === "signed_in" });
  const usable = (q.data?.items ?? []).filter((o) => o.kind === "sports" && ["verified", "suspended"].includes(o.status));
  useEffect(() => {
    if (usable.length === 1) router.replace(`/vendor/events/${usable[0].id}`);
  }, [usable, router]);
  if (status !== "signed_in") return <MePanel signInHref="/vendor/sign-in" />;
  if (q.isPending) return <div className="mx-auto mt-10 h-40 max-w-3xl animate-pulse bg-surface-2" />;
  return (
    <section className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-3xl font-extrabold">{t("title")}</h1>
      {usable.length ? (
        <ul className="mt-6 flex flex-col gap-3">
          {usable.map((o) => (
            <li key={o.id}>
              <Link href={`/vendor/events/${o.id}`} className="flex items-center justify-between border-2 border-line p-4 font-bold hover:border-brand">
                {o.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 border-2 border-line p-5" data-testid="sports-apply-first">
          <p className="font-bold">{t("applyFirst")}</p>
          <p className="mt-1 text-sm text-muted">{t("applyHelp")}</p>
        </div>
      )}
    </section>
  );
}

/** /vendor/tournaments/[orgId]: the organisation's tournaments and a new one. */
export function SportsTournaments({ orgId }: { orgId: string }) {
  const t = useTranslations("sportsConsole");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["sports-tournaments", orgId], queryFn: () => api.list(orgId), retry: false });
  const [creating, setCreating] = useState(false);
  if (q.isError) return <p className="mx-auto max-w-3xl px-5 py-16">{t("notFound")}</p>;
  return (
    <section className="mx-auto max-w-[1200px] px-5 py-10">
      <SportsOrgHeader
        orgId={orgId}
        current="events"
        actions={
          <button type="button" className={primary} onClick={() => setCreating((x) => !x)} data-testid="new-tournament">
            {creating ? t("close") : t("new")}
          </button>
        }
      />
      {creating ? <NewTournament orgId={orgId} /> : null}
      <ul className="mt-6 flex flex-col gap-2" data-testid="sports-tournaments">
        {q.isPending ? <li className="h-24 animate-pulse bg-surface-2" /> : null}
        {q.data && !q.data.items.length ? <li className="border-2 border-dashed border-line p-6 text-muted">{t("none")}</li> : null}
        {(q.data?.items ?? []).map((x) => (
          <li key={x.id}>
            <Link href={`/vendor/events/${orgId}/e/${x.id}`} className="flex flex-wrap items-center gap-3 border-2 border-line p-3 hover:border-brand" data-testid="sports-tournament">
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{x.name}</span>
                <span className="block text-sm text-muted">
                  {locale === "bn" ? x.sport.nameBn : x.sport.nameEn} · {t(`format.${x.format}`)} · {x.approved}/{x.maxTeams}
                </span>
              </span>
              <Chip tone={TONE[x.status] ?? "muted"}>{t(`status.${x.status}`)}</Chip>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The sports organisation's frame: title, its name and the section links (events, members). Works
 * from /me/organisations, not the esports dashboard (OrgShell), so it fits organisations of kind sports.
 */
function SportsOrgHeader({ orgId, current, actions }: { orgId: string; current: "events" | "members"; actions?: ReactNode }) {
  const t = useTranslations("sportsConsole");
  const { status } = useAuth();
  const orgs = useQuery({ queryKey: ["my-orgs"], queryFn: () => api.mine(), enabled: status === "signed_in" });
  const org = orgs.data?.items.find((o) => o.id === orgId);
  const base = `/vendor/events/${orgId}`;
  const links = [
    { key: "events", href: base, icon: null },
    { key: "members", href: `${base}/members`, icon: <UsersThree size={18} aria-hidden /> },
  ] as const;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {org ? <p className="text-sm font-semibold text-brand-text">{org.name}</p> : null}
          <h1 className="text-3xl font-extrabold">{current === "members" ? t("membersTitle") : t("title")}</h1>
        </div>
        {actions}
      </div>
      <nav aria-label={org?.name ?? t("title")} className="mt-5 flex gap-1 border-b border-line" data-testid="sports-org-nav">
        {links.map((l) => (
          <Link
            key={l.key}
            href={l.href}
            aria-current={current === l.key ? "page" : undefined}
            className={`-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold ${current === l.key ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink"}`}
            data-testid={`sports-org-${l.key}`}
          >
            {l.icon}
            {t(`nav.${l.key}`)}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** /vendor/events/[orgId]/members: who can run this sports organisation (GET/POST /org/:orgId/members, remove). */
export function SportsMembers({ orgId }: { orgId: string }) {
  const t = useTranslations("sportsConsole");
  const { status } = useAuth();
  if (status === "signed_out") return <MePanel signInHref="/vendor/sign-in" />;
  return (
    <section className="mx-auto max-w-[1200px] px-5 py-10">
      <SportsOrgHeader orgId={orgId} current="members" />
      <p className="mt-6 max-w-2xl text-muted">{t("membersLead")}</p>
      <div className="mt-6">
        <OrgMembers orgId={orgId} />
      </div>
    </section>
  );
}

/** The wizard in one form (§4.2): sport and preset, basics, dates, venue. Rules are refined in the console. */
function NewTournament({ orgId }: { orgId: string }) {
  const t = useTranslations("sportsConsole");
  const locale = useLocale();
  const router = useRouter();
  const err = useErr();
  const sports = useQuery({ queryKey: ["catalog-sports"], queryFn: api.sports, staleTime: 3600_000 });
  const areas = useQuery({ queryKey: ["catalog-areas"], queryFn: api.areas, staleTime: 3600_000 });
  const teamSports = (sports.data?.items ?? []).filter((s) => ((s as { positions?: unknown[] }).positions ?? []).length > 0);
  const [f, setF] = useState(() => {
    const now = Date.now();
    return {
    sportKey: "football",
    presetKey: "",
    name: "",
    format: "league",
    minTeams: "4",
    maxTeams: "8",
    squadMin: "",
    squadMax: "",
    fee: "0",
    prize: "",
    opensAt: toLocalInput(new Date(now).toISOString()),
    closesAt: toLocalInput(new Date(now + 7 * 86400000).toISOString()),
    startDate: dhakaDay(now + 10 * 86400000),
    endDate: dhakaDay(now + 20 * 86400000),
    venueText: "",
    areaId: "",
    courts: "",
    groupCount: "2",
    qualifiers: "2",
    };
  });
  const rules = useQuery({ queryKey: ["sport-rules", f.sportKey], queryFn: () => api.rulesOf(f.sportKey), enabled: Boolean(f.sportKey) });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const create = useMutation({
    mutationFn: () =>
      api.create(orgId, {
        sportKey: f.sportKey,
        presetKey: f.presetKey || undefined,
        name: f.name,
        format: f.format,
        minTeams: Number(f.minTeams),
        maxTeams: Number(f.maxTeams),
        ...(f.squadMin ? { squadMin: Number(f.squadMin) } : {}),
        ...(f.squadMax ? { squadMax: Number(f.squadMax) } : {}),
        entryFeePoisha: Math.round(Number(f.fee || 0) * 100),
        ...(f.prize ? { prizePoolPoisha: Math.round(Number(f.prize) * 100) } : {}),
        registrationOpensAt: fromLocalInput(f.opensAt),
        registrationClosesAt: fromLocalInput(f.closesAt),
        startDate: f.startDate,
        endDate: f.endDate,
        ...(f.format === "groups_knockout" ? { formatConfig: { groupCount: Number(f.groupCount), qualifiersPerGroup: Number(f.qualifiers) } } : {}),
        venues: f.venueText && f.areaId ? [{ venueText: f.venueText, areaId: f.areaId, courts: f.courts.split(",").map((x) => x.trim()).filter(Boolean) }] : [],
      }),
    onSuccess: (x) => router.push(`/vendor/events/${orgId}/e/${x.id}`),
  });
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  return (
    <form
      className="mt-6 grid gap-4 border-2 border-line p-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
      data-testid="tournament-form"
    >
      <Field label={t("sport")}>
        <select className={inputCls} value={f.sportKey} onChange={(e) => setF({ ...f, sportKey: e.target.value, presetKey: "" })} data-testid="tf-sport">
          {teamSports.map((s) => (
            <option key={s.key} value={s.key}>
              {name(s)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("preset")}>
        <select className={inputCls} value={f.presetKey} onChange={set("presetKey")}>
          <option value="">{rules.data?.presets[0] ? (locale === "bn" ? rules.data.presets[0].bn : rules.data.presets[0].en) : "–"}</option>
          {(rules.data?.presets ?? []).slice(1).map((p) => (
            <option key={p.key} value={p.key}>
              {locale === "bn" ? p.bn : p.en}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("name")}>
        <input className={inputCls} value={f.name} onChange={set("name")} required minLength={3} maxLength={80} data-testid="tf-name" />
      </Field>
      <Field label={t("formatLabel")}>
        <select className={inputCls} value={f.format} onChange={set("format")} data-testid="tf-format">
          {["league", "double_league", "groups_knockout", "knockout"].map((x) => (
            <option key={x} value={x}>
              {t(`format.${x}`)}
            </option>
          ))}
        </select>
      </Field>
      {f.format === "groups_knockout" ? (
        <>
          <Field label={t("groupCount")}>
            <input className={inputCls} type="number" min={2} max={16} value={f.groupCount} onChange={set("groupCount")} />
          </Field>
          <Field label={t("qualifiers")}>
            <input className={inputCls} type="number" min={1} max={4} value={f.qualifiers} onChange={set("qualifiers")} />
          </Field>
        </>
      ) : null}
      <Field label={t("minTeams")}>
        <input className={inputCls} type="number" min={2} value={f.minTeams} onChange={set("minTeams")} data-testid="tf-min" />
      </Field>
      <Field label={t("maxTeams")}>
        <input className={inputCls} type="number" min={2} value={f.maxTeams} onChange={set("maxTeams")} data-testid="tf-max" />
      </Field>
      <Field label={t("squadMin")}>
        <input className={inputCls} type="number" min={1} max={30} value={f.squadMin} onChange={set("squadMin")} placeholder={t("fromRules")} data-testid="tf-squad-min" />
      </Field>
      <Field label={t("squadMax")}>
        <input className={inputCls} type="number" min={1} max={30} value={f.squadMax} onChange={set("squadMax")} placeholder={t("fromRules")} data-testid="tf-squad-max" />
      </Field>
      <Field label={t("feeTaka")}>
        <input className={inputCls} type="number" min={0} step={1} value={f.fee} onChange={set("fee")} data-testid="tf-fee" />
      </Field>
      <Field label={t("prizeTaka")}>
        <input className={inputCls} type="number" min={0} step={1} value={f.prize} onChange={set("prize")} />
      </Field>
      <Field label={t("opensAt")}>
        <input className={inputCls} type="datetime-local" value={f.opensAt} onChange={set("opensAt")} />
      </Field>
      <Field label={t("closesAt")}>
        <input className={inputCls} type="datetime-local" value={f.closesAt} onChange={set("closesAt")} data-testid="tf-closes" />
      </Field>
      <Field label={t("startDate")}>
        <input className={inputCls} type="date" value={f.startDate} onChange={set("startDate")} data-testid="tf-start" />
      </Field>
      <Field label={t("endDate")}>
        <input className={inputCls} type="date" value={f.endDate} onChange={set("endDate")} data-testid="tf-end" />
      </Field>
      <Field label={t("venue")}>
        <input className={inputCls} value={f.venueText} onChange={set("venueText")} maxLength={160} data-testid="tf-venue" />
      </Field>
      <Field label={t("area")}>
        <select className={inputCls} value={f.areaId} onChange={set("areaId")} data-testid="tf-area">
          <option value="">–</option>
          {(areas.data?.items ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {name(a)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("courts")}>
        <input className={inputCls} value={f.courts} onChange={set("courts")} placeholder={t("courtsHint")} />
      </Field>
      <div className="md:col-span-2">
        {create.error ? <Notice tone="error">{err(create.error)}</Notice> : null}
        <button type="submit" className={`${primary} mt-2`} disabled={create.isPending} data-testid="tf-create">
          {t("createDraft")}
        </button>
      </div>
    </form>
  );
}

const TABS = ["overview", "rules", "teams", "fixtures"] as const;
type Tab = (typeof TABS)[number];

/** /vendor/tournaments/[orgId]/t/[id]: the tournament console. */
export function TournamentConsole({ orgId, id }: { orgId: string; id: string }) {
  const t = useTranslations("sportsConsole");
  const [tab, setTab] = useState<Tab>("overview");
  const q = useQuery({ queryKey: ["sports-tournament", orgId, id], queryFn: () => api.get(orgId, id), retry: false });
  if (q.isPending) return <div className="mx-auto mt-10 h-96 max-w-[1200px] animate-pulse bg-surface-2" />;
  if (q.isError || !q.data) return <p className="mx-auto max-w-3xl px-5 py-16">{t("notFound")}</p>;
  const x = q.data;
  return (
    <section className="mx-auto max-w-[1200px] px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/vendor/events/${orgId}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-text hover:underline">
          <ArrowLeft size={16} aria-hidden />
          {t("title")}
        </Link>
        <Link href={`/vendor/events/${orgId}/members`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-text hover:underline" data-testid="console-members">
          <UsersThree size={18} aria-hidden />
          {t("nav.members")}
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 text-3xl font-extrabold" data-testid="console-name">
          {x.name}
        </h1>
        <span data-testid="console-status">
          <Chip tone={TONE[x.status] ?? "muted"}>{t(`status.${x.status}`)}</Chip>
        </span>
      </div>
      <div className="mt-4 flex gap-1 border-b-2 border-line" role="tablist">
        {TABS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-0.5 min-h-12 border-b-4 px-4 font-bold ${tab === k ? "border-brand" : "border-transparent text-muted hover:text-ink"}`} data-testid={`console-tab-${k}`}>
            {t(`tab.${k}`)}
          </button>
        ))}
      </div>
      {tab === "overview" ? <OverviewTab orgId={orgId} x={x} /> : null}
      {tab === "rules" ? <RulesTab orgId={orgId} x={x} /> : null}
      {tab === "teams" ? <TeamsTab orgId={orgId} x={x} /> : null}
      {tab === "fixtures" ? <FixturesTab orgId={orgId} x={x} /> : null}
    </section>
  );
}

function useRefresh(orgId: string, id: string) {
  const qc = useQueryClient();
  return () => {
    for (const k of [["sports-tournament", orgId, id], ["sports-overview", orgId, id], ["sports-registrations", orgId, id], ["sports-fixtures", orgId, id], ["sports-tournaments", orgId]]) qc.invalidateQueries({ queryKey: k });
  };
}

function OverviewTab({ orgId, x }: { orgId: string; x: Tournament }) {
  const t = useTranslations("sportsConsole");
  const locale = useLocale();
  const err = useErr();
  const refresh = useRefresh(orgId, x.id);
  const o = useQuery({ queryKey: ["sports-overview", orgId, x.id], queryFn: () => api.overview(orgId, x.id) });
  const [reason, setReason] = useState("");
  const [closesAt, setClosesAt] = useState(() => toLocalInput(new Date(Date.now() + 2 * 86400000).toISOString()));
  const act = useMutation({ mutationFn: async (fn: () => Promise<unknown>) => fn(), onSuccess: () => (setReason(""), refresh()) });
  const money = (p: number) => formatTaka(p, locale);
  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        {x.reviewReason ? (
          <Notice tone="error">
            {t("reviewReason")}: {x.reviewReason.text ?? x.reviewReason.code}
          </Notice>
        ) : null}
        {o.data ? (
          <>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4" data-testid="console-kpis">
              <div>
                <dt className="text-sm text-muted">{t("kpi.teams")}</dt>
                <dd className="text-2xl font-extrabold tabular-nums">
                  {o.data.kpis.approved}/{o.data.kpis.maxTeams}
                </dd>
                <dd className="text-xs text-muted">{t("kpi.waiting", { n: o.data.kpis.waiting, r: o.data.kpis.reserve })}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">{t("kpi.matches")}</dt>
                <dd className="text-2xl font-extrabold tabular-nums">
                  {o.data.kpis.completed}/{o.data.kpis.matches}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">{t("kpi.held")}</dt>
                <dd className="text-2xl font-extrabold tabular-nums" data-testid="kpi-held">
                  {money(o.data.money.held)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">{t("kpi.released")}</dt>
                <dd className="text-2xl font-extrabold tabular-nums" data-testid="kpi-released">
                  {money(o.data.money.released)}
                </dd>
                <dd className="text-xs text-muted">{t("kpi.fees", { amount: money(o.data.money.fees) })}</dd>
              </div>
            </dl>
            <h2 className="mt-8 text-lg font-extrabold">{t("checklist")}</h2>
            <ul className="mt-2 divide-y divide-line border-y-2 border-line" data-testid="console-checklist">
              {o.data.checklist.map((c) => (
                <li key={c.key} className="flex items-center gap-3 py-2">
                  <span className={c.done ? "text-brand" : "text-muted"}>{c.done ? "✓" : "○"}</span>
                  <span>{t(`check.${c.key}`)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="h-40 animate-pulse bg-surface-2" />
        )}
      </div>
      <aside className="flex flex-col gap-3">
        {act.error ? <Notice tone="error">{err(act.error)}</Notice> : null}
        {["draft", "changes_requested"].includes(x.status) ? (
          <button type="button" className={primary} disabled={act.isPending} onClick={() => act.mutate(() => api.submit(orgId, x.id))} data-testid="console-submit">
            {t("submit")}
          </button>
        ) : null}
        {x.status === "registration_open" ? (
          <button type="button" className={btn} disabled={act.isPending} onClick={() => act.mutate(() => api.close(orgId, x.id))} data-testid="console-close">
            {t("closeRegistration")}
          </button>
        ) : null}
        {x.status === "registration_closed" && x.matches === 0 ? (
          <div className="flex flex-col gap-2 border-2 border-line p-3">
            <label className="text-sm font-semibold text-muted" htmlFor="extend-at">
              {t("extendTo")}
            </label>
            <input id="extend-at" type="datetime-local" className={inputCls} value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
            <button type="button" className={btn} onClick={() => act.mutate(() => api.extend(orgId, x.id, fromLocalInput(closesAt) ?? ""))}>
              {t("extend")}
            </button>
          </div>
        ) : null}
        <div className="flex flex-col gap-2 border-2 border-line p-3">
          <label className="text-sm font-semibold text-muted" htmlFor="console-reason">
            {t("reason")}
          </label>
          <input id="console-reason" className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} />
          {x.rulesLockedAt && !["completed", "cancelled"].includes(x.status) ? (
            <button type="button" className={btn} disabled={reason.trim().length < 10} onClick={() => act.mutate(() => api.unlock(orgId, x.id, reason))}>
              {t("unlockRules")}
            </button>
          ) : null}
          {!["completed", "cancelled", "rejected"].includes(x.status) ? (
            <button type="button" className={`${btn} border-danger text-danger`} disabled={reason.trim().length < 5} onClick={() => act.mutate(() => api.cancel(orgId, x.id, reason))} data-testid="console-cancel">
              {t("cancelTournament")}
            </button>
          ) : null}
        </div>
        {x.rulesUnlockedUntil ? <p className="text-sm text-amber-700">{t("unlockedUntil", { at: formatDhaka(x.rulesUnlockedUntil, locale) })}</p> : null}
        <a href={`${publicEnv().WEB_URL}/tournaments/${x.slug}`} className="text-sm font-semibold text-brand underline">
          {t("publicPage")}
        </a>
      </aside>
    </div>
  );
}

function RuleInput({ f, value, onChange, disabled }: { f: RuleField; value: number | string | boolean; onChange: (v: number | string | boolean) => void; disabled: boolean }) {
  const locale = useLocale();
  const label = locale === "bn" ? f.bn : f.en;
  if (f.type === "bool")
    return (
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" className="size-5" checked={Boolean(value)} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
    );
  if (f.type === "enum")
    return (
      <Field label={label}>
        <select className={inputCls} value={String(value)} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          {(f.options ?? []).map((o) => (
            <option key={o.key} value={o.key}>
              {locale === "bn" ? o.bn : o.en}
            </option>
          ))}
        </select>
      </Field>
    );
  return (
    <Field label={`${label} (${f.min}–${f.max})`}>
      <input className={inputCls} type="number" min={f.min} max={f.max} value={Number(value)} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
    </Field>
  );
}

function RulesTab({ orgId, x }: { orgId: string; x: Tournament }) {
  const t = useTranslations("sportsConsole");
  const locale = useLocale();
  const err = useErr();
  const refresh = useRefresh(orgId, x.id);
  const schema = useQuery({ queryKey: ["sport-rules", x.sport.key], queryFn: () => api.rulesOf(x.sport.key) });
  const [values, setValues] = useState<Record<string, number | string | boolean>>(x.rules.values);
  const editable = ["draft", "changes_requested"].includes(x.status) || Boolean(x.rulesUnlockedUntil && new Date(x.rulesUnlockedUntil) > new Date());
  const save = useMutation({ mutationFn: (body: Record<string, unknown>) => api.update(orgId, x.id, body), onSuccess: refresh });
  if (!schema.data) return <div className="mt-6 h-40 animate-pulse bg-surface-2" />;
  const groups = [...new Set(schema.data.fields.map((f) => f.group))];
  return (
    <div className="mt-6">
      {!editable ? <Notice>{x.rulesLockedAt ? t("rulesLocked") : t("rulesFixed")}</Notice> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {schema.data.presets.map((p) => (
          <button key={p.key} type="button" disabled={!editable} className={`${btn} ${x.rules.presetKey === p.key ? "border-brand" : "border-line"}`} onClick={() => save.mutate({ presetKey: p.key })}>
            {locale === "bn" ? p.bn : p.en}
          </button>
        ))}
      </div>
      {groups.map((g) => (
        <fieldset key={g} className="mt-6 grid gap-3 border-2 border-line p-4 md:grid-cols-3">
          <legend className="px-1 font-extrabold">{t(`ruleGroup.${g}`)}</legend>
          {schema.data.fields
            .filter((f) => f.group === g)
            .map((f) => (
              <RuleInput key={f.key} f={f} value={values[f.key] ?? f.default} disabled={!editable} onChange={(v) => setValues({ ...values, [f.key]: v })} />
            ))}
        </fieldset>
      ))}
      <p className="mt-4 text-sm">
        <span className="font-semibold">{t("tiebreakers")}:</span> {x.rules.tiebreakers.join(" → ")}
      </p>
      <p className="mt-2 text-sm text-muted">{locale === "bn" ? x.rules.summaryBn : x.rules.summaryEn}</p>
      {save.error ? <Notice tone="error">{err(save.error)}</Notice> : null}
      {editable ? (
        <div className="mt-4 flex gap-3">
          <button type="button" className={primary} onClick={() => save.mutate({ rules: values })} data-testid="rules-save">
            {t("saveRules")}
          </button>
          <button type="button" className={btn} onClick={() => setValues(presetValues(schema.data, x.rules.presetKey === "custom" ? null : x.rules.presetKey))}>
            {t("reset")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TeamsTab({ orgId, x }: { orgId: string; x: Tournament }) {
  const t = useTranslations("sportsConsole");
  const locale = useLocale();
  const err = useErr();
  const refresh = useRefresh(orgId, x.id);
  const q = useQuery({ queryKey: ["sports-registrations", orgId, x.id], queryFn: () => api.registrations(orgId, x.id) });
  const [reason, setReason] = useState("");
  const act = useMutation({ mutationFn: async (fn: () => Promise<unknown>) => fn(), onSuccess: () => (setReason(""), refresh()) });
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-muted">{t("teamsLead", { min: x.squadMin })}</p>
        <RegistrationsExport orgId={orgId} x={x} />
      </div>
      <div className="mt-3 flex max-w-md flex-col gap-1">
        <label htmlFor="reg-reason" className="text-sm font-semibold text-muted">
          {t("decisionReason")}
        </label>
        <input id="reg-reason" className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} />
      </div>
      {act.error ? (
        <div className="mt-3">
          <Notice tone="error">{err(act.error)}</Notice>
        </div>
      ) : null}
      <ul className="mt-4 flex flex-col gap-2" data-testid="console-registrations">
        {q.isPending ? <li className="h-24 animate-pulse bg-surface-2" /> : null}
        {q.data && !q.data.items.length ? <li className="border-2 border-dashed border-line p-6 text-muted">{t("noRegistrations")}</li> : null}
        {(q.data?.items ?? []).map((r) => (
          <li key={r.id} className="border-2 border-line p-3" data-testid="console-registration">
            <div className="flex flex-wrap items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{r.team?.name ?? "–"}</span>
                <span className="block text-sm text-muted">
                  {r.roster ? t("squadLine", { total: r.roster.total, eligible: r.roster.eligible }) : ""}
                  {r.feeWaived ? ` · ${t("waived")}` : r.feePoisha ? ` · ${formatTaka(r.feePoisha, locale)}` : ""}
                  {r.reservePosition ? ` · ${t("reservePos", { n: r.reservePosition })}` : ""}
                  {r.refundedPoisha ? ` · ${t("refunded", { amount: formatTaka(r.refundedPoisha, locale) })}` : ""}
                </span>
              </span>
              <Chip tone={TONE[r.status] ?? "muted"}>{t(`reg.${r.status}`)}</Chip>
              {r.status === "pending_approval" ? (
                <button type="button" className={primary} disabled={act.isPending} onClick={() => act.mutate(() => api.approve(orgId, r.id))} data-testid="reg-approve">
                  {t("approve")}
                </button>
              ) : null}
              {["pending_approval", "pending_payment", "reserve", "offered"].includes(r.status) ? (
                <button type="button" className={`${btn} border-line`} disabled={act.isPending || reason.trim().length < 5} onClick={() => act.mutate(() => api.reject(orgId, r.id, reason))}>
                  {t("reject")}
                </button>
              ) : null}
              {["pending_payment", "offered"].includes(r.status) ? (
                <button type="button" className={`${btn} border-line`} disabled={act.isPending || reason.trim().length < 5} onClick={() => act.mutate(() => api.waive(orgId, r.id, reason))}>
                  {t("waive")}
                </button>
              ) : null}
              {r.status === "approved" ? (
                <button type="button" className={`${btn} border-danger text-danger`} disabled={act.isPending || reason.trim().length < 5} onClick={() => act.mutate(() => api.remove(orgId, r.id, reason))}>
                  {t("remove")}
                </button>
              ) : null}
            </div>
            {r.roster?.players.length ? (
              <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                {r.roster.players.map((p) => (
                  <li key={p.userId} className={`border px-2 py-0.5 ${p.eligible ? "border-brand" : "border-line text-muted"}`}>
                    {p.displayName} {p.nidVerified ? "✓" : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Round B2: the registrations as a CSV for organisation owners and admins (the API answers 404 to
 * anyone else, so staff do not see the button). "With squad lists" adds a row per player: display
 * name and NID verified yes or no, never phones or ids.
 */
function RegistrationsExport({ orgId, x }: { orgId: string; x: Tournament }) {
  const t = useTranslations("sportsConsole");
  const td = useTranslations("dashboard");
  const { status } = useAuth();
  const orgs = useQuery({ queryKey: ["my-orgs"], queryFn: () => api.mine(), enabled: status === "signed_in" });
  const [roster, setRoster] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!canExportRegistrations(orgs.data?.items.find((o) => o.id === orgId)?.role)) return null;
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.registrationsCsv(orgId, x.id, roster);
    } catch (e) {
      setError(td(csvErrorKey(problemOf(e)?.code)));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end" data-testid="registrations-export">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="size-5" checked={roster} onChange={(e) => setRoster(e.target.checked)} data-testid="registrations-export-roster" />
          {t("export.withSquads")}
        </label>
        <button type="button" className={`${btn} inline-flex items-center gap-2 border-line`} disabled={busy} onClick={() => void run()} data-testid="registrations-export-csv">
          <DownloadSimple size={18} aria-hidden />
          {busy ? td("csv.preparing") : t("export.csv")}
        </button>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}

const emptyResult = { a: "", b: "", aw: "", bw: "", ab: "", bb: "", pa: "", pb: "", sets: "", decider: "" };

function ResultForm({ orgId, m, engine, amend, onDone }: { orgId: string; m: Match; engine: string; amend: boolean; onDone: () => void }) {
  const t = useTranslations("sportsConsole");
  const err = useErr();
  const [f, setF] = useState(emptyResult);
  const [overs, setOvers] = useState({ a: "", b: "" });
  const [reason, setReason] = useState("");
  const send = useMutation({
    mutationFn: () => {
      const body = resultBody(engine, { ...f, ab: oversToBalls(overs.a), bb: oversToBalls(overs.b) });
      return amend ? api.amend(orgId, m.id, { ...body, reason }) : api.result(orgId, m.id, body);
    },
    onSuccess: onDone,
  });
  const box = "min-h-11 w-20 border-2 border-line bg-surface px-2";
  const nameA = m.teamA.team?.name ?? "A";
  const nameB = m.teamB.team?.name ?? "B";
  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2 border-t border-line pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        send.mutate();
      }}
      data-testid="result-form"
    >
      {engine === "rally" ? (
        <label className="flex flex-col text-sm">
          {t("setsHint", { a: nameA, b: nameB })}
          <input className={`${inputCls} w-64`} value={f.sets} onChange={(e) => setF({ ...f, sets: e.target.value })} placeholder="21-15, 21-17" data-testid="result-sets" />
        </label>
      ) : engine === "ball_by_ball" ? (
        <>
          {(["a", "b"] as const).map((s) => (
            <span key={s} className="flex items-end gap-1 text-sm">
              <span className="pb-3 font-semibold">{s === "a" ? nameA : nameB}</span>
              <input className={box} aria-label={t("runs")} placeholder={t("runs")} value={f[s]} onChange={(e) => setF({ ...f, [s]: e.target.value })} />
              <input className={box} aria-label={t("wickets")} placeholder={t("wickets")} value={f[`${s}w`]} onChange={(e) => setF({ ...f, [`${s}w`]: e.target.value })} />
              <input className={box} aria-label={t("overs")} placeholder={t("overs")} value={overs[s]} onChange={(e) => setOvers({ ...overs, [s]: e.target.value })} />
            </span>
          ))}
          <select className={inputCls} value={f.decider} onChange={(e) => setF({ ...f, decider: e.target.value })} aria-label={t("decider")}>
            <option value="">{t("decider")}</option>
            <option value="a">{nameA}</option>
            <option value="b">{nameB}</option>
          </select>
        </>
      ) : (
        <>
          <span className="flex items-end gap-1 text-sm">
            <span className="pb-3 font-semibold">{nameA}</span>
            <input className={box} aria-label={nameA} value={f.a} onChange={(e) => setF({ ...f, a: e.target.value })} data-testid="result-a" />
            <span className="pb-3">–</span>
            <input className={box} aria-label={nameB} value={f.b} onChange={(e) => setF({ ...f, b: e.target.value })} data-testid="result-b" />
            <span className="pb-3 font-semibold">{nameB}</span>
          </span>
          <span className="flex items-end gap-1 text-sm">
            <span className="pb-3 text-muted">{t("pens")}</span>
            <input className={box} aria-label={`${t("pens")} ${nameA}`} value={f.pa} onChange={(e) => setF({ ...f, pa: e.target.value })} />
            <input className={box} aria-label={`${t("pens")} ${nameB}`} value={f.pb} onChange={(e) => setF({ ...f, pb: e.target.value })} />
          </span>
        </>
      )}
      {amend ? <input className={`${inputCls} w-56`} placeholder={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} /> : null}
      <button type="submit" className={primary} disabled={send.isPending} data-testid="result-save">
        {amend ? t("amend") : t("saveResult")}
      </button>
      {send.error ? <span className="w-full">{<Notice tone="error">{err(send.error)}</Notice>}</span> : null}
    </form>
  );
}

function FixturesTab({ orgId, x }: { orgId: string; x: Tournament }) {
  const t = useTranslations("sportsConsole");
  const locale = useLocale();
  const err = useErr();
  const refresh = useRefresh(orgId, x.id);
  const q = useQuery({ queryKey: ["sports-fixtures", orgId, x.id], queryFn: () => api.fixtures(orgId, x.id) });
  const [seeding, setSeeding] = useState<Seeding>("random");
  const [days, setDays] = useState<number[]>([5, 6]);
  const [slots, setSlots] = useState("16:30, 18:00, 19:30");
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof api.generate>> | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [pending, setPending] = useState<{ kind: MatchAction; m: Match } | null>(null);
  const act = useMutation({ mutationFn: async (fn: () => Promise<unknown>) => fn(), onSuccess: refresh });
  const schedule = { weekdays: days, slots: slots.split(",").map((s) => s.trim()).filter(Boolean) };
  const dry = useMutation({ mutationFn: () => api.generate(orgId, x.id, { dryRun: true, schedule }), onSuccess: setPlan });
  const matches = useMemo(() => q.data?.matches ?? [], [q.data]);
  const label = (side: Match["teamA"]) => side.team?.name ?? (side.ref as { type: string; matchNo?: number; group?: string; pos?: number }).type.replace("_", " ");
  const drafts = matches.filter((m) => m.status === "draft").length;
  const canDraw = x.status === "registration_closed" && !matches.some((m) => m.result);
  return (
    <div className="mt-6 flex flex-col gap-6">
      {(act.error ?? dry.error) ? <Notice tone="error">{err(act.error ?? dry.error)}</Notice> : null}
      {canDraw ? (
        <div className="grid gap-4 border-2 border-line p-4 md:grid-cols-2" data-testid="draw-panel">
          <div className="flex flex-col gap-2">
            <h2 className="font-extrabold">{t("drawTitle")}</h2>
            <select className={inputCls} value={seeding} onChange={(e) => setSeeding(e.target.value as Seeding)} data-testid="draw-seeding">
              {(["random", "registration_order"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`seeding.${s}`)}
                </option>
              ))}
            </select>
            <button type="button" className={btn} disabled={act.isPending} onClick={() => act.mutate(() => api.drawConfirm(orgId, x.id, seeding))} data-testid="draw-confirm">
              {t("confirmDraw")}
            </button>
            {q.data?.draw?.seed ? <p className="break-all font-mono text-xs text-muted">{t("seed", { seed: q.data.draw.seed })}</p> : null}
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="font-extrabold">{t("scheduleTitle")}</h2>
            <div className="flex flex-wrap gap-2">
              {[6, 0, 1, 2, 3, 4, 5].map((d) => (
                <label key={d} className="flex min-h-11 items-center gap-1 text-sm">
                  <input type="checkbox" checked={days.includes(d)} onChange={() => setDays(days.includes(d) ? days.filter((x2) => x2 !== d) : [...days, d])} />
                  {t(`dow.${d}`)}
                </label>
              ))}
            </div>
            <input className={inputCls} value={slots} onChange={(e) => setSlots(e.target.value)} aria-label={t("slots")} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btn} disabled={!q.data?.draw} onClick={() => dry.mutate()} data-testid="fixtures-dry">
                {t("dryRun")}
              </button>
              <button type="button" className={primary} disabled={act.isPending || !q.data?.draw} onClick={() => act.mutate(() => api.generate(orgId, x.id, { dryRun: false, schedule }).then(() => setPlan(null)))} data-testid="fixtures-generate">
                {t("generate")}
              </button>
            </div>
            {plan ? <p className="text-sm">{t("planLine", { n: plan.matchCount, unscheduled: plan.unscheduled.length })}</p> : null}
          </div>
        </div>
      ) : null}
      {drafts ? (
        <div className="flex items-center gap-3 border-2 border-amber-500 p-3">
          <span className="flex-1">{t("draftsWaiting", { n: drafts })}</span>
          <button type="button" className={primary} disabled={act.isPending} onClick={() => act.mutate(() => api.publish(orgId, x.id))} data-testid="fixtures-publish">
            {t("publish")}
          </button>
        </div>
      ) : null}
      <ul className="divide-y-2 divide-line border-y-2 border-line" data-testid="console-matches">
        {matches.map((m) => (
          <li key={m.id} className="py-3" data-testid="console-match">
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-12 font-mono font-bold text-muted">M{m.matchNo}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {label(m.teamA)} v {label(m.teamB)}
                </span>
                <span className="block text-sm text-muted">{m.scheduledStart ? formatDhaka(m.scheduledStart, locale) : t("timeTbc")}</span>
              </span>
              <Chip tone={m.result ? "ok" : m.status === "cancelled" ? "bad" : m.status === "postponed" ? "warn" : "muted"}>{t(`match.${m.status}`)}</Chip>
              {m.published && m.teamA.team && m.teamB.team && !["cancelled", "postponed"].includes(m.status) ? (
                <button type="button" className={btn} onClick={() => setOpen(open === m.id ? null : m.id)} data-testid="match-result-open">
                  {m.result ? t("amend") : t("enterResult")}
                </button>
              ) : null}
              <MatchMenu m={m} onPick={(kind) => setPending({ kind, m })} />
            </div>
            {m.statusReason && ["postponed", "cancelled", "walkover"].includes(m.status) ? <p className="mt-1 pl-15 text-sm text-muted">{m.statusReason}</p> : null}
            {open === m.id ? <ResultForm orgId={orgId} m={m} engine={x.sport.engine ?? "clock"} amend={Boolean(m.result)} onDone={() => (setOpen(null), refresh())} /> : null}
          </li>
        ))}
        {!matches.length ? <li className="py-6 text-muted">{t("noMatches")}</li> : null}
      </ul>
      <MatchActionDialogs orgId={orgId} pending={pending} onClose={() => setPending(null)} onDone={refresh} />
    </div>
  );
}

const MATCH_ICON: Record<MatchAction, ReactNode> = {
  move: <ArrowsClockwise aria-hidden />,
  postpone: <PauseCircle aria-hidden />,
  walkover: <Flag aria-hidden />,
  cancel: <CalendarX aria-hidden />,
};

/** The match's menu (M14 §4 console: Edit date/time, Postpone, Mark walkover, Cancel), only what its state allows. */
function MatchMenu({ m, onPick }: { m: Match; onPick: (kind: MatchAction) => void }) {
  const t = useTranslations("sportsConsole");
  const kinds = matchActions(m);
  if (!kinds.length) return null;
  const items: MenuItem[] = [];
  for (const k of kinds) {
    if (k === "cancel") items.push("separator");
    items.push({ label: t(`mAct.${k}`), icon: MATCH_ICON[k], danger: k === "cancel", onSelect: () => onPick(k) });
  }
  return (
    <Menu
      trigger={
        <button type="button" className="inline-flex size-11 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-ink" aria-label={t("matchActions", { n: m.matchNo })} data-testid="match-actions">
          <DotsThree size={22} weight="bold" aria-hidden />
        </button>
      }
      items={items}
    />
  );
}

/**
 * The dialogs behind the match menu: move (date, time, court; the match's version guards against a
 * stale list), postpone and cancel (a reason of 5 to 255 characters), walkover (the winner and a
 * reason). The API answers 409 MATCH_STATE when the match moved on meanwhile.
 */
function MatchActionDialogs({ orgId, pending, onClose, onDone }: { orgId: string; pending: { kind: MatchAction; m: Match } | null; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("sportsConsole");
  const err = useErr();
  const act = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      onClose();
      onDone();
    },
  });
  const close = (o: boolean) => {
    if (o) return;
    act.reset();
    onClose();
  };
  const m = pending?.m;
  const kind = pending?.kind;
  return (
    <>
      <ReasonDialog
        key={`postpone-${m?.id}`}
        open={kind === "postpone"}
        onOpenChange={close}
        title={t("postponeTitle", { n: m?.matchNo ?? 0 })}
        description={t("postponeHelp")}
        confirmLabel={t("mAct.postpone")}
        minLength={5}
        maxLength={255}
        busy={act.isPending}
        error={act.error ? err(act.error) : undefined}
        onConfirm={(reason) => m && act.mutate(() => api.postpone(orgId, m.id, reason))}
        testId="match-postpone"
      />
      <ReasonDialog
        key={`cancel-${m?.id}`}
        open={kind === "cancel"}
        onOpenChange={close}
        title={t("cancelMatchTitle", { n: m?.matchNo ?? 0 })}
        description={t("cancelMatchHelp")}
        confirmLabel={t("mAct.cancel")}
        danger
        minLength={5}
        maxLength={255}
        busy={act.isPending}
        error={act.error ? err(act.error) : undefined}
        onConfirm={(reason) => m && act.mutate(() => api.cancelMatch(orgId, m.id, reason))}
        testId="match-cancel"
      />
      {m && kind === "move" ? <MoveDialog key={m.id} orgId={orgId} m={m} busy={act.isPending} error={act.error ? err(act.error) : null} onClose={close} onSave={(fn) => act.mutate(fn)} /> : null}
      {m && kind === "walkover" ? <WalkoverDialog key={m.id} orgId={orgId} m={m} busy={act.isPending} error={act.error ? err(act.error) : null} onClose={close} onSave={(fn) => act.mutate(fn)} /> : null}
    </>
  );
}

type ActionDialogProps = { orgId: string; m: Match; busy: boolean; error: ReactNode; onClose: (open: boolean) => void; onSave: (fn: () => Promise<unknown>) => void };

function MoveDialog({ orgId, m, busy, error, onClose, onSave }: ActionDialogProps) {
  const t = useTranslations("sportsConsole");
  const [start, setStart] = useState(() => toLocalInput(m.scheduledStart));
  const [court, setCourt] = useState(m.court ?? "");
  return (
    <Dialog
      open
      onOpenChange={onClose}
      title={t("moveTitle", { n: m.matchNo })}
      description={t("moveHelp")}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => onClose(false)} disabled={busy}>
            {t("close")}
          </Button>
          <Button type="submit" form="match-move-form" busy={busy} data-testid="match-move-save">
            {t("moveSave")}
          </Button>
        </>
      }
    >
      <form
        id="match-move-form"
        className="flex flex-col gap-4"
        data-testid="match-move"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(() => api.move(orgId, m.id, { scheduledStart: fromLocalInput(start), court: court.trim() || null, version: m.version }));
        }}
      >
        <KitField id="match-move-start" type="datetime-local" label={t("moveStart")} value={start} onChange={(e) => setStart(e.target.value)} />
        <KitField id="match-move-court" label={t("moveCourt")} value={court} onChange={(e) => setCourt(e.target.value)} maxLength={60} placeholder={t("courtsHint")} />
        {error ? <Notice tone="error">{error}</Notice> : null}
      </form>
    </Dialog>
  );
}

function WalkoverDialog({ orgId, m, busy, error, onClose, onSave }: ActionDialogProps) {
  const t = useTranslations("sportsConsole");
  const teams = [m.teamA.team, m.teamB.team].filter((x): x is NonNullable<typeof x> => Boolean(x));
  const [winner, setWinner] = useState(teams[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const short = reason.trim().length < 5;
  return (
    <Dialog
      open
      onOpenChange={onClose}
      title={t("walkoverTitle", { n: m.matchNo })}
      description={t("walkoverHelp")}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => onClose(false)} disabled={busy}>
            {t("close")}
          </Button>
          <Button type="submit" form="match-walkover-form" busy={busy} data-testid="match-walkover-save">
            {t("mAct.walkover")}
          </Button>
        </>
      }
    >
      <form
        id="match-walkover-form"
        className="flex flex-col gap-4"
        data-testid="match-walkover"
        onSubmit={(e) => {
          e.preventDefault();
          setTried(true);
          if (!short && winner) onSave(() => api.walkover(orgId, m.id, winner, reason.trim()));
        }}
      >
        <Select id="match-walkover-winner" label={t("walkoverWinner")} value={winner} onChange={(e) => setWinner(e.target.value)}>
          {teams.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name ?? x.shortCode ?? x.id}
            </option>
          ))}
        </Select>
        <Textarea id="match-walkover-reason" label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} error={tried && short ? t("reasonShort") : undefined} />
        {error ? <Notice tone="error">{error}</Notice> : null}
      </form>
    </Dialog>
  );
}

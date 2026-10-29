"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { bigEvents, dhakaIso, dhakaLocal, stageBody, type BigEvent, type EventInput } from "@/lib/admin/bigEvents";
import { esportsAdmin } from "@/lib/admin/esports";
import { formatTaka } from "@/lib/admin/finance";
import { problemOf } from "@kriraghor/api-client";
import { publicEnv } from "@kriraghor/session/env";
import { Notice } from "@kriraghor/ui/primitives";
import { formatDhaka, useAdminMe } from "../useAdminMe";
import { DateTimePicker } from "@kriraghor/ui/date";
import { Chip, Field, inputCls } from "../finance/shared";

const btn = "min-h-11 border-2 px-4 text-sm font-semibold disabled:opacity-50";
type Tab = "basics" | "stages" | "places" | "streams" | "sponsors" | "polls" | "feed";
type Msg = { text: string; tone: "info" | "error" } | null;

/**
 * /admin/esports/events (M23, manage_esports): big events over Kriraghor's tournaments. Link the
 * qualifiers to an invite-only final (each link is checked), publish, then run the day: streams with
 * live toggles (followers hear once per cooldown), sponsors, polls and announcements. Places come
 * from the qualifiers' finalised standings; staff invite wildcards and revoke unused places.
 */
export function BigEventsDesk() {
  const t = useTranslations("bigEvents");
  const locale = useLocale();
  const params = useSearchParams();
  const { ready, me } = useAdminMe();
  const canManage = Boolean(me && (me.isMaster || me.permissions.includes("manage_esports")));
  const [selected, setSelected] = useState<string | null>(params.get("id"));
  const [creating, setCreating] = useState(false);
  const q = useQuery({ queryKey: ["bev-list"], enabled: canManage, queryFn: () => bigEvents.list() });
  return (
    <>
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t("intro")}</p>
        {ready && !canManage ? (
          <div className="mt-6 max-w-3xl">
            <Notice tone="error">{t("noAccess")}</Notice>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div>
              <button type="button" className={`${btn} w-full border-brand`} onClick={() => (setCreating(true), setSelected(null))} data-testid="new-event">
                {t("new")}
              </button>
              <ul className="mt-3 divide-y-2 divide-line border-y-2 border-line" data-testid="event-list">
                {(q.data?.items ?? []).map((x) => (
                  <li key={x.id}>
                    <button type="button" onClick={() => (setSelected(x.id), setCreating(false))} className={`w-full px-2 py-3 text-left hover:bg-surface-2 ${selected === x.id ? "bg-surface-2" : ""}`}>
                      <span className="flex items-center gap-2">
                        <span className="font-semibold">{x.titleEn}</span>
                        <span className="ml-auto">
                          <Chip tone={x.phase === "live" ? "bad" : x.status === "draft" ? "warn" : x.status === "cancelled" ? "muted" : "ok"}>{t(`phase.${x.phase}`)}</Chip>
                        </span>
                      </span>
                      <span className="block text-xs text-muted">
                        {formatDhaka(x.startsAt, locale)} · {formatTaka(x.prizeTotal.amount, locale)}
                      </span>
                    </button>
                  </li>
                ))}
                {q.data && !q.data.items.length ? <li className="py-4 text-sm text-muted">{t("none")}</li> : null}
              </ul>
            </div>
            <div>{creating ? <Basics onSaved={(id) => (setCreating(false), setSelected(id))} /> : selected ? <Pane key={selected} id={selected} /> : <p className="text-muted">{t("pick")}</p>}</div>
          </div>
        )}
      </div>
    </>
  );
}

function useAct() {
  const t = useTranslations("bigEvents");
  const [msg, setMsg] = useState<Msg>(null);
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ text: done, tone: "info" });
      return true;
    } catch (err) {
      setMsg({ text: problemOf(err)?.title ?? t("failed"), tone: "error" });
      return false;
    }
  };
  return { msg, run, view: msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null };
}

function Pane({ id }: { id: string }) {
  const t = useTranslations("bigEvents");
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("basics");
  const q = useQuery({ queryKey: ["bev", id], queryFn: () => bigEvents.get(id) });
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["bev", id] });
    await qc.invalidateQueries({ queryKey: ["bev-list"] });
  };
  if (q.isPending) return <div className="h-64 animate-pulse bg-surface-2" />;
  if (q.isError) return <Notice tone="error">{t("failed")}</Notice>;
  const e = q.data;
  return (
    <section className="border-2 border-line bg-surface p-5" data-testid="event-pane">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-extrabold">{e.event.titleEn}</h2>
        <Chip tone={e.event.status === "published" ? "ok" : e.event.status === "draft" ? "warn" : "muted"}>{t(`phase.${e.event.phase}`)}</Chip>
        <a href={`${publicEnv().ESPORTS_URL}/e/${e.event.slug}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-sm font-semibold text-brand underline">
          {t("viewPage")}
        </a>
      </div>
      <div role="tablist" className="mt-4 flex flex-wrap gap-2">
        {(["basics", "stages", "places", "streams", "sponsors", "polls", "feed"] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-11 border-2 px-3 text-sm font-bold ${tab === k ? "border-brand text-ink" : "border-line text-muted"}`}>
            {t(`tab.${k}`)}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {tab === "basics" ? <Basics event={e} onSaved={() => void refresh()} /> : null}
        {tab === "stages" ? <Stages e={e} onSaved={refresh} /> : null}
        {tab === "places" ? <Places e={e} /> : null}
        {tab === "streams" ? <Streams e={e} onSaved={refresh} /> : null}
        {tab === "sponsors" ? <Sponsors e={e} onSaved={refresh} /> : null}
        {tab === "polls" ? <Polls e={e} onSaved={refresh} /> : null}
        {tab === "feed" ? <Feed e={e} onSaved={refresh} /> : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- basics

function Basics({ event, onSaved }: { event?: BigEvent; onSaved: (id: string) => void }) {
  const t = useTranslations("bigEvents");
  const e = event?.event;
  // Lazy: the defaults read the clock once, on mount.
  const [f, setF] = useState(() => ({
    titleEn: e?.titleEn ?? "",
    titleBn: e?.titleBn ?? "",
    taglineEn: e?.taglineEn ?? "",
    taglineBn: e?.taglineBn ?? "",
    aboutMdEn: e?.aboutMdEn ?? "",
    aboutMdBn: e?.aboutMdBn ?? "",
    accentHex: e?.accentHex ?? "#f2a33a",
    startsAt: dhakaLocal(e?.startsAt ?? new Date().toISOString()),
    endsAt: dhakaLocal(e?.endsAt ?? new Date(Date.now() + 2 * 86400000).toISOString()),
    featured: e?.featured ?? false,
  }));
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const act = useAct();
  const [reason, setReason] = useState("");
  const body = (): EventInput => ({ ...f, taglineEn: f.taglineEn || null, taglineBn: f.taglineBn || null, accentHex: f.accentHex.toLowerCase(), startsAt: dhakaIso(f.startsAt), endsAt: dhakaIso(f.endsAt) });
  return (
    <form
      className="grid gap-4"
      onSubmit={async (ev) => {
        ev.preventDefault();
        if (e) {
          if (await act.run(() => bigEvents.update(e.id, body()), t("saved"))) onSaved(e.id);
        } else {
          let created: string | null = null;
          if (await act.run(async () => (created = (await bigEvents.create(body())).id), t("saved")) && created) onSaved(created);
        }
      }}
      data-testid="event-form"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("f.titleEn")}>
          <input value={f.titleEn} onChange={(x) => set("titleEn", x.target.value)} className={inputCls} required minLength={3} maxLength={120} />
        </Field>
        <Field label={t("f.titleBn")}>
          <input value={f.titleBn} onChange={(x) => set("titleBn", x.target.value)} className={inputCls} required minLength={2} maxLength={160} />
        </Field>
        <Field label={t("f.taglineEn")}>
          <input value={f.taglineEn} onChange={(x) => set("taglineEn", x.target.value)} className={inputCls} maxLength={160} />
        </Field>
        <Field label={t("f.taglineBn")}>
          <input value={f.taglineBn} onChange={(x) => set("taglineBn", x.target.value)} className={inputCls} maxLength={200} />
        </Field>
        <DateTimePicker id="be-starts" label={t("f.startsAt")} value={f.startsAt} onChange={(v) => set("startsAt", v)} required />
        <DateTimePicker id="be-ends" label={t("f.endsAt")} value={f.endsAt} onChange={(v) => set("endsAt", v)} required />
        <Field label={t("f.accent")}>
          <span className="flex items-center gap-2">
            <input type="color" value={f.accentHex} onChange={(x) => set("accentHex", x.target.value)} className="h-11 w-14 border-2 border-line" aria-label={t("f.accent")} />
            <input value={f.accentHex} onChange={(x) => set("accentHex", x.target.value)} className={`${inputCls} w-32`} pattern="#[0-9a-fA-F]{6}" />
          </span>
        </Field>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm font-semibold">
          <input type="checkbox" className="h-5 w-5" checked={f.featured} onChange={(x) => set("featured", x.target.checked)} />
          {t("f.featured")}
        </label>
      </div>
      <Field label={t("f.aboutEn")}>
        <textarea value={f.aboutMdEn} onChange={(x) => set("aboutMdEn", x.target.value)} className={`${inputCls} min-h-24 py-2`} maxLength={10000} />
      </Field>
      <Field label={t("f.aboutBn")}>
        <textarea value={f.aboutMdBn} onChange={(x) => set("aboutMdBn", x.target.value)} className={`${inputCls} min-h-24 py-2`} maxLength={10000} />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className={`${btn} border-brand`}>
          {e ? t("save") : t("create")}
        </button>
        {e ? (
          <>
            <label className={`${btn} inline-flex cursor-pointer items-center border-line`}>
              {t("banner")}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (x) => x.target.files?.[0] && (await act.run(() => bigEvents.banner(e.id, x.target.files![0]), t("bannerSaved"))) && onSaved(e.id)} />
            </label>
            {e.status === "draft" ? (
              <button type="button" className={`${btn} border-brand bg-brand text-white`} onClick={async () => (await act.run(() => bigEvents.publish(e.id), t("published"))) && onSaved(e.id)} data-testid="publish-event">
                {t("publish")}
              </button>
            ) : null}
          </>
        ) : null}
      </div>
      {e && e.status !== "cancelled" ? (
        <div className="flex flex-wrap items-end gap-2 border-t-2 border-line pt-4">
          <Field label={t("cancelReason")}>
            <input value={reason} onChange={(x) => setReason(x.target.value)} className={`${inputCls} w-80`} minLength={5} maxLength={255} />
          </Field>
          <button type="button" className={`${btn} border-danger text-danger`} disabled={reason.trim().length < 5} onClick={async () => (await act.run(() => bigEvents.cancel(e.id, reason.trim()), t("cancelledMsg"))) && onSaved(e.id)}>
            {t("cancel")}
          </button>
          <p className="w-full text-xs text-muted">{t("cancelNote")}</p>
        </div>
      ) : null}
      {act.view}
    </form>
  );
}

// ---------------------------------------------------------------- stages

type Row = { tournamentId: string; role: "qualifier" | "final"; labelEn: string; labelBn: string; qualifyCount: string; finalTournamentId: string };

function Stages({ e, onSaved }: { e: BigEvent; onSaved: () => Promise<void> }) {
  const t = useTranslations("bigEvents");
  const locale = useLocale();
  const tours = useQuery({ queryKey: ["esd-list"], queryFn: () => esportsAdmin.list() });
  const own = (tours.data?.items ?? []).filter((x) => !x.organisationId && !["cancelled"].includes(x.status));
  const [rows, setRows] = useState<Row[]>(
    e.stages.length
      ? e.stages.map((s) => ({ tournamentId: s.tournament?.id ?? "", role: s.role, labelEn: s.labelEn, labelBn: s.labelBn, qualifyCount: String(s.qualifyCount ?? ""), finalTournamentId: s.finalTournamentId ?? "" }))
      : [{ tournamentId: "", role: "final", labelEn: "Grand final", labelBn: "গ্র্যান্ড ফাইনাল", qualifyCount: "", finalTournamentId: "" }]
  );
  const act = useAct();
  const finals = rows.filter((r) => r.role === "final" && r.tournamentId);
  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const nameOf = (tid: string) => own.find((x) => x.id === tid)?.titleEn ?? tid.slice(0, 8);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t("stagesHelp")}</p>
      {rows.map((r, i) => (
        <div key={i} className="grid gap-2 border-2 border-line p-3 md:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)]" data-testid="stage-row">
          <select value={r.role} onChange={(x) => setRow(i, { role: x.target.value as Row["role"] })} className={inputCls} aria-label={t("s.role")}>
            <option value="final">{t("s.final")}</option>
            <option value="qualifier">{t("s.qualifier")}</option>
          </select>
          <select value={r.tournamentId} onChange={(x) => setRow(i, { tournamentId: x.target.value })} className={inputCls} aria-label={t("s.tournament")}>
            <option value="">—</option>
            {own.map((x) => (
              <option key={x.id} value={x.id}>
                {x.titleEn} · {formatDhaka(x.startsAt, locale)} {x.entryPolicy === "invite" ? `· ${t("inviteOnly")}` : ""}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input value={r.labelEn} onChange={(x) => setRow(i, { labelEn: x.target.value })} className={inputCls} placeholder={t("s.labelEn")} aria-label={t("s.labelEn")} />
            <input value={r.labelBn} onChange={(x) => setRow(i, { labelBn: x.target.value })} className={inputCls} placeholder={t("s.labelBn")} aria-label={t("s.labelBn")} />
          </div>
          {r.role === "qualifier" ? (
            <div className="grid gap-2 sm:grid-cols-2 md:col-span-3">
              <Field label={t("s.qualifyCount")}>
                <input value={r.qualifyCount} onChange={(x) => setRow(i, { qualifyCount: x.target.value.replace(/[^0-9]/g, "") })} className={inputCls} inputMode="numeric" />
              </Field>
              <Field label={t("s.feeds")}>
                <select value={r.finalTournamentId} onChange={(x) => setRow(i, { finalTournamentId: x.target.value })} className={inputCls}>
                  <option value="">—</option>
                  {finals.map((fr) => (
                    <option key={fr.tournamentId} value={fr.tournamentId}>
                      {nameOf(fr.tournamentId)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}
          <button type="button" className="justify-self-start text-sm text-danger underline md:col-span-3" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
            {t("s.remove")}
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${btn} border-line`} onClick={() => setRows([...rows, { tournamentId: "", role: "qualifier", labelEn: `Qualifier ${rows.length}`, labelBn: `কোয়ালিফায়ার ${rows.length}`, qualifyCount: "", finalTournamentId: finals[0]?.tournamentId ?? "" }])}>
          {t("s.add")}
        </button>
        <button
          type="button"
          className={`${btn} border-brand`}
          data-testid="save-stages"
          onClick={async () => {
            const body = stageBody(rows);
            if (!body) return act.run(async () => Promise.reject({ title: t("s.incomplete") }), "");
            if (await act.run(() => bigEvents.stages(e.event.id, body), t("saved"))) await onSaved();
          }}
        >
          {t("save")}
        </button>
      </div>
      {act.view}
      {e.linkCheck.length ? (
        <ul className="space-y-1 text-sm" data-testid="link-check">
          {e.linkCheck.map((c) => (
            <li key={c.finalTournamentId}>
              <Chip tone={c.block ? "bad" : "ok"}>{c.block ? t("check.bad") : t("check.ok")}</Chip> {nameOf(c.finalTournamentId)} · {t("check.qualifying", { n: c.qualifying })} {c.block ? `· ${c.block}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- places

function Places({ e }: { e: BigEvent }) {
  const t = useTranslations("bigEvents");
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["bev-places", e.event.id], queryFn: () => bigEvents.places(e.event.id) });
  const finals = e.stages.filter((s) => s.role === "final" && s.tournament);
  const [inv, setInv] = useState({ finalTournamentId: finals[0]?.tournament?.id ?? "", kind: "squad" as "squad" | "player", ref: "", reason: "" });
  const [revokeReason, setRevokeReason] = useState("");
  const act = useAct();
  const reload = () => qc.invalidateQueries({ queryKey: ["bev-places", e.event.id] });
  return (
    <div className="space-y-4">
      <table className="w-full text-sm" data-testid="places">
        <thead className="border-b-2 border-line text-left text-xs uppercase text-muted">
          <tr>
            <th className="px-2 py-2">#</th>
            <th className="px-2 py-2">{t("p.entry")}</th>
            <th className="px-2 py-2">{t("p.status")}</th>
            <th className="px-2 py-2">{t("p.reason")}</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {(q.data?.items ?? []).map((x) => (
            <tr key={x.id}>
              <td className="px-2 py-2 tabular-nums">{x.rank ?? "–"}</td>
              <td className="px-2 py-2 font-semibold">
                {x.entry.name} {x.entry.tag ? <span className="text-muted">[{x.entry.tag}]</span> : null}
              </td>
              <td className="px-2 py-2">
                <Chip tone={x.status === "entered" ? "ok" : x.status === "revoked" || x.status === "missed" ? "bad" : "muted"}>{t(`p.s.${x.status}`)}</Chip>
              </td>
              <td className="px-2 py-2 text-muted">{(x as { reason?: string | null }).reason ?? ""}</td>
              <td className="px-2 py-2 text-right">
                {["qualified", "invited", "missed"].includes(x.status) ? (
                  <button type="button" className="text-sm text-danger underline disabled:opacity-50" disabled={revokeReason.trim().length < 5} onClick={async () => (await act.run(() => bigEvents.revoke(e.event.id, x.id, revokeReason.trim()), t("p.revoked"))) && reload()}>
                    {t("p.revoke")}
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
          {q.data && !q.data.items.length ? (
            <tr>
              <td colSpan={5} className="px-2 py-4 text-muted">
                {t("p.none")}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <Field label={t("p.revokeReason")}>
        <input value={revokeReason} onChange={(x) => setRevokeReason(x.target.value)} className={`${inputCls} max-w-md`} maxLength={255} />
      </Field>
      {finals.length ? (
        <form
          className="grid gap-2 border-t-2 border-line pt-4 sm:grid-cols-2"
          onSubmit={async (ev) => {
            ev.preventDefault();
            const body = { finalTournamentId: inv.finalTournamentId, reason: inv.reason.trim(), ...(inv.kind === "squad" ? { squadId: inv.ref.trim() } : { userId: inv.ref.trim() }) };
            if (await act.run(() => bigEvents.invite(e.event.id, body), t("p.invited"))) {
              setInv({ ...inv, ref: "", reason: "" });
              await reload();
            }
          }}
        >
          <h3 className="font-bold sm:col-span-2">{t("p.inviteTitle")}</h3>
          <Field label={t("p.final")}>
            <select value={inv.finalTournamentId} onChange={(x) => setInv({ ...inv, finalTournamentId: x.target.value })} className={inputCls}>
              {finals.map((f) => (
                <option key={f.tournament!.id} value={f.tournament!.id}>
                  {f.labelEn}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("p.kind")}>
            <select value={inv.kind} onChange={(x) => setInv({ ...inv, kind: x.target.value as "squad" | "player" })} className={inputCls}>
              <option value="squad">{t("p.squad")}</option>
              <option value="player">{t("p.player")}</option>
            </select>
          </Field>
          <Field label={inv.kind === "squad" ? t("p.squadId") : t("p.userId")}>
            <input value={inv.ref} onChange={(x) => setInv({ ...inv, ref: x.target.value })} className={inputCls} required pattern="[0-9a-fA-F-]{36}" />
          </Field>
          <Field label={t("p.reason")}>
            <input value={inv.reason} onChange={(x) => setInv({ ...inv, reason: x.target.value })} className={inputCls} required minLength={5} maxLength={255} />
          </Field>
          <button type="submit" className={`${btn} border-brand justify-self-start`}>
            {t("p.invite")}
          </button>
        </form>
      ) : null}
      {act.view}
    </div>
  );
}

// ---------------------------------------------------------------- streams, sponsors, polls, feed

function Streams({ e, onSaved }: { e: BigEvent; onSaved: () => Promise<void> }) {
  const t = useTranslations("bigEvents");
  const own = e.streams.filter((s) => s.source === "event");
  const [rows, setRows] = useState(own.length ? own.map((s) => ({ platform: s.platform as "youtube", url: s.url, title: s.title, isLive: s.isLive })) : [{ platform: "youtube" as const, url: "", title: "", isLive: false }]);
  const act = useAct();
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">{t("streamsHelp")}</p>
      {rows.map((r, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[130px_1fr_1fr_auto]">
          <select value={r.platform} onChange={(x) => setRows(rows.map((y, j) => (j === i ? { ...y, platform: x.target.value as "youtube" } : y)))} className={inputCls} aria-label={t("st.platform")}>
            {["youtube", "facebook", "tiktok"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input value={r.url} onChange={(x) => setRows(rows.map((y, j) => (j === i ? { ...y, url: x.target.value } : y)))} placeholder="https://" className={inputCls} aria-label={t("st.url")} />
          <input value={r.title} onChange={(x) => setRows(rows.map((y, j) => (j === i ? { ...y, title: x.target.value } : y)))} placeholder={t("st.title")} className={inputCls} aria-label={t("st.title")} />
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={r.isLive} onChange={(x) => setRows(rows.map((y, j) => (j === i ? { ...y, isLive: x.target.checked } : y)))} />
            {t("st.live")}
          </label>
        </div>
      ))}
      <div className="flex gap-2">
        <button type="button" className={`${btn} border-line`} onClick={() => setRows([...rows, { platform: "youtube", url: "", title: "", isLive: false }])}>
          +
        </button>
        <button type="button" className={`${btn} border-brand`} onClick={async () => (await act.run(() => bigEvents.streams(e.event.id, rows.filter((r) => r.url)), t("saved"))) && (await onSaved())} data-testid="save-streams">
          {t("save")}
        </button>
      </div>
      {act.view}
      {e.streams.filter((s) => s.source === "tournament").length ? <p className="text-xs text-muted">{t("tournamentStreams", { n: e.streams.filter((s) => s.source === "tournament").length })}</p> : null}
    </div>
  );
}

function Sponsors({ e, onSaved }: { e: BigEvent; onSaved: () => Promise<void> }) {
  const t = useTranslations("bigEvents");
  const [f, setF] = useState({ name: "", tier: "partner" as "title" | "gold" | "partner", url: "" });
  const act = useAct();
  return (
    <div className="space-y-4">
      <ul className="divide-y-2 divide-line border-y-2 border-line">
        {e.sponsors.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 py-2">
            {s.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logoUrl} alt="" className="h-8 w-16 object-contain" />
            ) : null}
            <span className="font-semibold">{s.name}</span>
            <Chip tone="muted">{t(`tier.${s.tier}`)}</Chip>
            <label className="ml-auto cursor-pointer text-sm text-brand underline">
              {t("logo")}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (x) => x.target.files?.[0] && (await act.run(() => bigEvents.sponsorLogo(e.event.id, s.id, x.target.files![0]), t("saved"))) && (await onSaved())} />
            </label>
            <button type="button" className="text-sm text-danger underline" onClick={async () => (await act.run(() => bigEvents.removeSponsor(e.event.id, s.id), t("saved"))) && (await onSaved())}>
              {t("remove")}
            </button>
          </li>
        ))}
      </ul>
      <form
        className="grid gap-2 sm:grid-cols-[1fr_140px_1fr_auto]"
        onSubmit={async (ev) => {
          ev.preventDefault();
          if (await act.run(() => bigEvents.addSponsor(e.event.id, { name: f.name.trim(), tier: f.tier, url: f.url.trim() || null }), t("saved"))) {
            setF({ name: "", tier: "partner", url: "" });
            await onSaved();
          }
        }}
      >
        <input value={f.name} onChange={(x) => setF({ ...f, name: x.target.value })} className={inputCls} placeholder={t("sp.name")} aria-label={t("sp.name")} required minLength={2} maxLength={80} />
        <select value={f.tier} onChange={(x) => setF({ ...f, tier: x.target.value as "partner" })} className={inputCls} aria-label={t("sp.tier")}>
          {(["title", "gold", "partner"] as const).map((k) => (
            <option key={k} value={k}>
              {t(`tier.${k}`)}
            </option>
          ))}
        </select>
        <input value={f.url} onChange={(x) => setF({ ...f, url: x.target.value })} className={inputCls} placeholder="https://" aria-label={t("sp.url")} />
        <button type="submit" className={`${btn} border-brand`}>
          {t("sp.add")}
        </button>
      </form>
      <p className="text-xs text-muted">{t("sponsorRules")}</p>
      {act.view}
    </div>
  );
}

function Polls({ e, onSaved }: { e: BigEvent; onSaved: () => Promise<void> }) {
  const t = useTranslations("bigEvents");
  const [f, setF] = useState({ questionEn: "", questionBn: "", options: [{ labelEn: "", labelBn: "" }, { labelEn: "", labelBn: "" }] });
  const act = useAct();
  return (
    <div className="space-y-4">
      {e.polls.map((p) => (
        <div key={p.id} className="border-2 border-line p-3" data-testid="admin-poll">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{p.questionEn}</span>
            <Chip tone={p.status === "open" ? "ok" : "muted"}>{t(`poll.${p.status}`)}</Chip>
            <span className="ml-auto text-sm text-muted">{t("poll.votes", { n: p.results.total })}</span>
            {p.status === "draft" ? (
              <button type="button" className={`${btn} border-brand`} onClick={async () => (await act.run(() => bigEvents.openPoll(e.event.id, p.id), t("saved"))) && (await onSaved())}>
                {t("poll.open")}
              </button>
            ) : p.status === "open" ? (
              <button type="button" className={`${btn} border-line`} onClick={async () => (await act.run(() => bigEvents.closePoll(e.event.id, p.id), t("saved"))) && (await onSaved())}>
                {t("poll.close")}
              </button>
            ) : null}
          </div>
          <ul className="mt-2 text-sm">
            {p.options.map((o) => (
              <li key={o.id} className="flex">
                {o.labelEn}
                <span className="ml-auto tabular-nums">{p.results.items.find((r) => r.optionId === o.id)?.pct ?? 0}%</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <form
        className="grid gap-2 border-t-2 border-line pt-4"
        onSubmit={async (ev) => {
          ev.preventDefault();
          if (await act.run(() => bigEvents.createPoll(e.event.id, { questionEn: f.questionEn.trim(), questionBn: f.questionBn.trim(), options: f.options.filter((o) => o.labelEn.trim()) }), t("saved"))) {
            setF({ questionEn: "", questionBn: "", options: [{ labelEn: "", labelBn: "" }, { labelEn: "", labelBn: "" }] });
            await onSaved();
          }
        }}
      >
        <h3 className="font-bold">{t("poll.new")}</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={f.questionEn} onChange={(x) => setF({ ...f, questionEn: x.target.value })} className={inputCls} placeholder={t("poll.questionEn")} aria-label={t("poll.questionEn")} required minLength={5} />
          <input value={f.questionBn} onChange={(x) => setF({ ...f, questionBn: x.target.value })} className={inputCls} placeholder={t("poll.questionBn")} aria-label={t("poll.questionBn")} required minLength={3} />
          {f.options.map((o, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 sm:col-span-2">
              <input value={o.labelEn} onChange={(x) => setF({ ...f, options: f.options.map((y, j) => (j === i ? { ...y, labelEn: x.target.value } : y)) })} className={inputCls} placeholder={t("poll.optionEn", { n: i + 1 })} aria-label={t("poll.optionEn", { n: i + 1 })} />
              <input value={o.labelBn} onChange={(x) => setF({ ...f, options: f.options.map((y, j) => (j === i ? { ...y, labelBn: x.target.value } : y)) })} className={inputCls} placeholder={t("poll.optionBn", { n: i + 1 })} aria-label={t("poll.optionBn", { n: i + 1 })} />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" className={`${btn} border-line`} onClick={() => setF({ ...f, options: [...f.options, { labelEn: "", labelBn: "" }] })}>
            +
          </button>
          <button type="submit" className={`${btn} border-brand`}>
            {t("poll.create")}
          </button>
        </div>
        <p className="text-xs text-muted">{t("poll.note")}</p>
      </form>
      {act.view}
    </div>
  );
}

function Feed({ e, onSaved }: { e: BigEvent; onSaved: () => Promise<void> }) {
  const t = useTranslations("bigEvents");
  const locale = useLocale();
  const [f, setF] = useState({ textEn: "", textBn: "" });
  const act = useAct();
  return (
    <div className="space-y-4">
      <form
        className="grid gap-2"
        onSubmit={async (ev) => {
          ev.preventDefault();
          if (await act.run(() => bigEvents.announce(e.event.id, { textEn: f.textEn.trim(), textBn: f.textBn.trim() }), t("posted"))) {
            setF({ textEn: "", textBn: "" });
            await onSaved();
          }
        }}
      >
        <input value={f.textEn} onChange={(x) => setF({ ...f, textEn: x.target.value })} className={inputCls} placeholder={t("feed.en")} aria-label={t("feed.en")} required minLength={3} maxLength={280} />
        <input value={f.textBn} onChange={(x) => setF({ ...f, textBn: x.target.value })} className={inputCls} placeholder={t("feed.bn")} aria-label={t("feed.bn")} required minLength={2} maxLength={400} />
        <button type="submit" className={`${btn} border-brand justify-self-start`} disabled={e.event.status !== "published"}>
          {t("feed.post")}
        </button>
      </form>
      <ol className="space-y-2 text-sm">
        {e.feed.items.map((i) => (
          <li key={i.id} className="border-l-4 border-line pl-3">
            <span className="font-semibold">{i.kind === "announcement" ? i.textEn : `${t(`feed.kind.${i.kind}`)}${i.tournament ? `: ${i.tournament.titleEn}` : ""}`}</span>
            <span className="block text-xs text-muted">{formatDhaka(i.createdAt, locale)}</span>
          </li>
        ))}
      </ol>
      {act.view}
    </div>
  );
}

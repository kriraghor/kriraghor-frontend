"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { esportsAdmin, resultsProblem, toPoisha, type ResultRow, type TournamentInput } from "@/lib/admin/esports";
import { formatTaka } from "@/lib/admin/finance";
import { stepUp } from "@/lib/admin/stepUp";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { Notice } from "@kriraghor/ui/primitives";
import { CodeDialog } from "../CodeDialog";
import { formatDhaka, useAdminMe } from "../useAdminMe";
import { Chip, Field, inputCls } from "../finance/shared";

type Tab = "tournaments" | "disputes" | "bans";
const TONE: Record<string, "ok" | "warn" | "bad" | "muted"> = { draft: "muted", review: "warn", scheduled: "muted", registration_open: "ok", registration_closed: "warn", check_in: "warn", live: "bad", results_pending: "warn", finalised: "ok", paid_out: "ok", cancelled: "bad" };
const btn = "min-h-11 border-2 px-4 text-sm font-semibold disabled:opacity-50";

/** What the shared desk parts call; the M22 organiser client leaves the staff-only actions out. */
export type DeskClient = Pick<typeof esportsAdmin, "catalog" | "create" | "board" | "match" | "room" | "setRoom" | "rotate" | "enter" | "post" | "preview"> &
  Partial<Pick<typeof esportsAdmin, "staffCheckIn" | "disqualify" | "revealNow" | "cancelMatch">>;
/** A Dhaka wall-clock value from <input type="datetime-local"> as an ISO instant. */
const dhakaIso = (v: string) => new Date(`${v}:00+06:00`).toISOString();

/**
 * /admin/esports (M21): run Kriraghor's tournaments. manage_esports runs everything; enter_results
 * staff see the list and type results. Money actions (cancel with refunds, finalise) need step-up
 * esports.money. Tournaments and UIDs are approved on the Moderation desk, by someone else.
 */
export function EsportsDesk() {
  const t = useTranslations("esportsDesk");
  const params = useSearchParams();
  const { ready, me } = useAdminMe();
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) ?? "tournaments");
  const canManage = Boolean(me && (me.isMaster || me.permissions.includes("manage_esports")));
  const canResults = canManage || Boolean(me?.permissions.includes("enter_results"));
  return (
    <>
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t("intro")}</p>
        {ready && !canResults ? (
          <div className="mt-6 max-w-3xl">
            <Notice tone="error">{t("noAccess")}</Notice>
          </div>
        ) : (
          <>
            <div role="tablist" aria-label={t("title")} className="mt-6 flex flex-wrap gap-2">
              {(["tournaments", "disputes", "bans"] as const).filter((k) => k === "tournaments" || canManage).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-11 border-2 px-4 text-sm font-bold ${tab === k ? "border-brand text-ink" : "border-line text-muted"}`}>
                  {t(`tab.${k}`)}
                </button>
              ))}
            </div>
            {tab === "tournaments" ? <Tournaments canManage={canManage} initial={params.get("id")} /> : tab === "disputes" ? <Disputes /> : <Bans />}
          </>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- tournaments

function Tournaments({ canManage, initial }: { canManage: boolean; initial: string | null }) {
  const t = useTranslations("esportsDesk");
  const locale = useLocale();
  const [selected, setSelected] = useState<string | null>(initial);
  const [creating, setCreating] = useState(false);
  const q = useQuery({ queryKey: ["esd-list"], queryFn: () => esportsAdmin.list(), refetchInterval: 30_000 });
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div>
        {canManage ? (
          <button type="button" className={`${btn} w-full border-brand`} onClick={() => (setCreating(true), setSelected(null))} data-testid="new-tournament">
            {t("new")}
          </button>
        ) : null}
        <ul className="mt-3 divide-y-2 divide-line border-y-2 border-line" data-testid="tournament-list">
          {(q.data?.items ?? []).map((x) => (
            <li key={x.id}>
              <button type="button" onClick={() => (setSelected(x.id), setCreating(false))} className={`w-full px-2 py-3 text-left hover:bg-surface-2 ${selected === x.id ? "bg-surface-2" : ""}`}>
                <span className="flex items-center gap-2">
                  <span className="font-semibold">{x.titleEn}</span>
                  <span className="ml-auto">
                    <Chip tone={TONE[x.status] ?? "muted"}>{t(`status.${x.status}`)}</Chip>
                  </span>
                </span>
                <span className="block text-xs text-muted">
                  {formatDhaka(x.startsAt, locale)} · {t("slotsShort", { taken: x.slotsTaken, max: x.maxSlots })}
                </span>
              </button>
            </li>
          ))}
          {q.data && !q.data.items.length ? <li className="py-4 text-sm text-muted">{t("none")}</li> : null}
        </ul>
      </div>
      <div>{creating ? <CreateForm onCreated={(id) => (setCreating(false), setSelected(id))} /> : selected ? <TournamentPane key={selected} id={selected} canManage={canManage} /> : <p className="text-muted">{t("pick")}</p>}</div>
    </div>
  );
}

type Game = { id: string; key: string; nameEn: string; modes: { id: string; key: string; nameEn: string; teamSize: number; maxTeams: number }[]; maps: { id: string; nameEn: string }[]; presets: { id: string; key: string; nameEn: string }[] };

/**
 * A tournament draft. Staff create Kriraghor's own; the M22 organiser console passes its client and
 * `organiser` (a per-kill reward then needs the most paid kills, and nothing is featured).
 */
export function CreateForm({ onCreated, client = esportsAdmin, organiser = false }: { onCreated: (id: string) => void; client?: DeskClient; organiser?: boolean }) {
  const t = useTranslations("esportsDesk");
  const qc = useQueryClient();
  const cat = useQuery({ queryKey: ["esd-catalog"], queryFn: () => client.catalog() });
  const games = (cat.data?.items ?? []) as unknown as Game[];
  const [gameId, setGameId] = useState("");
  const g = games.find((x) => x.id === gameId);
  const [f, setF] = useState({ modeId: "", titleEn: "", titleBn: "", tier: "daily", format: "single_match", fee: "50", slots: "48", min: "12", killReward: "0", maxPaidKills: "", presetId: "", opens: "", rulesMd: "", featured: false, inviteOnly: false });
  const [prizes, setPrizes] = useState(["1000", "600", "300"]);
  const [matches, setMatches] = useState([{ mapId: "", at: "" }]);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fee = toPoisha(f.fee);
    const prizeAmounts = prizes.map(toPoisha);
    if (fee === null || prizeAmounts.some((p) => p === null) || toPoisha(f.killReward) === null) return setError(t("form.badMoney"));
    const body: TournamentInput = {
      gameId,
      modeId: f.modeId,
      titleEn: f.titleEn,
      titleBn: f.titleBn,
      tier: f.tier as TournamentInput["tier"],
      format: matches.length > 1 ? "series" : "single_match",
      entryFee: fee,
      maxSlots: Number(f.slots),
      minParticipants: Number(f.min),
      prizes: prizeAmounts.map((amount, i) => ({ place: i + 1, amount: amount! })),
      killReward: toPoisha(f.killReward)!,
      ...(organiser && f.maxPaidKills ? { maxPaidKills: Number(f.maxPaidKills) } : {}),
      ...(f.presetId ? { pointsPresetId: f.presetId } : {}),
      registrationOpensAt: dhakaIso(f.opens),
      matches: matches.map((m) => ({ mapId: m.mapId, startsAt: dhakaIso(m.at) })),
      rulesMd: f.rulesMd,
      featured: organiser ? false : f.featured,
      // M23: a big event's final admits only qualified or invited entries (Kriraghor's own tournaments only).
      ...(organiser ? {} : { entryPolicy: f.inviteOnly ? ("invite" as const) : ("open" as const) }),
    };
    try {
      const created = await client.create(body);
      await qc.invalidateQueries({ queryKey: ["esd-list"] });
      onCreated(created.id);
    } catch (err) {
      setError(problemOf(err)?.title ?? t("failed"));
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 border-2 border-line bg-surface p-5" data-testid="create-tournament">
      <h2 className="text-xl font-extrabold">{t("new")}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("form.game")}>
          <select value={gameId} onChange={(e) => (setGameId(e.target.value), set("modeId", ""), set("presetId", ""))} className={inputCls} required>
            <option value="">—</option>
            {games.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nameEn}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("form.mode")}>
          <select value={f.modeId} onChange={(e) => set("modeId", e.target.value)} className={inputCls} required>
            <option value="">—</option>
            {(g?.modes ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.nameEn} ({m.teamSize}×{m.maxTeams})
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("form.preset")}>
          <select value={f.presetId} onChange={(e) => set("presetId", e.target.value)} className={inputCls} required>
            <option value="">—</option>
            {(g?.presets ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nameEn}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("form.titleEn")}>
          <input value={f.titleEn} onChange={(e) => set("titleEn", e.target.value)} className={inputCls} required minLength={3} maxLength={120} />
        </Field>
        <Field label={t("form.titleBn")}>
          <input value={f.titleBn} onChange={(e) => set("titleBn", e.target.value)} className={inputCls} required minLength={2} maxLength={160} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        <Field label={t("form.tier")}>
          <select value={f.tier} onChange={(e) => set("tier", e.target.value)} className={inputCls}>
            {["daily", "weekly", "monthly", "major"].map((x) => (
              <option key={x} value={x}>
                {t(`tier.${x}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("form.fee")}>
          <input value={f.fee} onChange={(e) => set("fee", e.target.value)} className={inputCls} inputMode="decimal" required />
        </Field>
        <Field label={t("form.slots")}>
          <input value={f.slots} onChange={(e) => set("slots", e.target.value)} className={inputCls} inputMode="numeric" required />
        </Field>
        <Field label={t("form.min")}>
          <input value={f.min} onChange={(e) => set("min", e.target.value)} className={inputCls} inputMode="numeric" required />
        </Field>
        <Field label={t("form.killReward")}>
          <input value={f.killReward} onChange={(e) => set("killReward", e.target.value)} className={inputCls} inputMode="decimal" />
        </Field>
      </div>
      {organiser ? (
        <Field label={t("form.maxPaidKills")}>
          <input value={f.maxPaidKills} onChange={(e) => set("maxPaidKills", e.target.value.replace(/[^0-9]/g, ""))} className={inputCls} inputMode="numeric" data-testid="max-paid-kills" />
        </Field>
      ) : null}
      <fieldset className="border-2 border-line p-3">
        <legend className="px-1 font-bold">{t("form.prizes")}</legend>
        <div className="flex flex-wrap gap-2">
          {prizes.map((p, i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              #{i + 1}
              <input value={p} onChange={(e) => setPrizes(prizes.map((x, j) => (j === i ? e.target.value : x)))} className={`${inputCls} w-28`} inputMode="decimal" aria-label={t("form.place", { n: i + 1 })} />
            </label>
          ))}
          <button type="button" className={`${btn} border-line`} onClick={() => setPrizes([...prizes, "100"])}>
            +
          </button>
          {prizes.length > 1 ? (
            <button type="button" className={`${btn} border-line`} onClick={() => setPrizes(prizes.slice(0, -1))}>
              −
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-muted">{t("form.prizesHelp")}</p>
      </fieldset>
      <Field label={t("form.opens")}>
        <input type="datetime-local" value={f.opens} onChange={(e) => set("opens", e.target.value)} className={inputCls} required />
      </Field>
      <fieldset className="border-2 border-line p-3">
        <legend className="px-1 font-bold">{t("form.matches")}</legend>
        {matches.map((m, i) => (
          <div key={i} className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <select value={m.mapId} onChange={(e) => setMatches(matches.map((x, j) => (j === i ? { ...x, mapId: e.target.value } : x)))} className={inputCls} aria-label={t("form.map")} required>
              <option value="">{t("form.map")}</option>
              {(g?.maps ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nameEn}
                </option>
              ))}
            </select>
            <input type="datetime-local" value={m.at} onChange={(e) => setMatches(matches.map((x, j) => (j === i ? { ...x, at: e.target.value } : x)))} className={inputCls} aria-label={t("form.startsAt")} required />
            {matches.length > 1 ? (
              <button type="button" className={`${btn} border-line`} onClick={() => setMatches(matches.filter((_, j) => j !== i))}>
                −
              </button>
            ) : null}
          </div>
        ))}
        <button type="button" className={`${btn} mt-2 border-line`} onClick={() => setMatches([...matches, { mapId: "", at: "" }])}>
          {t("form.addMatch")}
        </button>
      </fieldset>
      <Field label={t("form.rules")}>
        <textarea value={f.rulesMd} onChange={(e) => set("rulesMd", e.target.value)} className={`${inputCls} min-h-24 py-2`} maxLength={10000} />
      </Field>
      {organiser ? null : (
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" className="h-5 w-5" checked={f.featured} onChange={(e) => set("featured", e.target.checked)} />
          {t("form.featured")}
        </label>
      )}
      {organiser ? null : (
        <label className="flex min-h-11 items-center gap-2" data-testid="invite-only">
          <input type="checkbox" className="h-5 w-5" checked={f.inviteOnly} onChange={(e) => set("inviteOnly", e.target.checked)} />
          {t("form.inviteOnly")}
        </label>
      )}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div>
        <button type="submit" className={`${btn} border-brand`}>
          {t("form.save")}
        </button>
      </div>
    </form>
  );
}

function TournamentPane({ id, canManage }: { id: string; canManage: boolean }) {
  const t = useTranslations("esportsDesk");
  const locale = useLocale();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["esd-t", id], queryFn: () => esportsAdmin.get(id), refetchInterval: 30_000 });
  const [sub, setSub] = useState<"board" | "matches" | "finalise" | "streams">("board");
  const [problem, setProblem] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"cancel" | "finalise" | null>(null);
  const [reason, setReason] = useState("");
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["esd-t", id] });
    await qc.invalidateQueries({ queryKey: ["esd-list"] });
  };
  if (q.isPending) return <div className="h-60 animate-pulse bg-surface-2" />;
  if (q.isError) return <Notice tone="error">{t("loadFailed")}</Notice>;
  const d = q.data as typeof q.data & { settlement?: { collected: number; paid: number; subsidy: number; fee: number } | null; submissionId?: string | null };
  const run = async (fn: () => Promise<unknown>) => {
    setProblem(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setProblem(problemOf(err)?.title ?? t("failed"));
    }
  };

  return (
    <section className="border-2 border-line bg-surface p-5" data-testid="tournament-pane">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-extrabold">{d.titleEn}</h2>
        <Chip tone={TONE[d.status] ?? "muted"}>{t(`status.${d.status}`)}</Chip>
      </div>
      <p className="mt-1 text-sm text-muted">
        {d.game?.nameEn} · {d.mode?.nameEn} · {formatDhaka(d.startsAt, locale)} · {t("feeShort", { fee: formatTaka(d.entryFee.amount, locale) })} · {t("prizeShort", { pool: formatTaka(d.prizePool.amount, locale) })} · {t("slotsShort", { taken: d.slotsTaken, max: d.maxSlots })}
      </p>
      {canManage ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {d.status === "draft" ? (
            <button type="button" className={`${btn} border-brand`} onClick={() => void run(() => esportsAdmin.submit(id))} data-testid="submit-review">
              {t("submit")}
            </button>
          ) : null}
          {d.status === "review" ? <span className="text-sm text-muted">{t("inReview")}</span> : null}
          {!["finalised", "paid_out", "cancelled"].includes(d.status) ? (
            <button type="button" className={`${btn} border-danger text-danger`} onClick={() => setDialog("cancel")}>
              {t("cancel")}
            </button>
          ) : null}
        </div>
      ) : null}
      {problem ? (
        <div className="mt-3">
          <Notice tone="error">{problem}</Notice>
        </div>
      ) : null}
      {d.settlement ? (
        <p className="mt-3 text-sm">
          {t("settled", { collected: formatTaka(d.settlement.collected, locale), paid: formatTaka(d.settlement.paid, locale), subsidy: formatTaka(d.settlement.subsidy, locale), revenue: formatTaka(d.settlement.fee, locale) })}
        </p>
      ) : null}

      <div role="tablist" className="mt-5 flex flex-wrap gap-2 border-b-2 border-line">
        {(["board", "matches", "finalise", "streams"] as const).filter((k) => canManage || k === "matches").map((k) => (
          <button key={k} type="button" role="tab" aria-selected={sub === k} onClick={() => setSub(k)} className={`min-h-11 border-b-4 px-3 text-sm font-bold ${sub === k ? "border-brand" : "border-transparent text-muted"}`}>
            {t(`sub.${k}`)}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {sub === "board" && canManage ? <CheckinBoard id={id} /> : null}
        {sub === "matches" || !canManage ? <Matches matches={d.matches as { id: string; seq: number; status: string; startsAt: string }[]} canManage={canManage} onChange={refresh} /> : null}
        {sub === "finalise" && canManage ? <Finalise id={id} status={d.status} onFinalise={() => setDialog("finalise")} /> : null}
        {sub === "streams" && canManage ? <Streams id={id} current={d.streams as { platform: string; url: string; title: string; isLive: boolean }[]} onSaved={refresh} /> : null}
      </div>

      {dialog === "cancel" ? (
        <CodeDialog
          title={t("cancelTitle")}
          help={t("cancelHelp")}
          onClose={() => setDialog(null)}
          onConfirm={async (code) => {
            if (reason.trim().length < 5) throw { code: "VALIDATION_FAILED", title: t("reasonNeeded"), status: 422 };
            const token = await stepUp(code, "esports.money");
            await esportsAdmin.cancel(id, reason.trim(), token);
            setDialog(null);
            setReason("");
            await refresh();
          }}
        >
          <label htmlFor="cancel-reason" className="mt-4 block text-sm font-semibold text-muted">
            {t("reason")}
          </label>
          <input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} className={`${inputCls} mt-1 w-full`} />
        </CodeDialog>
      ) : null}
      {dialog === "finalise" ? (
        <CodeDialog
          title={t("finaliseTitle")}
          help={t("finaliseHelp")}
          onClose={() => setDialog(null)}
          onConfirm={async (code) => {
            const token = await stepUp(code, "esports.money");
            await esportsAdmin.finalise(id, token);
            setDialog(null);
            await refresh();
            await qc.invalidateQueries({ queryKey: ["esd-preview", id] });
          }}
        />
      ) : null}
    </section>
  );
}

type BoardItem = { id: string; slotNo: number | null; status: string; waitlistPosition: number | null; players: { userId: string; ign: string | null; username: string | null; isSubstitute: boolean; checkedIn: boolean }[] };

export function CheckinBoard({ id, client = esportsAdmin }: { id: string; client?: DeskClient }) {
  const t = useTranslations("esportsDesk");
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["esd-board", id], queryFn: () => client.board(id), refetchInterval: 15_000 });
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setMsg(null);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["esd-board", id] });
    } catch (err) {
      setMsg(problemOf(err)?.title ?? t("failed"));
    }
  };
  const items = (q.data?.items ?? []) as unknown as BoardItem[];
  return (
    <div>
      {msg ? <Notice tone="error">{msg}</Notice> : null}
      <div className="overflow-x-auto border-2 border-line">
        <table className="w-full min-w-[640px] text-sm" data-testid="checkin-board">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">{t("board.slot")}</th>
              <th className="px-3 py-2">{t("board.players")}</th>
              <th className="px-3 py-2">{t("board.status")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-t border-line align-top">
                <td className="px-3 py-2 font-mono">{r.slotNo ?? (r.waitlistPosition ? `W${r.waitlistPosition}` : "–")}</td>
                <td className="px-3 py-2">
                  {r.players.map((p) => (
                    <span key={p.userId} className="mr-3 inline-flex items-center gap-1">
                      <span className={p.checkedIn ? "font-semibold" : "text-muted"}>{p.ign ?? p.username ?? "—"}</span>
                      {p.isSubstitute ? <span className="text-xs text-muted">({t("board.sub")})</span> : null}
                      {p.checkedIn ? (
                        <span aria-label={t("board.in")}>✓</span>
                      ) : client.staffCheckIn && ["confirmed", "no_show"].includes(r.status) ? (
                        <button type="button" className="text-xs font-semibold text-brand underline" onClick={() => void run(() => client.staffCheckIn!(r.id, p.userId))}>
                          {t("board.checkIn")}
                        </button>
                      ) : null}
                    </span>
                  ))}
                </td>
                <td className="px-3 py-2">{t(`reg.${r.status}`)}</td>
                <td className="px-3 py-2 text-right">
                  {client.disqualify && ["confirmed", "checked_in", "no_show"].includes(r.status) ? (
                    <button
                      type="button"
                      className="text-xs font-semibold text-danger underline"
                      onClick={() => {
                        const note = window.prompt(t("board.dqNote"));
                        if (note && note.trim().length >= 5) void run(() => client.disqualify!(r.id, { reasonCode: "cheating", note: note.trim() }));
                      }}
                    >
                      {t("board.dq")}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Matches({ matches, canManage, onChange, client = esportsAdmin }: { matches: { id: string; seq: number; status: string; startsAt: string }[]; canManage: boolean; onChange: () => Promise<void>; client?: DeskClient }) {
  const t = useTranslations("esportsDesk");
  const locale = useLocale();
  const [open, setOpen] = useState<string | null>(matches[0]?.id ?? null);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {matches.map((m) => (
          <button key={m.id} type="button" onClick={() => setOpen(m.id)} className={`${btn} ${open === m.id ? "border-brand" : "border-line"}`}>
            {t("match", { n: m.seq })} · {t(`mstatus.${m.status}`)} · {formatDhaka(m.startsAt, locale)}
          </button>
        ))}
      </div>
      {open ? <MatchPanel key={open} id={open} canManage={canManage} onChange={onChange} client={client} /> : null}
    </div>
  );
}

type Entry = { registrationId: string; name: string; players: { userId: string; ign: string | null }[] };

export function MatchPanel({ id, canManage, onChange, client = esportsAdmin }: { id: string; canManage: boolean; onChange: () => Promise<void>; client?: DeskClient }) {
  const t = useTranslations("esportsDesk");
  const locale = useLocale();
  const qc = useQueryClient();
  const m = useQuery({ queryKey: ["esd-match", id], queryFn: () => client.match(id) });
  const room = useQuery({ queryKey: ["esd-room", id], enabled: canManage, queryFn: () => client.room(id) });
  const [roomId, setRoomId] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const [table, setTable] = useState<Record<string, { placement: string; kills: Record<string, string> }>>({});
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["esd-match", id] });
    await qc.invalidateQueries({ queryKey: ["esd-room", id] });
    await onChange();
  };
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ text: done, tone: "info" });
      await refresh();
    } catch (err) {
      setMsg({ text: problemOf(err)?.title ?? t("failed"), tone: "error" });
    }
  };
  if (m.isPending) return <div className="mt-4 h-40 animate-pulse bg-surface-2" />;
  if (m.isError) return <Notice tone="error">{t("loadFailed")}</Notice>;
  const data = m.data as unknown as { status: string; entries: (Entry & { name: string })[]; results: { registrationId: string; placement: number | null; players: { userId: string; kills: number }[]; status: string }[] };
  const editable = ["scheduled", "room_ready", "room_revealed", "live"].includes(data.status);
  const cell = (regId: string) => table[regId] ?? (() => {
    const r = data.results.find((x) => x.registrationId === regId);
    return { placement: r?.placement ? String(r.placement) : "", kills: Object.fromEntries((r?.players ?? []).map((p) => [p.userId, String(p.kills)])) };
  })();
  const rows = (): ResultRow[] =>
    data.entries.map((e) => {
      const c = cell(e.registrationId);
      return { registrationId: e.registrationId, placement: c.placement ? Number(c.placement) : null, kills: e.players.map((p) => ({ userId: p.userId, kills: Number(c.kills[p.userId] || 0) })) };
    });
  const local = resultsProblem(rows().map((r) => ({ placement: r.placement, kills: r.kills.map((k) => k.kills) })));
  const roomData = room.data as unknown as { current: { version: number; status: string; revealAt: string } | null; views: number } | undefined;

  return (
    <div className="mt-4 space-y-6">
      {canManage ? (
        <div className="border-2 border-line p-4" data-testid="room-panel">
          <h3 className="font-bold">{t("room.title")}</h3>
          <p className="mt-1 text-sm text-muted">
            {roomData?.current ? t("room.current", { version: roomData.current.version, status: t(`room.${roomData.current.status}`), at: formatDhaka(roomData.current.revealAt, locale) }) : t("room.none")} · {t("room.views", { n: roomData?.views ?? 0 })}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto_auto]">
            <input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder={t("room.id")} aria-label={t("room.id")} className={inputCls} autoComplete="off" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("room.password")} aria-label={t("room.password")} className={inputCls} autoComplete="off" />
            {!roomData?.current || roomData.current.status === "scheduled" ? (
              <button type="button" className={`${btn} border-brand`} disabled={!roomId || !password} onClick={() => void run(() => client.setRoom(id, { roomId, password }), t("room.saved")).then(() => (setRoomId(""), setPassword("")))}>
                {t("room.save")}
              </button>
            ) : (
              <button type="button" className={`${btn} border-danger text-danger`} disabled={!roomId || !password} onClick={() => void run(() => client.rotate(id, { roomId, password }), t("room.rotated")).then(() => (setRoomId(""), setPassword("")))}>
                {t("room.rotate")}
              </button>
            )}
            {client.revealNow && roomData?.current?.status === "scheduled" ? (
              <button type="button" className={`${btn} border-line`} onClick={() => void run(() => client.revealNow!(id), t("room.revealed"))}>
                {t("room.revealNow")}
              </button>
            ) : null}
            {client.cancelMatch && editable ? (
              <button
                type="button"
                className={`${btn} border-line`}
                onClick={() => {
                  const why = window.prompt(t("cancelMatchReason"));
                  if (why && why.trim().length >= 5) void run(() => client.cancelMatch!(id, why.trim()), t("matchCancelled"));
                }}
              >
                {t("cancelMatch")}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div>
        <h3 className="font-bold">{t("results.title")}</h3>
        <div className="mt-2 overflow-x-auto border-2 border-line">
          <table className="w-full min-w-[560px] text-sm" data-testid="results-table">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2">{t("results.entry")}</th>
                <th className="px-3 py-2">{t("results.placement")}</th>
                <th className="px-3 py-2">{t("results.kills")}</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => {
                const c = cell(e.registrationId);
                return (
                  <tr key={e.registrationId} className="border-t border-line">
                    <td className="px-3 py-2 font-semibold">{e.name}</td>
                    <td className="px-3 py-2">
                      <input value={c.placement} disabled={!editable} onChange={(ev) => setTable({ ...table, [e.registrationId]: { ...c, placement: ev.target.value } })} inputMode="numeric" className={`${inputCls} w-20`} aria-label={t("results.placementFor", { name: e.name })} placeholder={t("results.dnp")} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {e.players.map((p) => (
                          <label key={p.userId} className="flex items-center gap-1 text-xs">
                            {p.ign ?? "—"}
                            <input value={c.kills[p.userId] ?? ""} disabled={!editable} onChange={(ev) => setTable({ ...table, [e.registrationId]: { ...c, kills: { ...c.kills, [p.userId]: ev.target.value } } })} inputMode="numeric" className={`${inputCls} w-16`} />
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {editable ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className={`${btn} border-line`} disabled={Boolean(local)} onClick={() => void run(() => client.enter(id, rows()), t("results.saved"))}>
              {t("results.save")}
            </button>
            <button
              type="button"
              className={`${btn} border-brand`}
              disabled={Boolean(local)}
              onClick={() => {
                if (window.confirm(t("results.postConfirm"))) void run(async () => (await client.enter(id, rows()), await client.post(id)), t("results.posted"));
              }}
              data-testid="post-results"
            >
              {t("results.post")}
            </button>
            {local ? <span className="text-sm text-danger">{t(`results.problem.${local}`)}</span> : null}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">{t(`mstatusHelp.${data.status}`)}</p>
        )}
        {msg ? (
          <div className="mt-3">
            <Notice tone={msg.tone}>{msg.text}</Notice>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Finalise({ id, status, onFinalise, client = esportsAdmin, totals = ["collected", "paid", "subsidy", "revenue"] }: { id: string; status: string; onFinalise: () => void; client?: DeskClient; totals?: string[] }) {
  const t = useTranslations("esportsDesk");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["esd-preview", id], queryFn: () => client.preview(id) });
  if (q.isPending) return <div className="h-32 animate-pulse bg-surface-2" />;
  if (q.isError) return <Notice tone="error">{t("loadFailed")}</Notice>;
  const p = q.data as unknown as { finalisable: boolean; awards: { registrationId: string; entry: { name: string } | null; kind: string; place: number | null; amount: { amount: number }; shares: { userId: string; amount: { amount: number } }[] }[]; totals: Record<string, { amount: number }> };
  return (
    <div>
      <ul className="divide-y-2 divide-line border-y-2 border-line" data-testid="finalise-preview">
        {p.awards.map((a) => (
          <li key={`${a.registrationId}-${a.kind}`} className="flex flex-wrap items-center gap-3 py-2 text-sm">
            <span className="font-semibold">{a.entry?.name ?? "—"}</span>
            <span className="text-muted">{a.kind === "place" ? t("placeN", { n: a.place ?? 0 }) : t("killReward")}</span>
            <span className="ml-auto font-bold tabular-nums">{formatTaka(a.amount.amount, locale)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {totals.map((k) => (
          <div key={k}>
            <dt className="text-muted">{t(`totals.${k}`)}</dt>
            <dd className="font-bold tabular-nums">{formatTaka(p.totals[k]?.amount ?? 0, locale)}</dd>
          </div>
        ))}
      </dl>
      {status === "paid_out" ? (
        <p className="mt-4 font-semibold text-brand">{t("paidOut")}</p>
      ) : (
        <button type="button" className={`${btn} mt-4 border-brand`} disabled={!p.finalisable} onClick={onFinalise} data-testid="finalise">
          {p.finalisable ? t("finalise") : t("notFinalisable")}
        </button>
      )}
    </div>
  );
}

function Streams({ id, current, onSaved }: { id: string; current: { platform: string; url: string; title: string; isLive: boolean }[]; onSaved: () => Promise<void> }) {
  const t = useTranslations("esportsDesk");
  const [rows, setRows] = useState(current.length ? current : [{ platform: "youtube", url: "", title: "", isLive: false }]);
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[140px_1fr_1fr_auto]">
          <select value={r.platform} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, platform: e.target.value } : x)))} className={inputCls} aria-label={t("streams.platform")}>
            {["youtube", "facebook", "tiktok", "other"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input value={r.url} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="https://" className={inputCls} aria-label={t("streams.url")} />
          <input value={r.title} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder={t("streams.title")} className={inputCls} aria-label={t("streams.title")} />
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={r.isLive} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, isLive: e.target.checked } : x)))} />
            {t("streams.live")}
          </label>
        </div>
      ))}
      <div className="flex gap-2">
        <button type="button" className={`${btn} border-line`} onClick={() => setRows([...rows, { platform: "youtube", url: "", title: "", isLive: false }])}>
          +
        </button>
        <button
          type="button"
          className={`${btn} border-brand`}
          onClick={async () => {
            setMsg(null);
            try {
              await esportsAdmin.streams(id, rows.filter((r) => r.url).map((r) => ({ ...r, platform: r.platform as "youtube" })));
              setMsg({ text: t("streams.saved"), tone: "info" });
              await onSaved();
            } catch (err) {
              setMsg({ text: problemOf(err)?.title ?? t("failed"), tone: "error" });
            }
          }}
        >
          {t("streams.save")}
        </button>
      </div>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
    </div>
  );
}

// ---------------------------------------------------------------- disputes and bans

function Disputes() {
  const t = useTranslations("esportsDesk");
  const locale = useLocale();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["esd-disputes"], queryFn: () => esportsAdmin.disputes(), refetchInterval: 30_000 });
  const [msg, setMsg] = useState<string | null>(null);
  const items = (q.data?.items ?? []) as unknown as { id: string; matchId: string; reason: string; createdAt: string; entry: { name: string } | null }[];
  return (
    <div className="mt-6 max-w-4xl">
      {msg ? <Notice tone="error">{msg}</Notice> : null}
      <p className="mb-3 text-sm">
        {t("disputes.unifiedDesk")}{" "}
        <Link href="/admin/disputes" className="font-semibold text-brand underline">
          {t("disputes.openDesk")}
        </Link>
      </p>
      <ul className="divide-y-2 divide-line border-y-2 border-line" data-testid="disputes">
        {items.map((d) => (
          <li key={d.id} className="py-3">
            <p className="font-semibold">
              {d.entry?.name ?? "—"} <span className="text-sm font-normal text-muted">· {formatDhaka(d.createdAt, locale)}</span>
            </p>
            <p className="mt-1 text-sm">{d.reason}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className={`${btn} border-line`}
                onClick={async () => {
                  const note = window.prompt(t("disputes.rejectNote"));
                  if (!note || note.trim().length < 3) return;
                  try {
                    await esportsAdmin.resolve(d.id, { outcome: "rejected", note: note.trim() });
                    await qc.invalidateQueries({ queryKey: ["esd-disputes"] });
                  } catch (err) {
                    setMsg(problemOf(err)?.title ?? t("failed"));
                  }
                }}
              >
                {t("disputes.reject")}
              </button>
              <span className="self-center text-xs text-muted">{t("disputes.correctHelp")}</span>
            </div>
          </li>
        ))}
        {q.data && !items.length ? <li className="py-4 text-muted">{t("disputes.none")}</li> : null}
      </ul>
    </div>
  );
}

function Bans() {
  const t = useTranslations("esportsDesk");
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["esd-bans"], queryFn: () => esportsAdmin.bans() });
  const cat = useQuery({ queryKey: ["esd-catalog"], queryFn: () => esportsAdmin.catalog() });
  const games = (cat.data?.items ?? []) as unknown as { id: string; nameEn: string }[];
  const [f, setF] = useState({ gameId: "", uid: "", reasonCode: "cheating", note: "" });
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const items = (q.data?.items ?? []) as unknown as { id: string; gameId: string; uid: string; reasonCode: string; note: string }[];
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <ul className="divide-y-2 divide-line border-y-2 border-line" data-testid="bans">
        {items.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
            <span className="font-mono font-bold">{b.uid}</span>
            <span className="text-muted">{games.find((g) => g.id === b.gameId)?.nameEn}</span>
            <Chip tone="bad">{b.reasonCode}</Chip>
            <span className="text-muted">{b.note}</span>
            <button
              type="button"
              className="ml-auto text-sm font-semibold text-brand underline"
              onClick={async () => {
                const reason = window.prompt(t("bans.liftReason"));
                if (!reason || reason.trim().length < 3) return;
                await esportsAdmin.lift(b.id, reason.trim());
                await qc.invalidateQueries({ queryKey: ["esd-bans"] });
              }}
            >
              {t("bans.lift")}
            </button>
          </li>
        ))}
        {q.data && !items.length ? <li className="py-4 text-muted">{t("bans.none")}</li> : null}
      </ul>
      <form
        className="grid gap-3 border-2 border-line bg-surface p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setMsg(null);
          try {
            await esportsAdmin.ban({ ...f, reasonCode: f.reasonCode as "cheating" });
            setF({ ...f, uid: "", note: "" });
            setMsg({ text: t("bans.done"), tone: "info" });
            await qc.invalidateQueries({ queryKey: ["esd-bans"] });
          } catch (err) {
            setMsg({ text: problemOf(err)?.title ?? t("failed"), tone: "error" });
          }
        }}
      >
        <p className="font-bold">{t("bans.new")}</p>
        <select value={f.gameId} onChange={(e) => setF({ ...f, gameId: e.target.value })} className={inputCls} aria-label={t("form.game")} required>
          <option value="">{t("form.game")}</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nameEn}
            </option>
          ))}
        </select>
        <input value={f.uid} onChange={(e) => setF({ ...f, uid: e.target.value })} placeholder="UID" aria-label="UID" className={inputCls} required />
        <select value={f.reasonCode} onChange={(e) => setF({ ...f, reasonCode: e.target.value })} className={inputCls} aria-label={t("reason")}>
          {["cheating", "hacking", "account_sharing", "abuse", "other"].map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder={t("bans.note")} aria-label={t("bans.note")} className={`${inputCls} min-h-20 py-2`} minLength={5} required />
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
        <button type="submit" className={`${btn} border-danger text-danger`}>
          {t("bans.ban")}
        </button>
      </form>
    </div>
  );
}

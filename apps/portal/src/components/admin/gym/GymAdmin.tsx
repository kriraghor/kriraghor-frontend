"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { formatTaka } from "@/lib/admin/finance";
import { gymAdmin, heldOf, type GymStatus, type StaffPass } from "@/lib/admin/gym";
import { stepUp } from "@/lib/admin/stepUp";
import { problemOf, type Problem } from "@kriraghor/api-client";
import { Notice } from "@kriraghor/ui/primitives";
import { AdminSubnav } from "../AdminSubnav";
import { CodeDialog } from "../CodeDialog";
import { formatDhaka, useAdminMe } from "../useAdminMe";
import { Chip, inputCls } from "../finance/shared";

const GYM_STATUSES = ["", "pending_review", "live", "paused", "suspended", "changes_requested", "rejected"] as const;
type Tone = "ok" | "warn" | "bad" | "muted";
const GYM_TONE: Record<string, Tone> = { live: "ok", pending_review: "warn", paused: "muted", suspended: "bad", changes_requested: "bad", rejected: "bad" };

/**
 * /admin/gym (M20): gyms (suspend with manage_users, restore for masters, with a reason; the review
 * itself is on the Moderation desk), a pass by its code with its escrow hold and a master's platform
 * cancel (refunds what is held; step-up escrow.manage), and a trainer subscription by its code.
 */
export function GymAdmin() {
  const t = useTranslations("gymAdmin");
  const [tab, setTab] = useState<"gyms" | "passes" | "subscriptions">("gyms");
  return (
    <>
      <AdminSubnav />
      <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-8">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t("intro")}</p>
        <div className="mt-6 flex gap-2" role="tablist">
          {(["gyms", "passes", "subscriptions"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-11 border-2 px-4 font-bold ${tab === k ? "border-brand bg-brand text-white" : "border-line"}`} data-testid={`gym-tab-${k}`}>
              {t(`tab.${k}`)}
            </button>
          ))}
        </div>
        {tab === "gyms" ? <Gyms /> : tab === "passes" ? <Passes /> : <Subscriptions />}
      </div>
    </>
  );
}

function Gyms() {
  const t = useTranslations("gymAdmin");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready, me } = useAdminMe();
  const [status, setStatus] = useState<(typeof GYM_STATUSES)[number]>("");
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [acting, setActing] = useState<{ id: string; name: string; action: "suspend" | "restore" } | null>(null);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const list = useQuery({ queryKey: ["admin-gyms", status, search], queryFn: () => gymAdmin.gyms({ status: (status || undefined) as GymStatus | undefined, q: search || undefined }), enabled: ready });
  const day = (g: { packages: { kind: string; price: number }[] }) => g.packages.find((p) => p.kind === "day")?.price;
  const isMaster = Boolean(me?.isMaster);
  const canSuspend = Boolean(me && (me.isMaster || me.permissions.includes("manage_users" as never)));

  async function act() {
    if (!acting) return;
    setProblem(null);
    if (reason.trim().length < 5) return setProblem({ code: "VALIDATION_FAILED", title: t("reasonNeeded"), status: 422 });
    try {
      await (acting.action === "suspend" ? gymAdmin.suspend(acting.id, reason.trim()) : gymAdmin.restore(acting.id, reason.trim()));
      setActing(null);
      setReason("");
      await qc.invalidateQueries({ queryKey: ["admin-gyms"] });
    } catch (err) {
      setProblem(problemOf(err));
    }
  }

  return (
    <>
      <form
        className="mt-6 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(text.trim());
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
          {t("name")}
          <input value={text} onChange={(e) => setText(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
          {t("status")}
          <select value={status} onChange={(e) => setStatus(e.target.value as (typeof GYM_STATUSES)[number])} className={inputCls}>
            {GYM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s ? t(`gymStatus.${s}`) : t("all")}
              </option>
            ))}
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
      <ul className="mt-6 flex flex-col gap-2" data-testid="admin-gyms">
        {list.isPending ? <li className="h-32 animate-pulse bg-surface-2" /> : null}
        {list.data && !list.data.items.length ? <li className="text-muted">{t("none")}</li> : null}
        {(list.data?.items ?? []).map((g) => (
          <li key={g.id} className="flex flex-wrap items-center gap-3 border-2 border-line p-3">
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{g.name}</span>
              <span className="block text-sm text-muted">
                {g.addressLine}
                {day(g) !== undefined ? ` · ${t("dayPass")} ${formatTaka(day(g)!, locale)}` : ""}
              </span>
            </span>
            <Chip tone={GYM_TONE[g.status] ?? "muted"}>{t(`gymStatus.${g.status}`)}</Chip>
            {canSuspend && (g.status === "live" || g.status === "paused") ? (
              <button type="button" onClick={() => setActing({ id: g.id, name: g.name, action: "suspend" })} className="min-h-11 border-2 border-danger px-3 text-sm font-bold text-danger">
                {t("suspend")}
              </button>
            ) : null}
            {g.status === "suspended" && isMaster ? (
              <button type="button" onClick={() => setActing({ id: g.id, name: g.name, action: "restore" })} className="min-h-11 border-2 border-brand px-3 text-sm font-bold">
                {t("restore")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {acting ? (
        <form
          className="mt-4 border-2 border-danger p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void act();
          }}
        >
          <p className="font-bold">{t(acting.action === "suspend" ? "suspendTitle" : "restoreTitle", { name: acting.name })}</p>
          <label htmlFor="gym-reason" className="mt-3 block text-sm font-semibold text-muted">
            {t("reason")}
          </label>
          <textarea id="gym-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={`${inputCls} mt-1 min-h-20 w-full py-2`} />
          {problem ? (
            <div className="mt-2">
              <Notice tone="error">{problem.title}</Notice>
            </div>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button type="submit" className="min-h-11 bg-danger px-4 font-bold text-white">
              {t(acting.action)}
            </button>
            <button type="button" onClick={() => setActing(null)} className="min-h-11 border-2 border-line px-4 font-bold">
              {t("close")}
            </button>
          </div>
        </form>
      ) : null}
    </>
  );
}

function Passes() {
  const t = useTranslations("gymAdmin");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready } = useAdminMe();
  const [code, setCode] = useState("");
  const [open, setOpen] = useState("");
  const [cancelling, setCancelling] = useState<StaffPass | null>(null);
  const [reason, setReason] = useState("");
  const q = useQuery({ queryKey: ["admin-gym-pass", open], queryFn: () => gymAdmin.pass(open), enabled: ready && Boolean(open), retry: false });
  const money = (n: number) => formatTaka(n, locale);
  const p = q.data;
  return (
    <>
      <form
        className="mt-6 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setOpen(code.trim().toUpperCase());
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
          {t("passCode")}
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="GP-26-000123" className={inputCls} data-testid="gym-pass-code" />
        </label>
        <button type="submit" className="min-h-11 border-2 border-brand bg-brand px-4 font-bold text-white">
          {t("find")}
        </button>
      </form>
      {q.isError ? (
        <div className="mt-4">
          <Notice tone="error">{problemOf(q.error)?.title ?? t("failed")}</Notice>
        </div>
      ) : null}
      {p ? (
        <div className="mt-6 border-2 border-line p-5" data-testid="gym-pass">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xl font-extrabold">{p.code}</span>
            <Chip tone={p.status === "active" ? "ok" : p.status === "refunded" || p.status === "cancelled" ? "bad" : "muted"}>{t(`passStatus.${p.status}`)}</Chip>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">{t("gym")}</dt>
            <dd>{p.gym?.name ?? "–"}</dd>
            <dt className="text-muted">{t("pass")}</dt>
            <dd>
              {t(`kind.${p.kind}`)} · {p.validFrom === p.validTo ? p.validFrom : `${p.validFrom} – ${p.validTo}`}
            </dd>
            <dt className="text-muted">{t("money")}</dt>
            <dd className="tabular-nums">{t("moneyLine", { price: money(p.money.price), fee: money(p.money.fee), net: money(p.money.net), released: money(p.money.released), refunded: money(p.money.refunded) })}</dd>
            <dt className="text-muted">{t("paidAt")}</dt>
            <dd>{p.paidAt ? formatDhaka(p.paidAt, locale) : "–"}</dd>
            <dt className="text-muted">{t("firstUse")}</dt>
            <dd>{p.firstRedeemedAt ? formatDhaka(p.firstRedeemedAt, locale) : "–"}</dd>
            <dt className="text-muted">{t("escrow")}</dt>
            <dd className="font-mono text-xs">{p.escrow ? JSON.stringify(p.escrow) : "–"}</dd>
          </dl>
          {p.status === "active" && heldOf(p) > 0 ? (
            <button type="button" onClick={() => setCancelling(p)} className="mt-4 min-h-11 border-2 border-danger px-4 font-bold text-danger" data-testid="gym-pass-cancel">
              {t("cancelPass", { amount: money(heldOf(p)) })}
            </button>
          ) : null}
        </div>
      ) : null}
      {cancelling ? (
        <CodeDialog
          title={t("cancelTitle", { code: cancelling.code })}
          help={t("cancelHelp", { amount: money(heldOf(cancelling)) })}
          onClose={() => setCancelling(null)}
          onConfirm={async (c) => {
            if (reason.trim().length < 5) throw { code: "VALIDATION_FAILED", title: t("reasonNeeded"), status: 422 };
            const token = await stepUp(c, "escrow.manage");
            await gymAdmin.cancelPass(cancelling.code, reason.trim(), token);
            setCancelling(null);
            await qc.invalidateQueries({ queryKey: ["admin-gym-pass", open] });
          }}
        >
          <label htmlFor="gym-cancel-reason" className="mt-4 block text-sm font-semibold text-muted">
            {t("reason")}
          </label>
          <textarea id="gym-cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={`${inputCls} mt-1 min-h-20 w-full py-2`} />
        </CodeDialog>
      ) : null}
    </>
  );
}

function Subscriptions() {
  const t = useTranslations("gymAdmin");
  const locale = useLocale();
  const { ready } = useAdminMe();
  const [code, setCode] = useState("");
  const [open, setOpen] = useState("");
  const q = useQuery({ queryKey: ["admin-gym-sub", open], queryFn: () => gymAdmin.subscription(open), enabled: ready && Boolean(open), retry: false });
  const money = (n: number) => formatTaka(n, locale);
  const s = q.data;
  return (
    <>
      <form
        className="mt-6 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setOpen(code.trim().toUpperCase());
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
          {t("subCode")}
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="TS-26-000123" className={inputCls} data-testid="gym-sub-code" />
        </label>
        <button type="submit" className="min-h-11 border-2 border-brand bg-brand px-4 font-bold text-white">
          {t("find")}
        </button>
      </form>
      {q.isError ? (
        <div className="mt-4">
          <Notice tone="error">{problemOf(q.error)?.title ?? t("failed")}</Notice>
        </div>
      ) : null}
      {s ? (
        <div className="mt-6 border-2 border-line p-5" data-testid="gym-sub">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xl font-extrabold">{s.code}</span>
            <Chip tone={s.status === "active" ? "ok" : s.status === "lapsed" ? "bad" : "muted"}>{t(`subStatus.${s.status}`)}</Chip>
          </div>
          <p className="mt-2 text-sm">
            {s.title} · {t("perMonth", { price: money(s.price) })} · {t("startedOn", { date: s.startedOn })}
            {s.paidThrough ? ` · ${t("paidThrough", { date: s.paidThrough })}` : ""}
          </p>
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-1">#</th>
                <th className="py-1">{t("period")}</th>
                <th className="py-1">{t("status")}</th>
                <th className="py-1 text-right">{t("price")}</th>
                <th className="py-1 text-right">{t("released")}</th>
                <th className="py-1 text-right">{t("refundedCol")}</th>
                <th className="py-1">{t("releaseAt")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {s.periods.map((p) => (
                <tr key={p.seq}>
                  <td className="py-1">{p.seq}</td>
                  <td className="py-1">
                    {p.periodStart} – {p.periodEnd}
                  </td>
                  <td className="py-1">{t(`periodStatus.${p.status}`)}</td>
                  <td className="py-1 text-right tabular-nums">{money(p.price)}</td>
                  <td className="py-1 text-right tabular-nums">{money(p.released)}</td>
                  <td className="py-1 text-right tabular-nums">{money(p.refunded)}</td>
                  <td className="py-1">{p.releaseAt ? formatDhaka(p.releaseAt, locale) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}

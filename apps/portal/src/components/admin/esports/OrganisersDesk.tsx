"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { formatTaka } from "@/lib/admin/finance";
import { contractBody, organisersAdmin, type Contract, type Invoice, type OrgStatus } from "@/lib/admin/organisers";
import { stepUp } from "@/lib/admin/stepUp";
import { problemOf } from "@kriraghor/api-client";
import { Notice } from "@kriraghor/ui/primitives";
import { AdminSubnav } from "../AdminSubnav";
import { CodeDialog } from "../CodeDialog";
import { formatDhaka, useAdminMe } from "../useAdminMe";
import { Chip, Field, inputCls } from "../finance/shared";

const STATUSES = ["", "pending_review", "verified", "suspended", "changes_requested", "rejected"] as const;
const TONE: Record<string, "ok" | "warn" | "bad" | "muted"> = { verified: "ok", pending_review: "warn", suspended: "bad", rejected: "bad", changes_requested: "bad", draft: "muted", active: "ok", ended: "muted", issued: "warn", overdue: "bad", paid: "ok", voided: "muted" };
const btn = "min-h-11 border-2 px-4 text-sm font-bold disabled:opacity-50";

/**
 * /admin/esports/organisers (M22): organisations (their review is on the Moderation desk), each with
 * its contracts (a draft, the signed PDF, activate / suspend / end with step-up esports.money) and
 * invoices (void with step-up). Suspending an organisation needs manage_organisers; restoring, a master.
 */
export function OrganisersDesk() {
  const t = useTranslations("organisersDesk");
  const { ready } = useAdminMe();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("");
  const [open, setOpen] = useState<string | null>(null);
  const list = useQuery({ queryKey: ["admin-orgs", status], queryFn: () => organisersAdmin.list({ status: (status || undefined) as OrgStatus | undefined }), enabled: ready });
  return (
    <>
      <AdminSubnav />
      <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-8">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t("intro")}</p>
        <div className="mt-6 flex flex-wrap gap-2" role="tablist">
          {STATUSES.map((s) => (
            <button key={s || "all"} type="button" role="tab" aria-selected={status === s} onClick={() => setStatus(s)} className={`${btn} ${status === s ? "border-brand" : "border-line text-muted"}`}>
              {s ? t(`status.${s}`) : t("all")}
            </button>
          ))}
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <ul className="flex flex-col gap-2" data-testid="admin-orgs">
            {list.isPending ? <li className="h-32 animate-pulse bg-surface-2" /> : null}
            {list.data && !list.data.items.length ? <li className="text-muted">{t("none")}</li> : null}
            {(list.data?.items ?? []).map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => setOpen(o.id)} className={`block w-full border-2 p-3 text-left ${open === o.id ? "border-brand" : "border-line hover:border-brand"}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-bold">{o.name}</span>
                    <Chip tone={TONE[o.status] ?? "muted"}>{t(`status.${o.status}`)}</Chip>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {open ? <OrgDetail key={open} id={open} /> : <p className="text-muted">{t("pick")}</p>}
        </div>
      </div>
    </>
  );
}

function OrgDetail({ id }: { id: string }) {
  const t = useTranslations("organisersDesk");
  const locale = useLocale();
  const qc = useQueryClient();
  const { me } = useAdminMe();
  const org = useQuery({ queryKey: ["admin-org", id], queryFn: () => organisersAdmin.get(id) });
  const contracts = useQuery({ queryKey: ["admin-org-contracts", id], queryFn: () => organisersAdmin.contracts(id) });
  const invoices = useQuery({ queryKey: ["admin-org-invoices", id], queryFn: () => organisersAdmin.invoices(id) });
  const [form, setForm] = useState(() => ({ model: "percentage" as "percentage" | "flat", pct: "", flatFee: "", billingCycle: "monthly" as "monthly" | "quarterly" | "per_tournament", startsOn: new Date(Date.now() + 6 * 3600000).toISOString().slice(0, 10), endsOn: "" }));
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const [dialog, setDialog] = useState<{ title: string; reason?: boolean; run: (token: string, reason: string) => Promise<unknown> } | null>(null);
  const [reason, setReason] = useState("");
  const canManage = Boolean(me && (me.isMaster || me.permissions.includes("manage_organisers" as never)));
  const refresh = async () => {
    for (const k of ["admin-org", "admin-org-contracts", "admin-org-invoices", "admin-orgs"]) await qc.invalidateQueries({ queryKey: [k] });
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
  if (org.isPending) return <div className="h-64 animate-pulse bg-surface-2" />;
  if (org.isError) return <Notice tone="error">{t("failed")}</Notice>;
  const o = org.data;
  const body = contractBody(form);

  return (
    <div className="space-y-6" data-testid="admin-org">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-extrabold">{o.name}</h2>
          <Chip tone={TONE[o.status] ?? "muted"}>{t(`status.${o.status}`)}</Chip>
        </div>
        {o.about ? <p className="mt-2 text-sm">{o.about}</p> : null}
        <p className="mt-2 text-sm text-muted">{t("members", { list: o.members.map((m) => `${m.name ?? "–"} (${m.role})`).join(", ") })}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {canManage && o.status === "verified" ? (
            <button
              type="button"
              className={`${btn} border-danger text-danger`}
              onClick={() => {
                const why = window.prompt(t("reason"));
                if (why && why.trim().length >= 5) void run(() => organisersAdmin.suspend(id, why.trim()), t("suspended"));
              }}
            >
              {t("suspend")}
            </button>
          ) : null}
          {me?.isMaster && o.status === "suspended" ? (
            <button
              type="button"
              className={`${btn} border-brand`}
              onClick={() => {
                const why = window.prompt(t("reason"));
                if (why && why.trim().length >= 5) void run(() => organisersAdmin.restore(id, why.trim()), t("restored"));
              }}
            >
              {t("restore")}
            </button>
          ) : null}
        </div>
      </div>

      <div>
        <h3 className="text-xl font-extrabold">{t("contracts")}</h3>
        <ul className="mt-2 flex flex-col gap-2" data-testid="admin-contracts">
          {((contracts.data?.items ?? []) as Contract[]).map((k) => (
            <li key={k.id} className="border-2 border-line p-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1 font-semibold">{k.model === "percentage" ? t("pct", { pct: k.effectivePct ?? 0 }) : t("flat", { fee: formatTaka(k.flatFee ?? 0, locale), cycle: t(`cycle.${k.billingCycle}`) })}</span>
                <span className="text-sm text-muted">
                  {k.startsOn}
                  {k.endsOn ? ` – ${k.endsOn}` : ""}
                </span>
                <Chip tone={TONE[k.status] ?? "muted"}>{t(`contractStatus.${k.status}`)}</Chip>
              </div>
              {canManage ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {k.status !== "ended" ? (
                    <label className="text-sm">
                      <span className="font-semibold text-muted">{k.hasSignedDocument ? t("replacePdf") : t("attachPdf")}</span>
                      <input
                        type="file"
                        accept="application/pdf"
                        className="ml-2 text-sm"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) void run(() => organisersAdmin.attachDocument(k.id, file), t("pdfSaved"));
                        }}
                      />
                    </label>
                  ) : null}
                  {["draft", "suspended"].includes(k.status) ? (
                    <button type="button" className={`${btn} border-brand`} disabled={!k.hasSignedDocument} onClick={() => setDialog({ title: t("activateTitle"), run: (token) => organisersAdmin.activate(k.id, token) })} data-testid="contract-activate">
                      {k.status === "draft" ? t("activate") : t("reinstate")}
                    </button>
                  ) : null}
                  {k.status === "active" ? (
                    <button type="button" className={`${btn} border-danger text-danger`} onClick={() => setDialog({ title: t("suspendContract"), reason: true, run: (token, why) => organisersAdmin.stop(k.id, "suspend", why, token) })}>
                      {t("suspendContract")}
                    </button>
                  ) : null}
                  {k.status !== "ended" ? (
                    <button type="button" className={`${btn} border-line`} onClick={() => setDialog({ title: t("endContract"), reason: true, run: (token, why) => organisersAdmin.stop(k.id, "end", why, token) })}>
                      {t("endContract")}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {canManage && o.status === "verified" ? (
          <form
            className="mt-4 grid gap-3 border-2 border-line p-4 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (body) void run(() => organisersAdmin.createContract(id, body), t("contractCreated"));
            }}
            data-testid="contract-form"
          >
            <Field label={t("model")}>
              <select value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value as "percentage" | "flat" })} className={inputCls}>
                <option value="percentage">{t("model_percentage")}</option>
                <option value="flat">{t("model_flat")}</option>
              </select>
            </Field>
            {form.model === "percentage" ? (
              <Field label={t("pctLabel")}>
                <input value={form.pct} onChange={(e) => setForm({ ...form, pct: e.target.value })} inputMode="decimal" placeholder={t("pctDefault")} className={inputCls} />
              </Field>
            ) : (
              <>
                <Field label={t("feeLabel")}>
                  <input value={form.flatFee} onChange={(e) => setForm({ ...form, flatFee: e.target.value })} inputMode="decimal" className={inputCls} required />
                </Field>
                <Field label={t("cycleLabel")}>
                  <select value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value as "monthly" | "quarterly" })} className={inputCls}>
                    <option value="monthly">{t("cycle.monthly")}</option>
                    <option value="quarterly">{t("cycle.quarterly")}</option>
                  </select>
                </Field>
              </>
            )}
            <Field label={t("startsOn")}>
              <input type="date" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} className={inputCls} required />
            </Field>
            <Field label={t("endsOn")}>
              <input type="date" value={form.endsOn} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} className={inputCls} />
            </Field>
            <div className="flex items-end">
              <button type="submit" className={`${btn} border-brand`} disabled={!body}>
                {t("createContract")}
              </button>
            </div>
          </form>
        ) : null}
      </div>

      <div>
        <h3 className="text-xl font-extrabold">{t("invoices")}</h3>
        {invoices.data && !invoices.data.items.length ? <p className="mt-2 text-muted">{t("noInvoices")}</p> : null}
        <ul className="mt-2 divide-y-2 divide-line border-y-2 border-line">
          {((invoices.data?.items ?? []) as Invoice[]).map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <span className="font-mono font-semibold">{i.number}</span>
              <span className="min-w-0 flex-1 text-muted">
                {i.periodStart} – {i.periodEnd}
                {i.dueAt ? ` · ${t("due", { at: formatDhaka(i.dueAt, locale) })}` : ""}
              </span>
              <span className="font-bold tabular-nums">{formatTaka(i.total, locale)}</span>
              <Chip tone={TONE[i.status] ?? "muted"}>{t(`invoiceStatus.${i.status}`)}</Chip>
              {canManage && ["issued", "overdue"].includes(i.status) ? (
                <button type="button" className="font-semibold text-danger underline" onClick={() => setDialog({ title: t("voidTitle", { number: i.number }), reason: true, run: (token, why) => organisersAdmin.voidInvoice(i.id, why, token) })}>
                  {t("void")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {dialog ? (
        <CodeDialog
          title={dialog.title}
          help={t("stepUpHelp")}
          onClose={() => setDialog(null)}
          onConfirm={async (c) => {
            if (dialog.reason && reason.trim().length < 5) throw { code: "VALIDATION_FAILED", title: t("reasonNeeded"), status: 422 };
            const token = await stepUp(c, "esports.money");
            await dialog.run(token, reason.trim());
            setDialog(null);
            setReason("");
            await refresh();
          }}
        >
          {dialog.reason ? (
            <>
              <label htmlFor="org-dialog-reason" className="mt-4 block text-sm font-semibold text-muted">
                {t("reason")}
              </label>
              <textarea id="org-dialog-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={`${inputCls} mt-1 min-h-20 w-full py-2`} />
            </>
          ) : null}
        </CodeDialog>
      ) : null}
    </div>
  );
}

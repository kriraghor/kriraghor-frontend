"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { bookingsAdmin } from "@/lib/admin/bookings";
import { formatTaka } from "@/lib/admin/finance";
import { stepUp } from "@/lib/admin/stepUp";
import { hhmm } from "@/lib/vendor/bookings";
import { Notice } from "@kriraghor/ui/primitives";
import { CodeDialog } from "../CodeDialog";
import { formatDhaka, useAdminMe } from "../useAdminMe";
import { Chip, inputCls } from "../finance/shared";

const STATUSES = ["", "pending_payment", "confirmed", "checked_in", "completed", "no_show", "cancelled", "cancelled_by_owner", "cancelled_by_platform", "expired"] as const;
const TONE: Record<string, "ok" | "warn" | "bad" | "muted"> = { confirmed: "ok", checked_in: "ok", completed: "muted", pending_payment: "warn", no_show: "bad", cancelled_by_platform: "bad" };

/**
 * /admin/bookings (M10): every booking with its money and status; a booking's ledger trail (escrow
 * release with the fee on the full value, refunds, venue fees owed); masters cancel for the platform
 * with a full refund after an authenticator code (step-up escrow.manage).
 */
export function BookingsAdmin() {
  const t = useTranslations("bookingsAdmin");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready, me } = useAdminMe();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("");
  const [code, setCode] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const can = (p: string) => Boolean(me && (me.isMaster || me.permissions.includes(p as never)));
  const allowed = can("manage_users") || can("view_payouts");
  const q = useQuery({ queryKey: ["admin-bookings", status, code], enabled: ready && allowed, queryFn: () => bookingsAdmin.list({ status, code: code.trim().toUpperCase() }) });
  const detail = useQuery({ queryKey: ["admin-booking", open], enabled: Boolean(open), queryFn: () => bookingsAdmin.get(open!) });
  const money = (n: number) => formatTaka(n, locale);

  return (
    <>
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t("intro")}</p>
        {ready && !allowed ? (
          <div className="mt-6 max-w-3xl">
            <Notice tone="error">{t("noAccess")}</Notice>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div>
              <div className="flex flex-wrap gap-3">
                <select value={status} onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])} className={inputCls} aria-label={t("statusFilter")}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s ? t(`status.${s}`) : t("allStatuses")}
                    </option>
                  ))}
                </select>
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="BK-26-000123" aria-label={t("code")} className={inputCls} />
              </div>
              <div className="mt-4 overflow-x-auto border-2 border-line">
                <table className="w-full min-w-[720px] text-sm" data-testid="admin-bookings">
                  <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2">{t("col.code")}</th>
                      <th className="px-3 py-2">{t("col.when")}</th>
                      <th className="px-3 py-2">{t("col.status")}</th>
                      <th className="px-3 py-2 text-right">{t("col.online")}</th>
                      <th className="px-3 py-2 text-right">{t("col.total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(q.data?.items ?? []).map((b) => (
                      <tr key={b.id} className={`cursor-pointer border-t border-line hover:bg-surface-2 ${open === b.id ? "bg-surface-2" : ""}`} onClick={() => setOpen(b.id)}>
                        <td className="px-3 py-2 font-mono">{b.code}</td>
                        <td className="px-3 py-2">
                          {formatDhaka(b.start, locale)}–{hhmm(b.end)}
                        </td>
                        <td className="px-3 py-2">
                          <Chip tone={TONE[b.status] ?? "muted"}>{t(`status.${b.status}`)}</Chip>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(b.money.paidOnline)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(b.money.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!q.isPending && !q.data?.items.length ? <p className="p-4 text-muted">{t("empty")}</p> : null}
              </div>
            </div>
            <div>
              {!open ? (
                <p className="text-muted">{t("pick")}</p>
              ) : detail.isPending ? (
                <div className="h-64 animate-pulse bg-surface-2" />
              ) : detail.data ? (
                <div className="border-2 border-line-strong p-4" data-testid="admin-booking">
                  <p className="font-mono text-xs text-muted">{detail.data.booking.code}</p>
                  <p className="text-lg font-extrabold">{detail.data.booking.teamName ?? detail.data.booking.contactName ?? t(`source.${detail.data.booking.source}`)}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
                    {(["total", "paidOnline", "dueAtVenue", "fee", "released", "retained", "refund"] as const).map((k) => (
                      <div key={k} className="contents">
                        <dt className="text-muted">{t(`money.${k}`)}</dt>
                        <dd className="text-right tabular-nums">{money(detail.data!.booking.money[k])}</dd>
                      </div>
                    ))}
                  </dl>
                  <h2 className="mt-4 text-sm font-bold uppercase tracking-wide text-muted">{t("ledger")}</h2>
                  <ul className="mt-1 text-sm">
                    {detail.data.ledger.map((l) => (
                      <li key={l.id} className="flex justify-between border-b border-line py-1">
                        <span>{l.kind}</span>
                        <span className="tabular-nums">{money(l.total)}</span>
                      </li>
                    ))}
                    {!detail.data.ledger.length ? <li className="text-muted">{t("noLedger")}</li> : null}
                  </ul>
                  {me?.isMaster && ["pending_payment", "confirmed"].includes(detail.data.booking.status) ? (
                    <button type="button" className="mt-4 min-h-11 border-2 border-danger px-4 font-semibold text-danger" onClick={() => setCancelling(true)}>
                      {t("cancel")}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        )}
        {cancelling && open ? (
          <CodeDialog
            title={t("cancelTitle")}
            help={t("cancelHelp")}
            onClose={() => setCancelling(false)}
            onConfirm={async (c) => {
              if (reason.trim().length < 5) throw { code: "VALIDATION_FAILED", title: t("reasonNeeded"), status: 422 };
              const token = await stepUp(c, "escrow.manage");
              await bookingsAdmin.cancel(open, reason.trim(), token);
              setCancelling(false);
              await qc.invalidateQueries({ queryKey: ["admin-bookings"] });
              await qc.invalidateQueries({ queryKey: ["admin-booking", open] });
            }}
          >
            <label htmlFor="booking-cancel-reason" className="mt-4 block text-sm font-semibold text-muted">
              {t("reason")}
            </label>
            <input id="booking-cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={`${inputCls} mt-1 w-full`} />
          </CodeDialog>
        ) : null}
      </div>
    </>
  );
}

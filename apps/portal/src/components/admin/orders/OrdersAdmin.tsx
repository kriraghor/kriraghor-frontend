"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { formatTaka } from "@/lib/admin/finance";
import { ordersAdmin, type StaffOrder } from "@/lib/admin/orders";
import { stepUp } from "@/lib/admin/stepUp";
import { Notice } from "@kriraghor/ui/primitives";
import { CodeDialog } from "../CodeDialog";
import { formatDhaka, useAdminMe } from "../useAdminMe";
import { Chip, inputCls } from "../finance/shared";

const STATUSES = ["", "pending_payment", "placed", "completed", "cancelled"] as const;
const TONE: Record<string, "ok" | "warn" | "bad" | "muted"> = { placed: "warn", accepted: "warn", shipped: "ok", delivered: "ok", completed: "ok", disputed: "bad", pending_payment: "muted", rejected: "muted", expired: "muted", cancelled: "muted", refunded: "muted" };
type Sub = StaffOrder["subOrders"][number];
type Hold = { held?: number; released?: number; refunded?: number; feeTaken?: number; status?: string; available?: number } | null;

/**
 * /admin/orders (M13): find an order by its code (or a sub-order's), see each shop's part with its
 * timeline and escrow hold (held, released, refunded, fee), never the buyer's phone or address; a
 * master cancels a sub-order not yet shipped for the platform with a full refund (step-up escrow.manage).
 */
export function OrdersAdmin() {
  const t = useTranslations("ordersAdmin");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready, me } = useAdminMe();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("");
  const [code, setCode] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<Sub | null>(null);
  const [reason, setReason] = useState("");
  const list = useQuery({ queryKey: ["admin-orders", status, search], queryFn: () => ordersAdmin.list({ code: search || undefined, status: status || undefined }), enabled: ready });
  const detail = useQuery({ queryKey: ["admin-order", open], queryFn: () => ordersAdmin.get(open!), enabled: ready && Boolean(open) });
  const money = (n: number | undefined) => formatTaka(n ?? 0, locale);

  return (
    <>
      <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-8">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t("intro")}</p>
        <form
          className="mt-6 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(code.trim().toUpperCase());
          }}
        >
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
            {t("code")}
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="KG-26-000123" className={inputCls} data-testid="order-code" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
            {t("status")}
            <select value={status} onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])} className={inputCls}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s ? t(`orderStatus.${s}`) : t("all")}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="min-h-11 border-2 border-brand bg-brand px-4 font-bold text-white">
            {t("find")}
          </button>
        </form>
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <ul className="flex flex-col gap-2" data-testid="orders-list">
            {list.isPending ? <li className="h-32 animate-pulse bg-surface-2" /> : null}
            {list.data && !list.data.items.length ? <li className="text-muted">{t("none")}</li> : null}
            {(list.data?.items ?? []).map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => setOpen(o.code)} className={`block w-full border-2 p-3 text-left ${open === o.code ? "border-brand" : "border-line hover:border-brand"}`}>
                  <div className="flex justify-between gap-2">
                    <span className="font-bold">{o.code}</span>
                    <span className="tabular-nums">{money(o.total)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {o.subOrders.map((s, i) => (
                      <Chip key={i} tone={TONE[s] ?? "muted"}>
                        {t(`subStatus.${s}`)}
                      </Chip>
                    ))}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <div>
            {open && detail.isPending ? <div className="h-64 animate-pulse bg-surface-2" /> : null}
            {detail.isError ? <Notice tone="error">{t("failed")}</Notice> : null}
            {detail.data ? (
              <div className="border-2 border-line" data-testid="order-detail">
                <div className="border-b-2 border-line px-4 py-3">
                  <p className="text-xl font-extrabold">{detail.data.code}</p>
                  <p className="text-sm text-muted">
                    {t("placedIn", { area: detail.data.area ? (locale === "bn" ? detail.data.area.nameBn : detail.data.area.nameEn) : "—", when: formatDhaka(detail.data.placedAt ?? detail.data.createdAt, locale) })}
                  </p>
                </div>
                {detail.data.subOrders.map((s) => {
                  const hold = s.escrow as Hold;
                  return (
                    <section key={s.id} className="border-b-2 border-line px-4 py-3 last:border-b-0" data-testid="staff-sub">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold">
                          {s.code} · {s.shop?.name}
                        </p>
                        <Chip tone={TONE[s.status] ?? "muted"}>{t(`subStatus.${s.status}`)}</Chip>
                      </div>
                      <p className="mt-1 text-sm text-muted">{s.items.map((i) => `${i.qty} × ${i.title}`).join(", ")}</p>
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                        <div>
                          <dt className="text-muted">{t("total")}</dt>
                          <dd className="tabular-nums">{money(s.money.total)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted">{t("held")}</dt>
                          <dd className="tabular-nums">{hold ? `${money(hold.available)} · ${hold.status}` : "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-muted">{t("released")}</dt>
                          <dd className="tabular-nums">{money(hold?.released)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted">{t("refunded")}</dt>
                          <dd className="tabular-nums">{money(hold?.refunded)}</dd>
                        </div>
                      </dl>
                      <ol className="mt-2 text-xs text-muted">
                        {(["placedAt", "acceptedAt", "shippedAt", "deliveredAt", "completedAt", "cancelledAt"] as const)
                          .filter((k) => s[k])
                          .map((k) => (
                            <li key={k}>
                              {t(`at.${k}`)}: {formatDhaka(s[k], locale)}
                            </li>
                          ))}
                      </ol>
                      {s.courier ? <p className="mt-1 text-sm">{t("courier", { name: s.courier.name, no: s.courier.trackingNo })}</p> : null}
                      {me?.isMaster && ["placed", "accepted"].includes(s.status) ? (
                        <button type="button" className="mt-3 min-h-11 border-2 border-danger px-4 font-semibold text-danger" onClick={() => setCancelling(s)}>
                          {t("cancel")}
                        </button>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            ) : open ? null : (
              <p className="text-muted">{t("pick")}</p>
            )}
          </div>
        </div>
        {cancelling ? (
          <CodeDialog
            title={t("cancelTitle", { code: cancelling.code })}
            help={t("cancelHelp", { amount: money(cancelling.money.total - cancelling.money.refunded) })}
            onClose={() => setCancelling(null)}
            onConfirm={async (c) => {
              if (reason.trim().length < 5) throw { code: "VALIDATION_FAILED", title: t("reasonNeeded"), status: 422 };
              const token = await stepUp(c, "escrow.manage");
              await ordersAdmin.cancel(cancelling.id, reason.trim(), token);
              setCancelling(null);
              await qc.invalidateQueries({ queryKey: ["admin-orders"] });
              await qc.invalidateQueries({ queryKey: ["admin-order", open] });
            }}
          >
            <label htmlFor="order-cancel-reason" className="mt-4 block text-sm font-semibold text-muted">
              {t("reason")}
            </label>
            <input id="order-cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={`${inputCls} mt-1 w-full`} />
          </CodeDialog>
        ) : null}
      </div>
    </>
  );
}

"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { formatTaka } from "@/lib/admin/finance";
import { shopDesk, type InventoryRow, type ReasonCode } from "@/lib/vendor/market";
import { Notice } from "@kriraghor/ui/primitives";
import { Chip, inputCls } from "../../admin/finance/shared";
import { Gate } from "./ShopDesk";

const FILTERS = ["all", "low", "out", "mto", "blocked"] as const;
const REASONS: ReasonCode[] = ["received", "count_correction", "damaged", "lost", "other"];
const STOCK_TONE: Record<string, "ok" | "warn" | "bad" | "muted"> = { in_stock: "ok", low: "warn", out: "bad", out_hidden: "bad", mto: "muted", blocked: "bad" };

/**
 * /vendor/inventory (M12 §4 "Inventory"): stock value at selling price, out of stock, running low,
 * held for orders and blocked (near expiry); every variant with −1 / +1 / +10 and "Set count…" (a
 * reason is required: an append-only ledger, FR-13) and its history. The stock rules live on /vendor/shop.
 */
export function InventoryDesk() {
  const t = useTranslations("vendorMarket");
  const locale = useLocale();
  const initial = useSearchParams().get("status");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>((FILTERS as readonly string[]).includes(initial ?? "") ? (initial as (typeof FILTERS)[number]) : "all");
  const q = useQuery({ queryKey: ["vendor-inventory", filter], queryFn: () => shopDesk.inventory(filter === "all" ? undefined : filter), retry: false });
  const problem = problemOf(q.error);
  if (problem && ["ROLE_REQUIRED", "ROLE_PENDING", "KYC_REQUIRED", "KYC_PENDING"].includes(problem.code)) return <Gate />;
  if (problem?.code === "SHOP_REQUIRED")
    return (
      <section className="mx-auto max-w-3xl px-5 py-10">
        <Notice>{t("products.noShop")}</Notice>
        <Link href="/vendor/shop" className="mt-4 inline-block font-semibold text-brand underline">
          {t("products.openShop")}
        </Link>
      </section>
    );
  const k = q.data?.kpis;
  return (
    <section className="mx-auto max-w-[1100px] px-5 py-10">
      <h1 className="text-3xl font-extrabold">{t("inventory.title")}</h1>
      <p className="mt-1 max-w-2xl text-muted">{t("inventory.lead")}</p>
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="inventory-kpis">
        {[
          ["value", k ? formatTaka(k.stockValuePoisha, locale) : "–"],
          ["out", k?.outOfStock ?? "–"],
          ["low", k?.runningLow ?? "–"],
          ["held", k?.heldForOrders ?? "–"],
          ["blocked", k?.blocked ?? "–"],
        ].map(([key, value]) => (
          <div key={key} className="border-2 border-line bg-surface p-3">
            <dt className="text-xs font-bold uppercase text-muted">{t(`inventory.kpi.${key}`)}</dt>
            <dd className="mt-1 text-xl font-extrabold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div role="tablist" aria-label={t("inventory.title")} className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`min-h-11 border-2 px-3 text-sm font-bold ${filter === f ? "border-brand text-ink" : "border-line text-muted"}`}>
            {t(`inventory.filter.${f}`)}
          </button>
        ))}
      </div>
      {q.isPending ? <div className="mt-6 h-48 animate-pulse bg-surface-2" /> : null}
      {q.data && !q.data.items.length ? <p className="mt-8 border-2 border-dashed border-line p-8 text-center text-muted">{t("inventory.empty")}</p> : null}
      {q.data?.items.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm" data-testid="inventory-table">
            <thead>
              <tr className="border-b-2 border-line">
                <th className="py-2 pr-3">{t("inventory.col.product")}</th>
                <th className="py-2 pr-3">{t("inventory.col.variant")}</th>
                <th className="py-2 pr-3 text-right">{t("inventory.col.onHand")}</th>
                <th className="py-2 pr-3 text-right">{t("inventory.col.held")}</th>
                <th className="py-2 pr-3 text-right">{t("inventory.col.available")}</th>
                <th className="py-2 pr-3">{t("inventory.col.status")}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((r) => (
                <Row key={r.id} r={r} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function Row({ r }: { r: InventoryRow }) {
  const t = useTranslations("vendorMarket");
  const qc = useQueryClient();
  const [open, setOpen] = useState<"set" | "history" | null>(null);
  const [setTo, setSetTo] = useState(String(r.onHand));
  const [reason, setReason] = useState<ReasonCode>("count_correction");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const history = useQuery({ queryKey: ["vendor-movements", r.id], queryFn: () => shopDesk.movements(r.id), enabled: open === "history" });
  const adjust = async (body: Parameters<typeof shopDesk.adjust>[1]) => {
    setMsg(null);
    setBusy(true);
    try {
      await shopDesk.adjust(r.id, body);
      await qc.invalidateQueries({ queryKey: ["vendor-inventory"] });
      await qc.invalidateQueries({ queryKey: ["vendor-movements", r.id] });
      setOpen(null);
    } catch (err) {
      const p = problemOf(err);
      setMsg(p?.errors?.length ? p.errors.map((e) => e.message).join(" · ") : p?.title ?? t("failed"));
    } finally {
      setBusy(false);
    }
  };
  const mto = r.stock.code === "mto";
  return (
    <>
      <tr className="border-b border-line" data-testid="inventory-row">
        <td className="py-2 pr-3">
          <Link href={`/vendor/products/${r.product.id}`} className="font-semibold hover:underline">
            {r.product.title}
          </Link>
        </td>
        <td className="py-2 pr-3">{r.label}</td>
        <td className="py-2 pr-3 text-right tabular-nums">{mto ? "–" : r.onHand}</td>
        <td className="py-2 pr-3 text-right tabular-nums">{mto ? "–" : r.held}</td>
        <td className="py-2 pr-3 text-right font-bold tabular-nums">{mto ? "–" : r.available}</td>
        <td className="py-2 pr-3">
          <Chip tone={STOCK_TONE[r.stock.code] ?? "muted"}>{t(`stock.${r.stock.code}`, { days: r.stock.days ?? 0 })}</Chip>
        </td>
        <td className="py-2 text-right">
          <span className="inline-flex flex-wrap justify-end gap-1">
            {mto ? null : (
              <>
                <button type="button" disabled={busy || r.available <= 0} className="min-h-9 min-w-9 border-2 border-line font-bold disabled:opacity-40" aria-label={t("inventory.minus")} onClick={() => void adjust({ delta: -1, reasonCode: "count_correction" })} data-testid="minus-one">
                  −1
                </button>
                <button type="button" disabled={busy} className="min-h-9 min-w-9 border-2 border-line font-bold" aria-label={t("inventory.plus")} onClick={() => void adjust({ delta: 1, reasonCode: "received" })} data-testid="plus-one">
                  +1
                </button>
                <button type="button" disabled={busy} className="min-h-9 border-2 border-line px-2 font-bold" onClick={() => void adjust({ delta: 10, reasonCode: "received" })} data-testid="plus-ten">
                  +10
                </button>
                <button type="button" className="min-h-9 border-2 border-line px-2 text-xs font-semibold" onClick={() => setOpen(open === "set" ? null : "set")} data-testid="set-count">
                  {t("inventory.setCount")}
                </button>
              </>
            )}
            <button type="button" className="min-h-9 border-2 border-line px-2 text-xs font-semibold" onClick={() => setOpen(open === "history" ? null : "history")}>
              {t("inventory.history")}
            </button>
          </span>
        </td>
      </tr>
      {open === "set" ? (
        <tr className="border-b border-line bg-surface-2">
          <td colSpan={7} className="p-3">
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void adjust({ setTo: Number(setTo), reasonCode: reason, ...(text.trim() ? { reasonText: text.trim() } : {}) });
              }}
            >
              <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
                {t("inventory.newCount")}
                <input type="number" min={r.held} value={setTo} onChange={(e) => setSetTo(e.target.value)} className={inputCls} data-testid="set-to" />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
                {t("inventory.reason")}
                <select value={reason} onChange={(e) => setReason(e.target.value as ReasonCode)} className={inputCls}>
                  {REASONS.map((x) => (
                    <option key={x} value={x}>
                      {t(`inventory.reasons.${x}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
                {t("inventory.note")}
                <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} required={reason === "other"} className={inputCls} />
              </label>
              <button type="submit" disabled={busy} className="min-h-11 border-2 border-brand px-4 text-sm font-bold" data-testid="save-count">
                {t("save")}
              </button>
              {msg ? <span className="text-sm text-danger">{msg}</span> : null}
            </form>
          </td>
        </tr>
      ) : null}
      {open === "history" ? (
        <tr className="border-b border-line bg-surface-2">
          <td colSpan={7} className="p-3">
            {history.isPending ? (
              <div className="h-16 animate-pulse bg-surface" />
            ) : (
              <ul className="space-y-1 text-sm" data-testid="movements">
                {(history.data?.items ?? []).map((m) => (
                  <li key={m.id} className="flex flex-wrap gap-3">
                    <span className="text-muted">{new Date(m.createdAt).toLocaleString()}</span>
                    <span className="font-semibold">{t(`inventory.type.${m.type}`)}</span>
                    <span className="tabular-nums">{m.deltaOnHand > 0 ? `+${m.deltaOnHand}` : m.deltaOnHand}</span>
                    <span className="text-muted">{t("inventory.after", { onHand: m.onHandAfter, held: m.heldAfter })}</span>
                    {m.reasonCode ? <span>{t(`inventory.reasons.${m.reasonCode}`)}</span> : null}
                    {m.reasonText ? <span className="text-muted">“{m.reasonText}”</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      ) : null}
      {msg && open !== "set" ? (
        <tr>
          <td colSpan={7} className="pb-2 text-sm text-danger">
            {msg}
          </td>
        </tr>
      ) : null}
    </>
  );
}

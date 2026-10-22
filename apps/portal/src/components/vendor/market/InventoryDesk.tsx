"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { Button, DataTable, Field, FilterBar, Notice, PageTitle, Select, Skeleton, Stat, type Column } from "@kriraghor/ui/kit";
import { formatTaka } from "@/lib/admin/finance";
import { shopDesk, type InventoryRow, type ReasonCode } from "@/lib/vendor/market";
import { useUrlFilters } from "@/lib/use-url-filters";
import { StatusBadge } from "../../StatusBadge";
import { Gate } from "./ShopDesk";
import { deskAccessKey, deskCan } from "@/lib/vendor/team";
import { DeskAccessNotice, ShopSwitch, useDeskErrorText, useShopChoice } from "../StaffAccess";

const FILTERS = ["low", "out", "mto", "blocked"] as const;
const REASONS: ReasonCode[] = ["received", "count_correction", "damaged", "lost", "other"];
type AdjustBody = Parameters<typeof shopDesk.adjust>[1];

/**
 * /vendor/inventory (M12 §4 "Inventory"): stock value at selling price, out of stock, running low,
 * held for orders and blocked (near expiry); every variant with −1 / +1 / +10 and "Set count…" (a
 * reason is required: an append-only ledger, FR-13) and its history. The stock rules live on /vendor/shop.
 * Round B3: a shop's staff with stock.view see the same list without the stock value (the API leaves
 * it out), and change counts only with stock.adjust; a switcher (?shopId=) when there are several shops.
 */
export function InventoryDesk() {
  const t = useTranslations("vendorMarket");
  const tk = useTranslations("kit.table");
  const locale = useLocale();
  const qc = useQueryClient();
  const { values, set, clear } = useUrlFilters({ status: { default: "", allowed: ["", ...FILTERS] }, shopId: { default: "" } });
  const shop = useShopChoice("stock.view", values.shopId);
  const canAdjust = deskCan(shop.perms, "stock.adjust");
  const errorText = useDeskErrorText();
  const filter = values.status as (typeof FILTERS)[number] | "";
  const [open, setOpen] = useState<{ id: string; kind: "set" | "history" } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; text: string } | null>(null);
  const q = useQuery({ queryKey: ["vendor-inventory", filter || "all", shop.shopId ?? ""], queryFn: () => shopDesk.inventory(filter || undefined, shop.shopId), retry: false, enabled: shop.ready });
  const problem = problemOf(q.error);

  const toggle = (id: string, kind: "set" | "history") => setOpen((o) => (o?.id === id && o.kind === kind ? null : { id, kind }));
  async function adjust(r: InventoryRow, body: AdjustBody) {
    setMsg(null);
    setBusyId(r.id);
    try {
      await shopDesk.adjust(r.id, body);
      await qc.invalidateQueries({ queryKey: ["vendor-inventory"] });
      await qc.invalidateQueries({ queryKey: ["vendor-movements", r.id] });
      setOpen(null);
    } catch (err) {
      const p = problemOf(err);
      setMsg({ id: r.id, text: p?.errors?.length ? p.errors.map((e) => e.message).join(" · ") : (errorText(err, t("failed")) ?? t("failed")) });
    } finally {
      setBusyId(null);
    }
  }

  if (problem && ["ROLE_REQUIRED", "ROLE_PENDING", "KYC_REQUIRED", "KYC_PENDING"].includes(problem.code) && !shop.choices.some((c) => c.staff)) return <Gate />;
  if (problem?.code === "SHOP_REQUIRED")
    return (
      <section className="mx-auto max-w-3xl px-5 py-10">
        <Notice>{t("products.noShop")}</Notice>
        <Link href="/vendor/shop" className="mt-4 inline-block font-semibold text-brand-text underline">
          {t("products.openShop")}
        </Link>
      </section>
    );
  const k = q.data?.kpis;

  const columns: Column<InventoryRow>[] = [
    {
      id: "product",
      header: t("inventory.col.product"),
      primary: true,
      sort: (r) => r.product.title,
      // The product editor is the owner's: staff see the title only.
      cell: (r) =>
        shop.perms === null ? (
          <Link href={`/vendor/products/${r.product.id}`} className="font-semibold hover:underline">
            {r.product.title}
          </Link>
        ) : (
          <span className="font-semibold">{r.product.title}</span>
        ),
    },
    { id: "variant", header: t("inventory.col.variant"), sort: (r) => r.label, cell: (r) => r.label },
    { id: "onHand", header: t("inventory.col.onHand"), align: "end", sort: (r) => (r.stock.code === "mto" ? null : r.onHand), cell: (r) => (r.stock.code === "mto" ? "–" : r.onHand) },
    { id: "held", header: t("inventory.col.held"), align: "end", hideBelow: "lg", sort: (r) => (r.stock.code === "mto" ? null : r.held), cell: (r) => (r.stock.code === "mto" ? "–" : r.held) },
    { id: "available", header: t("inventory.col.available"), align: "end", sort: (r) => (r.stock.code === "mto" ? null : r.available), cell: (r) => <span className="font-semibold">{r.stock.code === "mto" ? "–" : r.available}</span> },
    {
      id: "status",
      header: t("inventory.col.status"),
      sort: (r) => r.stock.code,
      cell: (r) => (
        <StatusBadge status={r.stock.code} domain="stock">
          {t(`stock.${r.stock.code}`, { days: r.stock.days ?? 0 })}
        </StatusBadge>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">{tk("actions")}</span>,
      label: tk("actions"),
      align: "end",
      cell: (r) => {
        const busy = busyId === r.id;
        return (
          <span className="inline-flex flex-wrap justify-end gap-1">
            {r.stock.code === "mto" || !canAdjust ? null : (
              <>
                <Button type="button" variant="secondary" size="sm" disabled={busy || r.available <= 0} aria-label={t("inventory.minus")} onClick={() => void adjust(r, { delta: -1, reasonCode: "count_correction" })} data-testid="minus-one">
                  −1
                </Button>
                <Button type="button" variant="secondary" size="sm" disabled={busy} aria-label={t("inventory.plus")} onClick={() => void adjust(r, { delta: 1, reasonCode: "received" })} data-testid="plus-one">
                  +1
                </Button>
                <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void adjust(r, { delta: 10, reasonCode: "received" })} data-testid="plus-ten">
                  +10
                </Button>
                <Button type="button" variant="ghost" size="sm" aria-expanded={open?.id === r.id && open.kind === "set"} onClick={() => toggle(r.id, "set")} data-testid="set-count">
                  {t("inventory.setCount")}
                </Button>
              </>
            )}
            <Button type="button" variant="ghost" size="sm" aria-expanded={open?.id === r.id && open.kind === "history"} onClick={() => toggle(r.id, "history")}>
              {t("inventory.history")}
            </Button>
          </span>
        );
      },
    },
  ];

  const expanded = (r: InventoryRow) => {
    const error = msg?.id === r.id ? msg.text : null;
    if (open?.id === r.id && open.kind === "set") return <SetCount r={r} busy={busyId === r.id} error={error} onSave={(body) => void adjust(r, body)} />;
    if (open?.id === r.id && open.kind === "history") return <History variantId={r.id} />;
    return error ? (
      <p role="alert" className="text-sm text-danger">
        {error}
      </p>
    ) : null;
  };

  // Staff answers carry no stock value (B3): the tile is left out.
  const value = (k as { stockValuePoisha?: number } | undefined)?.stockValuePoisha;
  const kpis: [string, string | number][] = [
    ...(shop.perms === null && (!k || typeof value === "number") ? [["value", typeof value === "number" ? formatTaka(value, locale) : "–"] as [string, string]] : []),
    ["out", k?.outOfStock ?? "–"],
    ["low", k?.runningLow ?? "–"],
    ["held", k?.heldForOrders ?? "–"],
    ["blocked", k?.blocked ?? "–"],
  ];

  return (
    <section className="mx-auto max-w-[1320px] px-5 py-10">
      <PageTitle title={t("inventory.title")} description={t("inventory.lead")} />
      {shop.choices.length > 1 || deskAccessKey(problem?.code) ? (
        <div className="mt-6 flex flex-col gap-4">
          <ShopSwitch choices={shop.choices} value={shop.current?.value} onChange={(v) => set({ shopId: v })} />
          {deskAccessKey(problem?.code) ? <DeskAccessNotice error={q.error} /> : null}
        </div>
      ) : null}
      <div className={`mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 ${kpis.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`} data-testid="inventory-kpis">
        {kpis.map(([key, value]) => (
          <Stat key={key} label={t(`inventory.kpi.${key}`)} value={value} className="p-4 sm:p-4 [&>p]:text-2xl" />
        ))}
      </div>
      <div className="mt-6 flex flex-col gap-4">
        <FilterBar
          chips={{
            value: filter,
            onChange: (v) => {
              setOpen(null);
              set({ status: v });
            },
            label: t("inventory.title"),
            options: [{ value: "", label: t("inventory.filter.all") }, ...FILTERS.map((f) => ({ value: f, label: t(`inventory.filter.${f}`) }))],
          }}
          onClear={clear}
        />
        <DataTable
          label={t("inventory.title")}
          testId="inventory-table"
          columns={columns}
          rows={q.data?.items}
          rowId={(r) => r.id}
          loading={q.isPending}
          error={q.error}
          onRetry={() => void q.refetch()}
          empty={{ title: t("inventory.empty") }}
          rowTestId="inventory-row"
          expanded={expanded}
        />
      </div>
    </section>
  );
}

function SetCount({ r, busy, error, onSave }: { r: InventoryRow; busy: boolean; error: string | null; onSave: (body: AdjustBody) => void }) {
  const t = useTranslations("vendorMarket");
  const [setTo, setSetTo] = useState(String(r.onHand));
  const [reason, setReason] = useState<ReasonCode>("count_correction");
  const [text, setText] = useState("");
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ setTo: Number(setTo), reasonCode: reason, ...(text.trim() ? { reasonText: text.trim() } : {}) });
      }}
    >
      <Field id={`set-to-${r.id}`} type="number" min={r.held} label={t("inventory.newCount")} value={setTo} onChange={(e) => setSetTo(e.target.value)} className="w-32" data-testid="set-to" />
      <Select id={`set-reason-${r.id}`} label={t("inventory.reason")} value={reason} onChange={(e) => setReason(e.target.value as ReasonCode)} className="w-52">
        {REASONS.map((x) => (
          <option key={x} value={x}>
            {t(`inventory.reasons.${x}`)}
          </option>
        ))}
      </Select>
      <Field id={`set-note-${r.id}`} label={t("inventory.note")} value={text} onChange={(e) => setText(e.target.value)} maxLength={200} required={reason === "other"} className="min-w-48 flex-1" />
      <Button type="submit" busy={busy} data-testid="save-count">
        {t("save")}
      </Button>
      {error ? (
        <p role="alert" className="w-full text-sm text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function History({ variantId }: { variantId: string }) {
  const t = useTranslations("vendorMarket");
  const locale = useLocale();
  const history = useQuery({ queryKey: ["vendor-movements", variantId], queryFn: () => shopDesk.movements(variantId) });
  if (history.isPending) return <Skeleton className="h-16" />;
  return (
    <ul className="space-y-1 text-sm" data-testid="movements">
      {(history.data?.items ?? []).map((m) => (
        <li key={m.id} className="flex flex-wrap gap-3">
          <span className="text-muted">{new Date(m.createdAt).toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" })}</span>
          <span className="font-semibold">{t(`inventory.type.${m.type}`)}</span>
          <span className="tabular">{m.deltaOnHand > 0 ? `+${m.deltaOnHand}` : m.deltaOnHand}</span>
          <span className="text-muted">{t("inventory.after", { onHand: m.onHandAfter, held: m.heldAfter })}</span>
          {m.reasonCode ? <span>{t(`inventory.reasons.${m.reasonCode}`)}</span> : null}
          {m.reasonText ? <span className="text-muted">“{m.reasonText}”</span> : null}
        </li>
      ))}
    </ul>
  );
}

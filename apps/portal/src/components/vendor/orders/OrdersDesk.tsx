"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { Button, Chip, DataTable, DetailLayout, Field, Notice, PageTitle, Select, Skeleton, type Column } from "@kriraghor/ui/kit";
import { formatTaka } from "@/lib/admin/finance";
import { REJECT_REASONS, TABS, hoursLeft, shopOrders, type RejectReason, type ShopSub, type Tab } from "@/lib/vendor/orders";
import { useCursorList } from "@/lib/use-cursor-list";
import { useUrlFilters } from "@/lib/use-url-filters";
import { StatusBadge } from "../../StatusBadge";
import { Gate } from "../market/ShopDesk";
import { allowedOrderActions, deskAccessKey } from "@/lib/vendor/team";
import { DeskAccessNotice, ShopSwitch, useDeskErrorText, useShopChoice } from "../StaffAccess";

type Row = Awaited<ReturnType<typeof shopOrders.list>>["items"][number];

/**
 * /vendor/orders (M13 FR-08 to FR-12): the shop's orders by tab (to accept, to ship, shipped, done,
 * cancelled) with the time left on each deadline; a sub-order panel to accept (the buyer's phone and
 * address show only then), reject with a reason (the buyer is refunded in full), ship with the courier
 * and tracking number, and mark delivered with an optional photo.
 * Round B3: a shop's staff work this desk too, at the shops where they hold orders.view (a switcher
 * when there are several, ?shopId=). They see no commission, net or settlement (the API leaves them
 * out), only the buttons the owner allowed, and the buyer's contact only with orders.ship.
 */
export function OrdersDesk() {
  const t = useTranslations("vendorOrders");
  const locale = useLocale();
  const { values, set, params } = useUrlFilters({ tab: { default: "to_accept", allowed: TABS }, shopId: { default: "" } });
  const tab = values.tab as Tab;
  const open = params.get("id");
  const shop = useShopChoice("orders.view", values.shopId);
  // No retry, as before: a missing role or KYC answers at once and shows its gate.
  const list = useCursorList<Row>(["shop-orders", tab, shop.shopId ?? ""], (cursor) => shopOrders.list(tab, cursor, shop.shopId), { retry: false, enabled: shop.ready });
  const problem = problemOf(list.error);
  const money = (n: number | null | undefined) => (typeof n === "number" ? formatTaka(n, locale) : "–");
  const area = (s: Row) => (s.area ? (locale === "bn" ? s.area.nameBn : s.area.nameEn) : "");
  if (problem && ["ROLE_REQUIRED", "ROLE_PENDING", "KYC_REQUIRED", "KYC_PENDING"].includes(problem.code) && !shop.choices.some((c) => c.staff)) return <Gate />;
  const openCode = list.rows?.find((s) => s.id === open)?.code;

  const columns: Column<Row>[] = [
    {
      id: "order",
      header: t("col.order"),
      primary: true,
      sort: (s) => s.code,
      cell: (s) => (
        <>
          <span className="block font-mono font-semibold">{s.code}</span>
          <span className="block text-xs font-normal text-muted">{s.items.map((i) => `${i.qty} × ${i.title} ${locale === "bn" ? i.variantLabelBn : i.variantLabelEn}`).join(", ")}</span>
        </>
      ),
    },
    {
      id: "status",
      header: t("col.status"),
      sort: (s) => s.status,
      cell: (s) => (
        <StatusBadge status={s.status} domain="order">
          {t(`status.${s.status}`)}
        </StatusBadge>
      ),
    },
    { id: "area", header: t("col.area"), hideBelow: "lg", sort: (s) => area(s), cell: (s) => area(s) || "–" },
    { id: "due", header: t("col.due"), sort: (s) => (s.status === "placed" ? s.acceptBy : s.status === "accepted" ? s.shipBy : null), cell: (s) => <Deadline s={s} /> },
    { id: "total", header: t("col.total"), align: "end", sort: (s) => s.money.total, cell: (s) => <span className="font-semibold">{money(s.money.total)}</span> },
  ];

  return (
    <section className="mx-auto max-w-[1320px] px-5 py-10">
      <PageTitle
        title={t("title")}
        description={t(shop.perms === null ? "lead" : "leadStaff")}
        actions={
          shop.perms === null ? (
            <Link href="/vendor/settlement" className="font-semibold text-brand-text underline">
              {t("settlementLink")}
            </Link>
          ) : undefined
        }
      />
      <DetailLayout
        className="mt-6"
        open={Boolean(open)}
        onClose={() => set({ id: null })}
        title={<span className="font-mono">{openCode ?? t("title")}</span>}
        pane={open ? <OrderPanel key={open} id={open} perms={shop.perms} /> : null}
        width={460}
        testId="order-panel"
      >
        <div className="flex flex-col gap-4">
          <ShopSwitch choices={shop.choices} value={shop.current?.value} onChange={(v) => set({ shopId: v, id: null })} />
          {deskAccessKey(problem?.code) ? <DeskAccessNotice error={list.error} /> : null}
          <div role="group" aria-label={t("title")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {TABS.map((k) => (
              <Chip key={k} active={tab === k} count={list.counts?.[k] || undefined} onClick={() => set({ tab: k, id: null })} className="min-h-10 shrink-0" data-testid={`tab-${k}`}>
                {t(`tab.${k}`)}
              </Chip>
            ))}
          </div>
          <DataTable
            label={t(`tab.${tab}`)}
            columns={columns}
            rows={deskAccessKey(problem?.code) ? [] : list.rows}
            rowId={(s) => s.id}
            loading={list.loading}
            error={list.error}
            onRetry={list.retry}
            empty={{ title: t(`empty.${tab}`) }}
            hasMore={list.hasMore}
            onMore={list.more}
            busy={list.busy}
            onRowClick={(s) => set({ id: s.id })}
            selectedId={open}
            rowTestId="order-row"
          />
        </div>
      </DetailLayout>
    </section>
  );
}

function Deadline({ s }: { s: ShopSub }) {
  const t = useTranslations("vendorOrders");
  const due = s.status === "placed" ? s.acceptBy : s.status === "accepted" ? s.shipBy : null;
  const h = hoursLeft(due);
  if (h === null) return <span className="text-muted">–</span>;
  return <span className={h < 4 ? "font-semibold text-danger" : "text-muted"}>{h < 0 ? t("late") : t(s.status === "placed" ? "acceptIn" : "shipIn", { h })}</span>;
}

/** perms: the staff member's permissions at this shop (Round B3), or null for the owner. */
function OrderPanel({ id, perms }: { id: string; perms: readonly string[] | null }) {
  const t = useTranslations("vendorOrders");
  const errorText = useDeskErrorText();
  const locale = useLocale();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["shop-order", id], queryFn: () => shopOrders.get(id), retry: false });
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<RejectReason>("out_of_stock");
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  // Staff answers carry no commission or net (B3): a missing amount shows a dash.
  const money = (n: number | null | undefined) => (typeof n === "number" ? formatTaka(n, locale) : "–");
  const run = async (fn: () => Promise<ShopSub>, done: string) => {
    setMsg(null);
    setBusy(true);
    try {
      const s = await fn();
      // An action's answer never carries the buyer's contact for staff: read the order again instead.
      if (perms) await qc.invalidateQueries({ queryKey: ["shop-order", id] });
      else qc.setQueryData(["shop-order", id], s);
      await qc.invalidateQueries({ queryKey: ["shop-orders"] });
      setMsg({ text: done, tone: "info" });
    } catch (err) {
      const p = problemOf(err);
      setMsg({ text: p?.errors?.length ? p.errors.map((e) => e.message).join(" · ") : (errorText(err, t("failed")) ?? t("failed")), tone: "error" });
    } finally {
      setBusy(false);
    }
  };
  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data) return <Notice tone="error">{errorText(q.error, t("failed")) ?? t("failed")}</Notice>;
  const s = q.data;
  const can = allowedOrderActions(s.status, perms);
  // Read defensively: the staff view leaves the money keys out and may add contactHidden (Q168).
  const m = s.money as Partial<ShopSub["money"]> & Pick<ShopSub["money"], "items" | "delivery">;
  const contactHidden = Boolean((s as { contactHidden?: boolean }).contactHidden);
  const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso)) : "–");
  const areaName = s.area ? (locale === "bn" ? s.area.nameBn : s.area.nameEn) : "";

  return (
    <div className="flex flex-col gap-4">
      <StatusBadge status={s.status} domain="order" className="self-start">
        {t(`status.${s.status}`)}
      </StatusBadge>
      <ul className="divide-y divide-line rounded-card border border-line">
        {s.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-3 px-3 py-2 text-sm">
            <span>
              {`${i.qty} × ${i.title} ${locale === "bn" ? i.variantLabelBn : i.variantLabelEn}`}
              {i.sku ? <span className="text-muted"> · {i.sku}</span> : null}
            </span>
            <span className="font-semibold tabular">{money(i.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm" data-testid="order-money">
        <dt className="text-muted">{t("items")}</dt>
        <dd className="text-right tabular">{money(s.money.items)}</dd>
        <dt className="text-muted">{t("delivery")}</dt>
        <dd className="text-right tabular">{money(s.money.delivery)}</dd>
        {typeof m.commission === "number" && typeof m.commissionBps === "number" ? (
          <>
            <dt className="text-muted">{t("commission", { pct: m.commissionBps / 100 })}</dt>
            <dd className="text-right tabular">−{money(m.commission)}</dd>
          </>
        ) : null}
        {typeof m.net === "number" ? (
          <>
            <dt className="font-semibold">{t("youGet")}</dt>
            <dd className="text-right font-semibold tabular" data-testid="order-net">
              {money(m.net)}
            </dd>
          </>
        ) : null}
        <dt className="text-muted">{t("acceptBy")}</dt>
        <dd className="text-right">{when(s.acceptBy)}</dd>
        <dt className="text-muted">{t("shipBy")}</dt>
        <dd className="text-right">{when(s.shipBy)}</dd>
        {s.courier ? (
          <>
            <dt className="text-muted">{t("courier")}</dt>
            <dd className="text-right">
              {s.courier.name} · {s.courier.trackingNo}
            </dd>
          </>
        ) : null}
      </dl>
      <div className="rounded-control bg-surface-2 px-3 py-2.5 text-sm" data-testid="ship-to">
        <p className="font-semibold">{t("shipTo")}</p>
        {s.shipTo ? (
          <p>
            {s.shipTo.name} ·{" "}
            <a href={`tel:${s.shipTo.phone}`} className="underline">
              {s.shipTo.phone}
            </a>
            <br />
            {s.shipTo.line}
            {areaName ? `, ${areaName}` : ""}
            {s.shipTo.note ? (
              <>
                <br />
                <span className="text-muted">{s.shipTo.note}</span>
              </>
            ) : null}
          </p>
        ) : contactHidden ? (
          <p className="text-muted" data-testid="contact-hidden">
            {t("contactHidden", { area: areaName })}
          </p>
        ) : (
          <p className="text-muted">{t("addressAfterAccept", { area: areaName })}</p>
        )}
      </div>
      <div className="flex flex-col gap-3 border-t border-line pt-4">
        {s.status === "placed" && !rejecting && (can.includes("accept") || can.includes("reject")) ? (
          <div className="flex flex-wrap gap-2">
            {can.includes("accept") ? (
              <Button type="button" busy={busy} onClick={() => run(() => shopOrders.accept(id), t("accepted"))} data-testid="accept-order">
                {t("accept")}
              </Button>
            ) : null}
            {can.includes("reject") ? (
              <Button type="button" variant="secondary" className="text-danger" disabled={busy} onClick={() => setRejecting(true)}>
                {t("reject")}
              </Button>
            ) : null}
          </div>
        ) : null}
        {rejecting && s.status === "placed" && can.includes("reject") ? (
          <div className="flex flex-col gap-3">
            <Select id="reject-reason" label={t("rejectWhy")} hint={t("rejectNote")} value={reason} onChange={(e) => setReason(e.target.value as RejectReason)}>
              {REJECT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`rejectReason.${r}`)}
                </option>
              ))}
            </Select>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="danger" busy={busy} onClick={() => run(() => shopOrders.reject(id, reason), t("rejected"))} data-testid="confirm-reject">
                {t("confirmReject")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setRejecting(false)}>
                {t("back")}
              </Button>
            </div>
          </div>
        ) : null}
        {s.status === "accepted" && can.includes("ship") ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => shopOrders.ship(id, courier.trim(), tracking.trim()), t("shipped"));
            }}
          >
            <Field id="courier" label={t("courierName")} value={courier} onChange={(e) => setCourier(e.target.value)} required minLength={2} maxLength={60} placeholder="Pathao, Steadfast, RedX" data-testid="courier" />
            <Field id="tracking" label={t("trackingNo")} value={tracking} onChange={(e) => setTracking(e.target.value)} required pattern="[A-Za-z0-9/\-]{4,40}" data-testid="tracking" />
            <Button type="submit" busy={busy} className="self-start" data-testid="ship-order">
              {t("ship")}
            </Button>
          </form>
        ) : null}
        {s.status === "shipped" && can.includes("deliver") ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold" htmlFor="proof">
                {t("proof")}
              </label>
              <input id="proof" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setProof(e.target.files?.[0] ?? null)} className="text-sm file:mr-3 file:min-h-9 file:rounded-control file:border file:border-line-strong/60 file:bg-surface file:px-3 file:font-semibold" />
            </div>
            <Button type="button" busy={busy} className="self-start" onClick={() => run(() => shopOrders.delivered(id, proof), t("deliveredDone"))} data-testid="mark-delivered">
              {t("markDelivered")}
            </Button>
          </div>
        ) : null}
        {s.status === "delivered" ? <p className="text-sm">{t("waitingBuyer", { time: when(s.completeBy) })}</p> : null}
        {s.status === "disputed" && perms === null ? (
          <Link href="/vendor/disputes" className="text-sm font-semibold text-brand-text underline">
            {t("disputed")}
          </Link>
        ) : null}
        {s.status === "completed" && typeof m.net === "number" ? <p className="text-sm">{t("completedNote", { amount: money(m.net) })}</p> : null}
        {perms && ["placed", "accepted", "shipped"].includes(s.status) && !can.length ? <p className="text-sm text-muted">{t("staffNoAction")}</p> : null}
        {s.cancelReason ? <p className="text-sm text-muted">{t("cancelReason", { reason: t.has(`rejectReason.${s.cancelReason}`) ? t(`rejectReason.${s.cancelReason}`) : s.cancelReason })}</p> : null}
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      </div>
    </div>
  );
}

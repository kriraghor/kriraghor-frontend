"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { formatTaka } from "@/lib/admin/finance";
import { REJECT_REASONS, TABS, hoursLeft, shopOrders, type RejectReason, type ShopSub, type Tab } from "@/lib/vendor/orders";
import { Notice } from "../../ui";
import { Chip, inputCls } from "../../admin/finance/shared";
import { Gate } from "../market/ShopDesk";

const btn = "min-h-11 border-2 px-4 text-sm font-bold disabled:opacity-50";
const TONE: Record<string, "ok" | "warn" | "bad" | "muted"> = { placed: "warn", accepted: "warn", shipped: "ok", delivered: "ok", completed: "ok", disputed: "bad", rejected: "muted", expired: "muted", cancelled: "muted", refunded: "muted" };

/**
 * /vendor/orders (M13 FR-08 to FR-12): the shop's orders by tab (to accept, to ship, shipped, done,
 * cancelled) with the time left on each deadline; a sub-order panel to accept (the buyer's phone and
 * address show only then), reject with a reason (the buyer is refunded in full), ship with the courier
 * and tracking number, and mark delivered with an optional photo.
 */
export function OrdersDesk() {
  const t = useTranslations("vendorOrders");
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "to_accept";
  const open = params.get("id");
  const list = useQuery({ queryKey: ["shop-orders", tab], queryFn: () => shopOrders.list(tab), retry: false });
  const problem = problemOf(list.error);
  const money = (n: number) => formatTaka(n, locale);
  const go = (q: { tab?: Tab; id?: string | null }) => {
    const p = new URLSearchParams();
    p.set("tab", q.tab ?? tab);
    if (q.id) p.set("id", q.id);
    router.replace(`/vendor/orders?${p.toString()}`);
  };
  if (problem && ["ROLE_REQUIRED", "ROLE_PENDING", "KYC_REQUIRED", "KYC_PENDING"].includes(problem.code)) return <Gate />;

  return (
    <section className="mx-auto max-w-[1200px] px-5 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <Link href="/vendor/settlement" className="font-semibold text-brand underline">
          {t("settlementLink")}
        </Link>
      </div>
      <p className="mt-1 max-w-3xl text-muted">{t("lead")}</p>
      <div role="tablist" aria-label={t("title")} className="mt-6 flex flex-wrap gap-2">
        {TABS.map((k) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => go({ tab: k })} className={`${btn} ${tab === k ? "border-brand bg-brand text-white" : "border-line"}`} data-testid={`tab-${k}`}>
            {t(`tab.${k}`)} {list.data?.counts?.[k] ? `(${list.data.counts[k]})` : ""}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div>
          {list.isPending ? <div className="h-40 animate-pulse bg-surface-2" /> : null}
          {list.isError && !problem?.code.startsWith("ROLE") ? <Notice tone="error">{t("failed")}</Notice> : null}
          {list.data && !list.data.items.length ? <p className="text-muted">{t(`empty.${tab}`)}</p> : null}
          <ul className="flex flex-col gap-3">
            {(list.data?.items ?? []).map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => go({ id: s.id })} className={`block w-full border-2 p-4 text-left ${open === s.id ? "border-brand" : "border-line hover:border-brand"}`} data-testid="order-row">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-extrabold">{s.code}</span>
                    <Chip tone={TONE[s.status] ?? "muted"}>{t(`status.${s.status}`)}</Chip>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {s.items.map((i) => `${i.qty} × ${i.title} ${locale === "bn" ? i.variantLabelBn : i.variantLabelEn}`).join(", ")}
                  </p>
                  <div className="mt-1 flex flex-wrap justify-between gap-2 text-sm">
                    <span>{s.area ? (locale === "bn" ? s.area.nameBn : s.area.nameEn) : ""}</span>
                    <Deadline s={s} />
                    <span className="font-bold">{money(s.money.total)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
        {open ? <OrderPanel id={open} onClose={() => go({ id: null })} /> : <p className="hidden text-muted lg:block">{t("pick")}</p>}
      </div>
    </section>
  );
}

function Deadline({ s }: { s: ShopSub }) {
  const t = useTranslations("vendorOrders");
  const due = s.status === "placed" ? s.acceptBy : s.status === "accepted" ? s.shipBy : null;
  const h = hoursLeft(due);
  if (h === null) return null;
  return <span className={h < 4 ? "font-bold text-danger" : "text-muted"}>{h < 0 ? t("late") : t(s.status === "placed" ? "acceptIn" : "shipIn", { h })}</span>;
}

function OrderPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useTranslations("vendorOrders");
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
  const money = (n: number) => formatTaka(n, locale);
  const run = async (fn: () => Promise<ShopSub>, done: string) => {
    setMsg(null);
    setBusy(true);
    try {
      const s = await fn();
      qc.setQueryData(["shop-order", id], s);
      await qc.invalidateQueries({ queryKey: ["shop-orders"] });
      setMsg({ text: done, tone: "info" });
    } catch (err) {
      const p = problemOf(err);
      setMsg({ text: p?.errors?.length ? p.errors.map((e) => e.message).join(" · ") : (p?.title ?? t("failed")), tone: "error" });
    } finally {
      setBusy(false);
    }
  };
  if (q.isPending) return <div className="h-64 animate-pulse bg-surface-2" />;
  if (!q.data) return <Notice tone="error">{t("failed")}</Notice>;
  const s = q.data;
  const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso)) : "—");

  return (
    <aside className="h-fit border-2 border-line" data-testid="order-panel">
      <div className="flex items-center justify-between border-b-2 border-line px-4 py-3">
        <div>
          <p className="font-extrabold">{s.code}</p>
          <Chip tone={TONE[s.status] ?? "muted"}>{t(`status.${s.status}`)}</Chip>
        </div>
        <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm font-semibold underline">
          {t("close")}
        </button>
      </div>
      <ul className="divide-y-2 divide-line px-4">
        {s.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-3 py-2 text-sm">
            <span>
              {i.qty} × {i.title} {locale === "bn" ? i.variantLabelBn : i.variantLabelEn}
              {i.sku ? <span className="text-muted"> · {i.sku}</span> : null}
            </span>
            <span className="font-semibold">{money(i.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t-2 border-line px-4 py-3 text-sm" data-testid="order-money">
        <dt className="text-muted">{t("items")}</dt>
        <dd>{money(s.money.items)}</dd>
        <dt className="text-muted">{t("delivery")}</dt>
        <dd>{money(s.money.delivery)}</dd>
        <dt className="text-muted">{t("commission", { pct: s.money.commissionBps / 100 })}</dt>
        <dd>−{money(s.money.commission)}</dd>
        <dt className="font-bold">{t("youGet")}</dt>
        <dd className="font-bold" data-testid="order-net">
          {money(s.money.net)}
        </dd>
        <dt className="text-muted">{t("acceptBy")}</dt>
        <dd>{when(s.acceptBy)}</dd>
        <dt className="text-muted">{t("shipBy")}</dt>
        <dd>{when(s.shipBy)}</dd>
        {s.courier ? (
          <>
            <dt className="text-muted">{t("courier")}</dt>
            <dd>
              {s.courier.name} · {s.courier.trackingNo}
            </dd>
          </>
        ) : null}
      </dl>
      <div className="border-t-2 border-line px-4 py-3 text-sm" data-testid="ship-to">
        <p className="font-semibold">{t("shipTo")}</p>
        {s.shipTo ? (
          <p>
            {s.shipTo.name} · <a href={`tel:${s.shipTo.phone}`} className="underline">{s.shipTo.phone}</a>
            <br />
            {s.shipTo.line}
            {s.area ? `, ${locale === "bn" ? s.area.nameBn : s.area.nameEn}` : ""}
            {s.shipTo.note ? <><br /><span className="text-muted">{s.shipTo.note}</span></> : null}
          </p>
        ) : (
          <p className="text-muted">{t("addressAfterAccept", { area: s.area ? (locale === "bn" ? s.area.nameBn : s.area.nameEn) : "" })}</p>
        )}
      </div>
      <div className="flex flex-col gap-3 border-t-2 border-line px-4 py-4">
        {s.status === "placed" && !rejecting ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} className={`${btn} border-brand bg-brand text-white`} onClick={() => run(() => shopOrders.accept(id), t("accepted"))} data-testid="accept-order">
              {t("accept")}
            </button>
            <button type="button" disabled={busy} className={`${btn} border-danger text-danger`} onClick={() => setRejecting(true)}>
              {t("reject")}
            </button>
          </div>
        ) : null}
        {rejecting && s.status === "placed" ? (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold" htmlFor="reject-reason">
              {t("rejectWhy")}
            </label>
            <select id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value as RejectReason)} className={inputCls}>
              {REJECT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`rejectReason.${r}`)}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">{t("rejectNote")}</p>
            <div className="flex gap-2">
              <button type="button" disabled={busy} className={`${btn} border-danger bg-danger text-white`} onClick={() => run(() => shopOrders.reject(id, reason), t("rejected"))} data-testid="confirm-reject">
                {t("confirmReject")}
              </button>
              <button type="button" className={`${btn} border-line`} onClick={() => setRejecting(false)}>
                {t("back")}
              </button>
            </div>
          </div>
        ) : null}
        {s.status === "accepted" ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => shopOrders.ship(id, courier.trim(), tracking.trim()), t("shipped"));
            }}
          >
            <label className="text-sm font-semibold" htmlFor="courier">
              {t("courierName")}
            </label>
            <input id="courier" value={courier} onChange={(e) => setCourier(e.target.value)} required minLength={2} maxLength={60} placeholder="Pathao, Steadfast, RedX…" className={inputCls} data-testid="courier" />
            <label className="text-sm font-semibold" htmlFor="tracking">
              {t("trackingNo")}
            </label>
            <input id="tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} required pattern="[A-Za-z0-9/\-]{4,40}" className={inputCls} data-testid="tracking" />
            <button type="submit" disabled={busy} className={`${btn} border-brand bg-brand text-white`} data-testid="ship-order">
              {t("ship")}
            </button>
          </form>
        ) : null}
        {s.status === "shipped" ? (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold" htmlFor="proof">
              {t("proof")}
            </label>
            <input id="proof" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setProof(e.target.files?.[0] ?? null)} className="text-sm" />
            <button type="button" disabled={busy} className={`${btn} border-brand bg-brand text-white`} onClick={() => run(() => shopOrders.delivered(id, proof), t("deliveredDone"))} data-testid="mark-delivered">
              {t("markDelivered")}
            </button>
          </div>
        ) : null}
        {s.status === "delivered" ? <p className="text-sm">{t("waitingBuyer", { time: when(s.completeBy) })}</p> : null}
        {s.status === "disputed" ? (
          <Link href="/vendor/disputes" className="text-sm font-semibold text-brand underline">
            {t("disputed")}
          </Link>
        ) : null}
        {s.status === "completed" ? <p className="text-sm">{t("completedNote", { amount: money(s.money.net) })}</p> : null}
        {s.cancelReason ? <p className="text-sm text-muted">{t("cancelReason", { reason: t.has(`rejectReason.${s.cancelReason}`) ? t(`rejectReason.${s.cancelReason}`) : s.cancelReason })}</p> : null}
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      </div>
    </aside>
  );
}

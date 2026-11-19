"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { problemOf, type Problem } from "@kriraghor/api-client";
import { publicEnv } from "@kriraghor/session/env";
import { nextActions } from "@/lib/vendor/grounds";
import { shopDesk, type Shop, type ShopInput, type ShopType } from "@/lib/vendor/market";
import { Notice } from "@kriraghor/ui/primitives";
import { Chip, Field, inputCls } from "../../admin/finance/shared";
import { STATUS_TONE } from "../GroundsDesk";
import { useConfirm, type ConfirmSpec } from "@kriraghor/ui/kit";

const btn = "rounded-control min-h-11 border px-4 text-sm font-bold disabled:opacity-50";
const SHOP_TYPES: ShopType[] = ["sports_gear", "supplements", "gym_gear"];

/**
 * /vendor/shop (M12 FR-01): open the shop (one per owner), edit it, send it for review, pause it, and
 * the stock rules (low-stock alert, hide when out of stock, made-to-order days). Products are listed
 * once the shop is approved.
 */
export function ShopDesk() {
  const t = useTranslations("vendorMarket");
  const q = useQuery({ queryKey: ["vendor-shop"], queryFn: () => shopDesk.profile(), retry: false });
  const problem = problemOf(q.error);
  if (q.isPending) return <div className="rounded-card mx-auto mt-10 h-64 max-w-[1100px] kg-shimmer bg-surface-2" />;
  if (problem && ["ROLE_REQUIRED", "ROLE_PENDING", "KYC_REQUIRED", "KYC_PENDING"].includes(problem.code)) return <Gate />;
  return (
    <section className="mx-auto max-w-[1100px] px-5 py-10">
      <h1 className="text-3xl font-extrabold">{t("shop.title")}</h1>
      <p className="mt-1 max-w-2xl text-muted">{t("shop.lead")}</p>
      {q.data ? <ShopEditor shop={q.data} /> : <ShopForm />}
    </section>
  );
}

export function Gate() {
  const t = useTranslations("vendorMarket");
  const web = publicEnv().WEB_URL;
  return (
    <section className="mx-auto max-w-3xl px-5 py-10" data-testid="shop-gate">
      <Notice tone="error">{t("gate")}</Notice>
      <a href={`${web}/account/business?as=shop`} className="mt-4 inline-block font-semibold text-brand underline">
        {t("gateLink")}
      </a>
    </section>
  );
}

/** Run a shop call and report it; with `confirm` the owner is asked first (tester feedback, 19 Nov 2026). */
function useRun() {
  const qc = useQueryClient();
  const t = useTranslations("vendorMarket");
  const ask = useConfirm();
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, done?: string, confirm?: ConfirmSpec) => {
    if (confirm && !(await ask(confirm))) return false;
    setMsg(null);
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["vendor-shop"] });
      if (done) setMsg({ text: done, tone: "info" });
      return true;
    } catch (err) {
      const p = problemOf(err);
      setMsg({ text: p?.errors?.length ? p.errors.map((e) => e.message).join(" · ") : p?.title ?? t("failed"), tone: "error" });
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { msg, busy, run };
}

function ShopFields({ value, onChange, typeLocked }: { value: ShopInput; onChange: (v: ShopInput) => void; typeLocked: boolean }) {
  const t = useTranslations("vendorMarket");
  const locale = useLocale();
  const areas = useQuery({ queryKey: ["catalog-areas-all"], queryFn: () => shopDesk.areas(), staleTime: 300_000 });
  const set = <K extends keyof ShopInput>(k: K, v: ShopInput[K]) => onChange({ ...value, [k]: v });
  return (
    <>
      <Field label={t("shop.type")}>
        <select value={value.shopType} onChange={(e) => set("shopType", e.target.value as ShopType)} disabled={typeLocked} className={inputCls} data-testid="shop-type">
          {SHOP_TYPES.map((s) => (
            <option key={s} value={s}>
              {t(`shopType.${s}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("shop.name")}>
        <input value={value.name} onChange={(e) => set("name", e.target.value)} minLength={3} maxLength={80} required className={inputCls} data-testid="shop-name" />
      </Field>
      <Field label={t("shop.area")}>
        <select value={value.areaId} onChange={(e) => set("areaId", e.target.value)} required className={inputCls} data-testid="shop-area">
          <option value="">{t("shop.chooseArea")}</option>
          {(areas.data?.items ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {locale === "bn" ? a.nameBn : a.nameEn}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("shop.address")}>
        <input value={value.addressLine} onChange={(e) => set("addressLine", e.target.value)} minLength={5} maxLength={200} required className={inputCls} data-testid="shop-address" />
      </Field>
      <div className="md:col-span-2">
        <Field label={t("shop.about")}>
          <textarea value={value.about ?? ""} onChange={(e) => set("about", e.target.value || null)} maxLength={1000} rows={3} className={`${inputCls} py-2`} />
        </Field>
      </div>
    </>
  );
}

function ShopForm() {
  const t = useTranslations("vendorMarket");
  const qc = useQueryClient();
  const [v, setV] = useState<ShopInput>({ shopType: "sports_gear", name: "", areaId: "", addressLine: "", about: null });
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const ask = useConfirm();
  return (
    <form
      className="rounded-card mt-6 grid gap-4 border border-brand bg-surface p-5 md:grid-cols-2"
      data-testid="shop-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!(await ask("add"))) return;
        setProblem(null);
        setBusy(true);
        try {
          await shopDesk.create(v);
          await qc.invalidateQueries({ queryKey: ["vendor-shop"] });
        } catch (err) {
          setProblem(problemOf(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-xl font-extrabold md:col-span-2">{t("shop.open")}</h2>
      <ShopFields value={v} onChange={setV} typeLocked={false} />
      {problem ? (
        <div className="md:col-span-2">
          <Notice tone="error">{problem.errors?.map((x) => x.message).join(" · ") || problem.title}</Notice>
        </div>
      ) : null}
      <div className="md:col-span-2">
        <button type="submit" disabled={busy} className="min-h-12 bg-brand px-5 font-bold text-on-brand disabled:opacity-50" data-testid="create-shop">
          {t("shop.create")}
        </button>
      </div>
    </form>
  );
}

function ShopEditor({ shop }: { shop: Shop }) {
  const t = useTranslations("vendorMarket");
  const { msg, busy, run } = useRun();
  const actions = nextActions(shop.status, shop.editStatus);
  const locked = !actions.includes("edit");
  const [v, setV] = useState<ShopInput>({ shopType: shop.shopType, name: shop.name, areaId: shop.areaId, addressLine: shop.addressLine, about: shop.about });
  const [rules, setRules] = useState(shop.stockRules);
  const web = publicEnv().WEB_URL;
  const published = ["live", "paused", "suspended"].includes(shop.status);
  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-extrabold" data-testid="shop-title">
          {shop.name}
        </h2>
        <Chip tone={STATUS_TONE[shop.status] ?? "muted"}>{t(`status.${shop.status}`)}</Chip>
        {shop.editStatus ? <Chip tone={shop.editStatus === "changes_requested" || shop.editStatus === "rejected" ? "bad" : "warn"}>{t(`edit.${shop.editStatus}`)}</Chip> : null}
      </div>
      {shop.reviewReason ? (
        <div className="mt-3">
          <Notice tone="error">{t("reviewNote", { reason: t(`reason.${shop.reviewReason.code}`) })}</Notice>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2" data-testid="shop-actions">
        {actions.includes("submit") || actions.includes("submit_edit") ? (
          <button type="button" disabled={busy} className={`${btn} border-brand bg-brand text-on-brand`} onClick={() => void run(() => shopDesk.submit(), t("sent"), { kind: "send", title: t("ask.submitShop") })} data-testid="submit-shop">
            {actions.includes("submit") ? t("submit") : t("submitEdit")}
          </button>
        ) : null}
        {actions.includes("withdraw") ? (
          <button type="button" disabled={busy} className={`${btn} border-line`} onClick={() => void run(() => shopDesk.withdraw(), t("withdrawn"), { kind: "save", title: t("ask.withdrawShop") })}>
            {t("withdraw")}
          </button>
        ) : null}
        {actions.includes("pause") ? (
          <button type="button" disabled={busy} className={`${btn} border-line`} onClick={() => void run(() => shopDesk.pause(), t("paused"), { kind: "save", title: t("ask.pauseShop") })}>
            {t("pause")}
          </button>
        ) : null}
        {actions.includes("resume") ? (
          <button type="button" disabled={busy} className={`${btn} border-brand`} onClick={() => void run(() => shopDesk.resume(), t("resumed"), { kind: "save", title: t("ask.resumeShop") })}>
            {t("resume")}
          </button>
        ) : null}
        {shop.status === "live" ? (
          <>
            <Link href="/vendor/products" className={`${btn} inline-flex items-center border-line`}>
              {t("nav.products")}
            </Link>
            <a href={`${web}/shop/s/${shop.slug}`} className={`${btn} inline-flex items-center border-line`} target="_blank" rel="noreferrer">
              {t("viewPublic")}
            </a>
          </>
        ) : null}
      </div>
      {msg ? (
        <div className="mt-3">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      ) : null}
      <form
        className="rounded-card mt-6 grid gap-4 border border-line bg-surface p-5 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const patch: Partial<ShopInput> = { name: v.name, areaId: v.areaId, addressLine: v.addressLine, about: v.about };
          if (!published) patch.shopType = v.shopType;
          void run(() => shopDesk.update(patch), t("saved"), "save");
        }}
      >
        <h3 className="text-lg font-extrabold md:col-span-2">{t("shop.details")}</h3>
        {published ? <p className="text-sm text-muted md:col-span-2">{t("shop.editHelp")}</p> : null}
        <ShopFields value={v} onChange={setV} typeLocked={published} />
        <div className="md:col-span-2">
          <button type="submit" disabled={busy || locked} className={`${btn} border-brand`}>
            {t("save")}
          </button>
        </div>
      </form>
      <form
        className="rounded-card mt-6 grid gap-4 border border-line bg-surface p-5 md:grid-cols-3"
        data-testid="stock-rules"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => shopDesk.stockRules(rules), t("saved"), "save");
        }}
      >
        <h3 className="text-lg font-extrabold md:col-span-3">{t("rules.title")}</h3>
        <Field label={t("rules.low")}>
          <input type="number" min={0} max={1000} value={rules.lowStockThreshold} onChange={(e) => setRules({ ...rules, lowStockThreshold: Number(e.target.value) })} className={inputCls} />
        </Field>
        <Field label={t("rules.mto")}>
          <input type="number" min={1} max={30} value={rules.mtoDaysDefault} onChange={(e) => setRules({ ...rules, mtoDaysDefault: Number(e.target.value) })} className={inputCls} />
        </Field>
        <label className="flex min-h-11 items-center gap-2 self-end">
          <input type="checkbox" className="h-5 w-5" checked={rules.autoHideOutOfStock} onChange={(e) => setRules({ ...rules, autoHideOutOfStock: e.target.checked })} />
          {t("rules.hide")}
        </label>
        <div className="md:col-span-3">
          <button type="submit" disabled={busy} className={`${btn} border-brand`}>
            {t("rules.save")}
          </button>
        </div>
      </form>
    </>
  );
}

"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { formatTaka } from "@/lib/admin/finance";
import { publicEnv } from "@kriraghor/session/env";
import { nextActions } from "@/lib/vendor/grounds";
import { shopDesk, specsFrom, toPoisha, variantLabel, type ItemType, type Product } from "@/lib/vendor/market";
import { Notice } from "@kriraghor/ui/primitives";
import { DatePicker } from "@kriraghor/ui/date";
import { Chip, Field, inputCls } from "../../admin/finance/shared";
import { STATUS_TONE } from "../GroundsDesk";
import { SpecFields } from "./SpecFields";

const btn = "rounded-control min-h-11 border px-4 text-sm font-bold disabled:opacity-50";
type Msg = { text: string; tone: "info" | "error" } | null;

/** Run an API call, refresh the product, and report the result (problem details or a done message). */
function useRunner(productId: string) {
  const qc = useQueryClient();
  const t = useTranslations("vendorMarket");
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setMsg(null);
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["vendor-product", productId] });
      await qc.invalidateQueries({ queryKey: ["vendor-products"] });
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

/**
 * /vendor/products/[id] (M12 §4 "Add/Edit product"): details and specs from the item type, variants
 * (attributes, SKU, price override, opening stock; expiry and batch for supplements), made-to-order,
 * photos (at least market.product_min_photos) and the review actions. On a live product, title, type,
 * specs, photos, supplement details and big price moves wait for review; the public version stays.
 */
export function ProductEditor({ id }: { id: string }) {
  const t = useTranslations("vendorMarket");
  const q = useQuery({ queryKey: ["vendor-product", id], queryFn: () => shopDesk.product(id) });
  const cats = useQuery({ queryKey: ["market-categories"], queryFn: () => shopDesk.categories(), staleTime: 300_000 });
  const { msg, busy, run } = useRunner(id);
  if (q.isPending) return <div className="rounded-card mx-auto mt-10 h-64 max-w-[1100px] kg-shimmer bg-surface-2" />;
  if (q.isError) return <p className="mx-auto max-w-[1100px] px-5 py-10 text-danger">{problemOf(q.error)?.title ?? t("loadFailed")}</p>;
  const p = q.data;
  const found = (cats.data?.items ?? []).flatMap((c) => c.types.map((type) => ({ category: c, type }))).find((x) => x.type.id === p.itemTypeId);
  const actions = nextActions(p.status, p.editStatus);
  const locked = !actions.includes("edit");
  const web = publicEnv().WEB_URL;

  return (
    <section className="mx-auto max-w-[1100px] px-5 py-8">
      <Link href="/vendor/products" className="text-sm font-semibold text-brand underline">
        ← {t("products.title")}
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold" data-testid="product-name">
          {p.title}
        </h1>
        <Chip tone={STATUS_TONE[p.status] ?? "muted"}>{t(`status.${p.status}`)}</Chip>
        {p.editStatus ? <Chip tone={p.editStatus === "changes_requested" || p.editStatus === "rejected" ? "bad" : "warn"}>{t(`edit.${p.editStatus}`)}</Chip> : null}
        {p.visibility === "hidden_oos" ? <Chip tone="bad">{t("hiddenOos")}</Chip> : null}
      </div>
      {p.reviewReason ? (
        <div className="mt-3">
          <Notice tone="error">{t("reviewNote", { reason: t(`reason.${p.reviewReason.code}`) })}</Notice>
        </div>
      ) : null}
      {p.editStatus === "draft" ? (
        <div className="mt-3">
          <Notice>{t("editNote")}</Notice>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2" data-testid="product-actions">
        {actions.includes("submit") || actions.includes("submit_edit") ? (
          <button type="button" disabled={busy} className={`${btn} border-brand bg-brand text-white`} onClick={() => void run(() => shopDesk.submitProduct(id), t("sent"))} data-testid="submit-product">
            {actions.includes("submit") ? t("submit") : t("submitEdit")}
          </button>
        ) : null}
        {actions.includes("withdraw") ? (
          <button type="button" disabled={busy} className={`${btn} border-line`} onClick={() => void run(() => shopDesk.withdrawProduct(id), t("withdrawn"))}>
            {t("withdraw")}
          </button>
        ) : null}
        {actions.includes("pause") ? (
          <button type="button" disabled={busy} className={`${btn} border-line`} onClick={() => void run(() => shopDesk.pauseProduct(id), t("paused"))}>
            {t("pause")}
          </button>
        ) : null}
        {actions.includes("resume") ? (
          <button type="button" disabled={busy} className={`${btn} border-brand`} onClick={() => void run(() => shopDesk.resumeProduct(id), t("resumed"))}>
            {t("resume")}
          </button>
        ) : null}
        <Link href="/vendor/inventory" className={`${btn} inline-flex items-center border-line`}>
          {t("nav.inventory")}
        </Link>
        {p.status === "live" ? (
          <a href={`${web}/shop/p/${p.slug}`} className={`${btn} inline-flex items-center border-line`} target="_blank" rel="noreferrer">
            {t("viewPublic")}
          </a>
        ) : null}
      </div>
      {msg ? (
        <div className="mt-3">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      ) : null}
      {found ? (
        <>
          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Basics p={p} type={found.type} supplement={found.category.isSupplement} locked={locked} />
            <Photos p={p} locked={locked} />
          </div>
          <Variants p={p} type={found.type} supplement={found.category.isSupplement} locked={locked} />
        </>
      ) : (
        <div className="rounded-card mt-8 h-48 kg-shimmer bg-surface-2" />
      )}
    </section>
  );
}

function Basics({ p, type, supplement, locked }: { p: Product; type: ItemType; supplement: boolean; locked: boolean }) {
  const t = useTranslations("vendorMarket");
  const locale = useLocale();
  const { msg, busy, run } = useRunner(p.id);
  const [f, setF] = useState({ title: p.title, brand: p.brand ?? "", description: p.description ?? "", price: String(p.basePricePoisha / 100), isMto: p.isMto, mtoDays: String(p.mtoDays ?? ""), maxQty: String(p.maxQtyPerOrder), importer: p.importer ?? "", bsti: p.bstiRegNo ?? "" });
  const [specs, setSpecs] = useState<Record<string, string>>(Object.fromEntries(Object.entries(p.specs).map(([k, v]) => [k, String(v)])));
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  return (
    <form
      className="rounded-card grid gap-4 border border-line bg-surface p-5"
      data-testid="product-basics"
      onSubmit={(e) => {
        e.preventDefault();
        const base = toPoisha(f.price);
        if (base === null) return;
        void run(
          () =>
            shopDesk.updateProduct(p.id, {
              title: f.title,
              brand: f.brand || null,
              description: f.description || null,
              basePricePoisha: base,
              isMto: f.isMto,
              mtoDays: f.isMto ? Number(f.mtoDays) || null : null,
              maxQtyPerOrder: Number(f.maxQty),
              specs: specsFrom(type.fields, specs),
              ...(supplement ? { importer: f.importer || null, bstiRegNo: f.bsti || null } : {}),
            }),
          t("saved")
        );
      }}
    >
      <h2 className="text-xl font-extrabold">{t("details")}</h2>
      <Field label={t("form.title")}>
        <input value={f.title} onChange={(e) => set("title", e.target.value)} minLength={3} maxLength={120} required disabled={locked} className={inputCls} />
      </Field>
      <Field label={t("form.brand")}>
        <input value={f.brand} onChange={(e) => set("brand", e.target.value)} maxLength={60} disabled={locked} className={inputCls} />
      </Field>
      <Field label={t("form.basePriceRange", { from: formatTaka(type.priceFloorPoisha, locale), to: formatTaka(type.priceCeilingPoisha, locale) })}>
        <input value={f.price} onChange={(e) => set("price", e.target.value)} inputMode="decimal" required disabled={locked} className={inputCls} data-testid="base-price" />
      </Field>
      <SpecFields fields={type.fields} values={specs} onChange={setSpecs} disabled={locked} />
      {supplement ? (
        <>
          <Field label={t("form.importer")}>
            <input value={f.importer} onChange={(e) => set("importer", e.target.value)} maxLength={120} disabled={locked} className={inputCls} data-testid="importer" />
          </Field>
          <Field label={t("form.bsti")}>
            <input value={f.bsti} onChange={(e) => set("bsti", e.target.value)} maxLength={60} disabled={locked} className={inputCls} />
          </Field>
        </>
      ) : null}
      <Field label={t("form.description")}>
        <textarea value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={4000} rows={4} disabled={locked} className={`${inputCls} py-2`} />
      </Field>
      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" className="h-5 w-5" checked={f.isMto} onChange={(e) => set("isMto", e.target.checked)} disabled={locked} />
        {t("form.isMto")}
      </label>
      {f.isMto ? (
        <Field label={t("form.mtoDays")}>
          <input type="number" min={1} max={30} value={f.mtoDays} onChange={(e) => set("mtoDays", e.target.value)} disabled={locked} className={inputCls} />
        </Field>
      ) : null}
      <Field label={t("form.maxQty")}>
        <input type="number" min={1} max={100} value={f.maxQty} onChange={(e) => set("maxQty", e.target.value)} disabled={locked} className={inputCls} />
      </Field>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <button type="submit" disabled={busy || locked} className={`${btn} border-brand`} data-testid="save-basics">
        {t("save")}
      </button>
    </form>
  );
}

function Photos({ p, locked }: { p: Product; locked: boolean }) {
  const t = useTranslations("vendorMarket");
  const { msg, busy, run } = useRunner(p.id);
  const ids = p.photos.map((x) => x.id);
  const move = (i: number, d: number) => {
    const next = [...ids];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    return run(() => shopDesk.orderPhotos(p.id, next));
  };
  return (
    <div className="rounded-card border border-line bg-surface p-5" data-testid="product-photos">
      <h2 className="text-xl font-extrabold">{t("photos")}</h2>
      <p className="mt-1 text-sm text-muted">{t("photosHelp", { n: p.photos.length })}</p>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {p.photos.map((ph, i) => (
          <li key={ph.id} className="rounded-card border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ph.url} alt={i === 0 ? t("cover") : t("photoN", { n: i + 1 })} className="aspect-square w-full object-cover" />
            <div className="flex items-center gap-1 p-1">
              {i === 0 ? <span className="px-1 text-xs font-bold text-brand">{t("cover")}</span> : null}
              <span className="ml-auto flex gap-1">
                <button type="button" disabled={locked || busy || i === 0} onClick={() => void move(i, -1)} className="rounded-control min-h-9 min-w-9 border border-line-strong/60 text-sm disabled:opacity-40" aria-label={t("moveLeft")}>
                  ←
                </button>
                <button type="button" disabled={locked || busy || i === p.photos.length - 1} onClick={() => void move(i, 1)} className="rounded-control min-h-9 min-w-9 border border-line-strong/60 text-sm disabled:opacity-40" aria-label={t("moveRight")}>
                  →
                </button>
                <button type="button" disabled={locked || busy} onClick={() => void run(() => shopDesk.removePhoto(p.id, ph.id))} className="rounded-control min-h-9 border border-line-strong/60 px-2 text-xs font-semibold text-danger disabled:opacity-40">
                  {t("remove")}
                </button>
              </span>
            </div>
          </li>
        ))}
      </ul>
      <label className="mt-3 block">
        <span className="text-sm font-semibold text-muted">{t("addPhotos")}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={locked || busy}
          data-testid="photo-input"
          className="rounded-control mt-1 block min-h-12 w-full border border-line-strong/60 bg-surface px-3 py-2 text-sm"
          onChange={async (e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            for (const file of files) if (!(await run(() => shopDesk.uploadPhoto(p.id, file)))) break;
          }}
        />
      </label>
      {msg ? (
        <div className="mt-2">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      ) : null}
    </div>
  );
}

function Variants({ p, type, supplement, locked }: { p: Product; type: ItemType; supplement: boolean; locked: boolean }) {
  const t = useTranslations("vendorMarket");
  const locale = useLocale();
  const { msg, busy, run } = useRunner(p.id);
  const axes = type.fields.filter((f) => f.isVariantAxis);
  const label = (x: { labelEn: string; labelBn: string }) => (locale === "bn" ? x.labelBn : x.labelEn);
  const [attrs, setAttrs] = useState<Record<string, string>>({});
  const [f, setF] = useState({ sku: "", price: "", stock: "0", expiry: "", batch: "" });
  const [prices, setPrices] = useState<Record<string, string>>({});
  return (
    <div className="rounded-card mt-8 border border-line bg-surface p-5" data-testid="product-variants">
      <h2 className="text-xl font-extrabold">{t("variants.title")}</h2>
      <p className="mt-1 text-sm text-muted">{axes.length ? t("variants.help", { axes: axes.map(label).join(", ") }) : t("variants.standard")}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b-2 border-line">
              <th className="py-2 pr-3">{t("variants.variant")}</th>
              <th className="py-2 pr-3">{t("variants.sku")}</th>
              <th className="py-2 pr-3">{t("variants.price")}</th>
              <th className="py-2 pr-3">{t("variants.stock")}</th>
              {supplement ? <th className="py-2 pr-3">{t("variants.expiry")}</th> : null}
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {p.variants.map((v) => (
              <tr key={v.id} className="border-b border-line" data-testid="variant-row">
                <td className="py-2 pr-3 font-semibold">{variantLabel(type.fields, v.attributes, locale, t("variants.standardName"))}</td>
                <td className="py-2 pr-3">{v.sku ?? "–"}</td>
                <td className="py-2 pr-3">
                  <span className="flex items-center gap-1">
                    <input
                      aria-label={t("variants.price")}
                      value={prices[v.id] ?? String(v.pricePoisha / 100)}
                      onChange={(e) => setPrices({ ...prices, [v.id]: e.target.value })}
                      disabled={locked}
                      inputMode="decimal"
                      className="rounded-control min-h-9 w-24 border border-line-strong/60 bg-surface px-2"
                    />
                    {prices[v.id] !== undefined ? (
                      <button
                        type="button"
                        disabled={busy || locked}
                        className="rounded-control min-h-9 border border-brand px-2 text-xs font-bold"
                        onClick={() => {
                          const n = toPoisha(prices[v.id]);
                          if (n === null) return;
                          void run(() => shopDesk.updateVariant(v.id, { priceOverridePoisha: n === p.basePricePoisha ? null : n }), t("saved")).then(() => setPrices((all) => Object.fromEntries(Object.entries(all).filter(([k]) => k !== v.id))));
                        }}
                      >
                        {t("save")}
                      </button>
                    ) : null}
                  </span>
                </td>
                <td className="py-2 pr-3 tabular-nums">{p.isMto ? t("mto") : t("variants.onHand", { onHand: v.onHand, held: v.held })}</td>
                {supplement ? <td className={`py-2 pr-3 ${v.saleBlocked ? "text-danger" : ""}`}>{v.expiryDate ?? "–"} {v.batchNo ? `· ${v.batchNo}` : ""}</td> : null}
                <td className="py-2 text-right">
                  <button type="button" disabled={busy || locked || p.variants.length <= 1} className="rounded-control min-h-9 border border-line-strong/60 px-2 text-xs font-semibold text-danger disabled:opacity-40" onClick={() => void run(() => shopDesk.retireVariant(v.id), t("variants.retired"))}>
                    {t("variants.retire")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        className="mt-4 grid gap-3 border-t-2 border-line pt-4 sm:grid-cols-3 lg:grid-cols-6"
        data-testid="add-variant"
        onSubmit={(e) => {
          e.preventDefault();
          const price = f.price ? toPoisha(f.price) : null;
          void run(
            () =>
              shopDesk.addVariant(p.id, {
                attributes: Object.fromEntries(Object.entries(attrs).filter(([, v]) => v)),
                sku: f.sku || null,
                priceOverridePoisha: price,
                openingStock: p.isMto ? undefined : Number(f.stock) || 0,
                ...(supplement ? { expiryDate: f.expiry || null, batchNo: f.batch || null } : {}),
              }),
            t("variants.added")
          ).then((ok) => {
            if (ok) {
              setAttrs({});
              setF({ sku: "", price: "", stock: "0", expiry: "", batch: "" });
            }
          });
        }}
      >
        {axes.map((a) => (
          <Field key={a.key} label={`${label(a)}${a.required ? " *" : ""}`}>
            <select value={attrs[a.key] ?? ""} onChange={(e) => setAttrs({ ...attrs, [a.key]: e.target.value })} disabled={locked} className={inputCls} data-testid={`axis-${a.key}`}>
              <option value="">{t("choose")}</option>
              {a.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {label(o)}
                </option>
              ))}
            </select>
          </Field>
        ))}
        <Field label={t("variants.sku")}>
          <input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} maxLength={40} disabled={locked} className={inputCls} />
        </Field>
        <Field label={t("variants.priceOptional")}>
          <input value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} inputMode="decimal" disabled={locked} className={inputCls} />
        </Field>
        {p.isMto ? null : (
          <Field label={t("variants.opening")}>
            <input type="number" min={0} value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} disabled={locked} className={inputCls} data-testid="opening-stock" />
          </Field>
        )}
        {supplement ? (
          <>
            <DatePicker id="variant-expiry" label={t("variants.expiry")} value={f.expiry} onChange={(v) => setF({ ...f, expiry: v })} disabled={locked} />
            <Field label={t("variants.batch")}>
              <input value={f.batch} onChange={(e) => setF({ ...f, batch: e.target.value })} maxLength={40} disabled={locked} className={inputCls} />
            </Field>
          </>
        ) : null}
        <div className="flex items-end">
          <button type="submit" disabled={busy || locked} className={`${btn} border-brand`} data-testid="add-variant-button">
            {t("variants.add")}
          </button>
        </div>
      </form>
      {msg ? (
        <div className="mt-2">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      ) : null}
    </div>
  );
}

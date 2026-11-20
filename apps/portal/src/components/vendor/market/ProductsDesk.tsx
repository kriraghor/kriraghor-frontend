"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@kriraghor/ui/i18n/navigation";
import { problemOf, type Problem } from "@kriraghor/api-client";
import { formatTaka } from "@/lib/admin/finance";
import { shopDesk, specsFrom, toPoisha, typesForShop, type ShopType } from "@/lib/vendor/market";
import { Notice } from "@kriraghor/ui/primitives";
import { Chip, Field, inputCls } from "../../admin/finance/shared";
import { STATUS_TONE } from "../GroundsDesk";
import { Gate } from "./ShopDesk";
import { SpecFields } from "./SpecFields";
import { useConfirm } from "@kriraghor/ui/kit";

const TABS = ["all", "live", "pending_review", "changes_requested", "draft", "paused", "rejected"] as const;

/** /vendor/products (M12 §4 "Products"): my products by status with stock totals, and "Add a product". */
export function ProductsDesk() {
  const t = useTranslations("vendorMarket");
  const locale = useLocale();
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");
  const [adding, setAdding] = useState(false);
  const shop = useQuery({ queryKey: ["vendor-shop"], queryFn: () => shopDesk.profile(), retry: false });
  const q = useQuery({ queryKey: ["vendor-products"], queryFn: () => shopDesk.products(), retry: false, enabled: Boolean(shop.data) });
  const problem = problemOf(shop.error);
  if (problem && ["ROLE_REQUIRED", "ROLE_PENDING", "KYC_REQUIRED", "KYC_PENDING"].includes(problem.code)) return <Gate />;
  if (shop.isError)
    return (
      <section className="mx-auto max-w-3xl px-5 py-10">
        <Notice>{t("products.noShop")}</Notice>
        <Link href="/vendor/shop" className="mt-4 inline-block font-semibold text-brand underline">
          {t("products.openShop")}
        </Link>
      </section>
    );
  const items = (q.data?.items ?? []).filter((p) => tab === "all" || p.status === tab || (tab === "changes_requested" && p.editStatus === "changes_requested"));
  const name = (x: { nameEn?: string; nameBn?: string } | null | undefined) => (x ? (locale === "bn" ? x.nameBn : x.nameEn) ?? "" : "");
  return (
    <section className="mx-auto max-w-[1100px] px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">{t("products.title")}</h1>
          <p className="mt-1 max-w-2xl text-muted">{t("products.lead")}</p>
        </div>
        <button type="button" className="min-h-12 bg-brand px-5 font-bold text-on-brand hover:bg-brand-hover disabled:opacity-50" disabled={!shop.data} onClick={() => setAdding(true)} data-testid="add-product">
          {t("products.add")}
        </button>
      </div>
      {shop.data && shop.data.status !== "live" ? (
        <div className="mt-4">
          <Notice>{t("products.shopNotLive")}</Notice>
        </div>
      ) : null}
      {adding && shop.data ? <AddProduct shopType={shop.data.shopType} onClose={() => setAdding(false)} /> : null}
      <div role="tablist" aria-label={t("products.title")} className="mt-6 flex flex-wrap gap-2">
        {TABS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-control min-h-11 border px-3 text-sm font-bold ${tab === k ? "border-brand text-ink" : "border-line text-muted"}`}>
            {t(`tab.${k}`)}
          </button>
        ))}
      </div>
      {q.isPending && shop.data ? <div className="rounded-card mt-6 h-48 kg-shimmer bg-surface-2" /> : null}
      {q.data && !items.length ? <p className="rounded-card mt-8 border border-dashed border-line p-8 text-center text-muted">{t("products.empty")}</p> : null}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2" data-testid="my-products">
        {items.map((p) => (
          <li key={p.id}>
            <Link href={`/vendor/products/${p.id}`} className="rounded-card flex h-full gap-4 border border-line bg-surface p-3 hover:border-brand">
              {p.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.coverUrl} alt="" className="h-24 w-24 shrink-0 object-cover" />
              ) : (
                <span className="grid h-24 w-24 shrink-0 place-items-center bg-surface-2 text-xs text-muted">{t("noPhoto")}</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-extrabold">{p.title}</span>
                <span className="block text-sm text-muted">{name(p.itemType as { nameEn?: string; nameBn?: string } | null)}</span>
                <span className="mt-1 flex flex-wrap gap-2">
                  <Chip tone={STATUS_TONE[p.status] ?? "muted"}>{t(`status.${p.status}`)}</Chip>
                  {p.editStatus ? <Chip tone={p.editStatus === "changes_requested" ? "bad" : "warn"}>{t(`edit.${p.editStatus}`)}</Chip> : null}
                  {p.visibility === "hidden_oos" ? <Chip tone="bad">{t("hiddenOos")}</Chip> : null}
                </span>
                <span className="mt-2 block text-sm text-muted">
                  {formatTaka(p.basePricePoisha, locale)} · {t("products.variants", { n: p.variants })} · {p.isMto ? t("mto") : t("products.available", { n: p.available })}
                </span>
                {p.reviewReason ? <span className="mt-1 block text-sm text-danger">{t(`reason.${p.reviewReason.code}`)}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Add a product": item type (allowed for the shop type), title, brand, base price and the type's spec fields. */
function AddProduct({ shopType, onClose }: { shopType: ShopType; onClose: () => void }) {
  const t = useTranslations("vendorMarket");
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["market-categories"], queryFn: () => shopDesk.categories(), staleTime: 300_000 });
  const options = typesForShop(cats.data?.items ?? [], shopType);
  const [typeId, setTypeId] = useState("");
  const [f, setF] = useState({ title: "", brand: "", price: "" });
  const [specs, setSpecs] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const ask = useConfirm();
  const picked = options.find((o) => o.type.id === typeId);
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);
    const base = toPoisha(f.price);
    if (!picked || base === null) return setProblem({ code: "VALIDATION_FAILED", title: t("form.badPrice"), status: 422 });
    if (!(await ask("add"))) return;
    setBusy(true);
    try {
      const p = await shopDesk.createProduct({ itemTypeId: picked.type.id, title: f.title, brand: f.brand || null, basePricePoisha: base, specs: specsFrom(picked.type.fields, specs) });
      await qc.invalidateQueries({ queryKey: ["vendor-products"] });
      router.push(`/vendor/products/${p.id}`);
    } catch (err) {
      setProblem(problemOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-card mt-6 grid gap-4 border border-brand bg-surface p-5 md:grid-cols-2" data-testid="add-product-form">
      <h2 className="text-xl font-extrabold md:col-span-2">{t("products.add")}</h2>
      <div className="md:col-span-2">
        <Field label={t("form.itemType")}>
          <select
            value={typeId}
            onChange={(e) => {
              setTypeId(e.target.value);
              setSpecs({});
            }}
            required
            className={inputCls}
            data-testid="item-type"
          >
            <option value="">{t("choose")}</option>
            {options.map((o) => (
              <option key={o.type.id} value={o.type.id}>
                {name(o.category)} · {name(o.type)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={t("form.title")}>
        <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} minLength={3} maxLength={120} required placeholder={picked ? (locale === "bn" ? picked.type.placeholderBn : picked.type.placeholderEn) ?? "" : ""} className={inputCls} data-testid="product-title" />
      </Field>
      <Field label={t("form.brand")}>
        <input value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} maxLength={60} className={inputCls} />
      </Field>
      <Field label={picked ? t("form.basePriceRange", { from: formatTaka(picked.type.priceFloorPoisha, locale), to: formatTaka(picked.type.priceCeilingPoisha, locale) }) : t("form.basePrice")}>
        <input value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} inputMode="decimal" required className={inputCls} data-testid="product-price" />
      </Field>
      {picked ? <SpecFields fields={picked.type.fields} values={specs} onChange={setSpecs} /> : null}
      <p className="text-xs text-muted md:col-span-2">{t("form.variantsNext")}</p>
      {problem ? (
        <div className="md:col-span-2">
          <Notice tone="error">{problem.errors?.map((x) => x.message).join(" · ") || problem.title}</Notice>
        </div>
      ) : null}
      <div className="flex gap-2 md:col-span-2">
        <button type="submit" disabled={busy} className="min-h-12 bg-brand px-5 font-bold text-on-brand disabled:opacity-50" data-testid="create-product">
          {t("form.create")}
        </button>
        <button type="button" className="rounded-control min-h-12 border border-line-strong/60 px-5 font-bold" onClick={onClose}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}

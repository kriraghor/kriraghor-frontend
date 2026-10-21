"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { api, problemOf } from "@kriraghor/api-client";
import { formatTaka } from "@/lib/admin/finance";
import { parseOptions } from "@/lib/admin/market";
import { Notice } from "@kriraghor/ui/primitives";
import { Chip, Field, inputCls } from "./finance/shared";

type Table = "item-categories" | "item-types" | "item-type-fields";
type Option = { value: string; labelEn: string; labelBn: string };
type Row = {
  id: string;
  key: string;
  nameEn?: string;
  nameBn?: string;
  labelEn?: string;
  labelBn?: string;
  isActive: boolean;
  shopTypes?: string[];
  isSupplement?: boolean;
  categoryId?: string;
  priceFloorPoisha?: number;
  priceCeilingPoisha?: number;
  itemTypeId?: string;
  kind?: string;
  options?: Option[];
  unit?: string | null;
  required?: boolean;
  isVariantAxis?: boolean;
};
const SHOP_TYPES = ["sports_gear", "supplements", "gym_gear"];
const KINDS = ["select", "number", "text", "date"];
const btn = "min-h-10 border-2 px-3 text-sm font-semibold disabled:opacity-50";

async function call<T>(p: Promise<{ data?: T; error?: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error || data === undefined) throw error;
  return data;
}
const listOf = (table: Table, query: Record<string, string> = {}) => call(api("admin").GET("/admin/catalog/{table}", { params: { path: { table }, query } })) as unknown as Promise<{ items: Row[] }>;
const create = (table: Table, body: Record<string, unknown>) => call(api("admin").POST("/admin/catalog/{table}", { params: { path: { table } }, body: body as never }));
const patch = (table: Table, id: string, body: Record<string, unknown>) => call(api("admin").PATCH("/admin/catalog/{table}/{id}", { params: { path: { table, id } }, body: body as never }));
const toggle = (table: Table, id: string, on: boolean) =>
  on ? call(api("admin").POST("/admin/catalog/{table}/{id}/reactivate", { params: { path: { table, id } } })) : call(api("admin").POST("/admin/catalog/{table}/{id}/deactivate", { params: { path: { table, id } } }));

/**
 * /admin/catalog/items (M03-FR-09, §7; manage_catalog): item categories (which shop types sell in
 * them; supplements), item types with the price range a product must fall in (M12-FR-03), and the
 * spec fields M12 validates products against. A pick-list field can be a variant option (size,
 * flavour). Keys never change and rows are never deleted: deactivate hides them from new products.
 */
export function ItemsCatalog() {
  const t = useTranslations("itemsCatalog");
  const locale = useLocale();
  const qc = useQueryClient();
  const [catId, setCatId] = useState<string | null>(null);
  const [typeId, setTypeId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const cats = useQuery({ queryKey: ["items", "cats"], queryFn: () => listOf("item-categories") });
  const types = useQuery({ queryKey: ["items", "types", catId], queryFn: () => listOf("item-types", { categoryId: catId! }), enabled: Boolean(catId) });
  const fields = useQuery({ queryKey: ["items", "fields", typeId], queryFn: () => listOf("item-type-fields", { itemTypeId: typeId! }), enabled: Boolean(typeId) });
  const name = (r: Row) => (locale === "bn" ? r.nameBn ?? r.labelBn : r.nameEn ?? r.labelEn) ?? r.key;
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setMsg(null);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["items"] });
      setMsg({ text: done, tone: "info" });
      return true;
    } catch (err) {
      const p = problemOf(err);
      setMsg({ text: p?.errors?.length ? p.errors.map((e) => e.message).join(" · ") : p?.title ?? t("failed"), tone: "error" });
      return false;
    }
  };

  return (
    <>
      <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-8">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t("intro")}</p>
        {msg ? (
          <div className="mt-4">
            <Notice tone={msg.tone}>{msg.text}</Notice>
          </div>
        ) : null}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Column title={t("categories")} testId="item-categories">
            {(cats.data?.items ?? []).map((c) => (
              <RowItem key={c.id} active={catId === c.id} row={c} label={name(c)} sub={(c.shopTypes ?? []).map((s) => t(`shopType.${s}`)).join(", ")} onPick={() => (setCatId(c.id), setTypeId(null))} onToggle={() => void run(() => toggle("item-categories", c.id, !c.isActive), t("saved"))} badge={c.isSupplement ? t("supplement") : null} />
            ))}
            <AddCategory onAdd={(body) => run(() => create("item-categories", body), t("added"))} />
          </Column>
          <Column title={t("types")} testId="item-types">
            {!catId ? <p className="text-sm text-muted">{t("pickCategory")}</p> : null}
            {(types.data?.items ?? []).map((ty) => (
              <RowItem key={ty.id} active={typeId === ty.id} row={ty} label={name(ty)} sub={`${formatTaka(ty.priceFloorPoisha ?? 0, locale)} – ${formatTaka(ty.priceCeilingPoisha ?? 0, locale)}`} onPick={() => setTypeId(ty.id)} onToggle={() => void run(() => toggle("item-types", ty.id, !ty.isActive), t("saved"))} />
            ))}
            {catId ? <AddType onAdd={(body) => run(() => create("item-types", { ...body, categoryId: catId }), t("added"))} /> : null}
            {typeId ? <PriceRange row={(types.data?.items ?? []).find((x) => x.id === typeId)} onSave={(body) => run(() => patch("item-types", typeId, body), t("saved"))} /> : null}
          </Column>
          <Column title={t("fields")} testId="item-fields">
            {!typeId ? <p className="text-sm text-muted">{t("pickType")}</p> : null}
            {(fields.data?.items ?? []).map((f) => (
              <RowItem
                key={f.id}
                row={f}
                label={name(f)}
                sub={[t(`kind.${f.kind}`), f.isVariantAxis ? t("axis") : null, f.required ? t("required") : null, f.options?.length ? t("optionsN", { n: f.options.length }) : null, f.unit].filter(Boolean).join(" · ")}
                onToggle={() => void run(() => toggle("item-type-fields", f.id, !f.isActive), t("saved"))}
              />
            ))}
            {typeId ? <AddField onAdd={(body) => run(() => create("item-type-fields", { ...body, itemTypeId: typeId }), t("added"))} /> : null}
          </Column>
        </div>
      </div>
    </>
  );
}

function Column({ title, testId, children }: { title: string; testId: string; children: React.ReactNode }) {
  return (
    <section className="border-2 border-line bg-surface p-4" data-testid={testId}>
      <h2 className="text-lg font-extrabold">{title}</h2>
      <ul className="mt-3 space-y-2">{children}</ul>
    </section>
  );
}

function RowItem({ row, label, sub, active, onPick, onToggle, badge }: { row: Row; label: string; sub?: string; active?: boolean; onPick?: () => void; onToggle: () => void; badge?: string | null }) {
  const t = useTranslations("itemsCatalog");
  return (
    <li className={`flex items-start gap-2 border-2 p-2 ${active ? "border-brand" : "border-line"} ${row.isActive ? "" : "opacity-60"}`}>
      <button type="button" disabled={!onPick} onClick={onPick} className="min-h-10 flex-1 text-left disabled:cursor-default">
        <span className="block font-semibold">
          {label} <span className="text-xs text-muted">{row.key}</span>
        </span>
        {sub ? <span className="block text-xs text-muted">{sub}</span> : null}
      </button>
      {badge ? <Chip tone="warn">{badge}</Chip> : null}
      {row.isActive ? null : <Chip tone="muted">{t("inactive")}</Chip>}
      <button type="button" onClick={onToggle} className={btn}>
        {row.isActive ? t("deactivate") : t("reactivate")}
      </button>
    </li>
  );
}

const keyOk = (k: string) => /^[a-z][a-z0-9_]{1,39}$/.test(k);

function AddCategory({ onAdd }: { onAdd: (body: Record<string, unknown>) => Promise<boolean> }) {
  const t = useTranslations("itemsCatalog");
  const [f, setF] = useState({ key: "", nameEn: "", nameBn: "", shopTypes: ["sports_gear"], isSupplement: false });
  return (
    <li className="border-t-2 border-line pt-3">
      <form className="grid gap-2" onSubmit={(e) => (e.preventDefault(), void onAdd(f).then((ok) => ok && setF({ key: "", nameEn: "", nameBn: "", shopTypes: ["sports_gear"], isSupplement: false })))}>
        <p className="text-sm font-bold">{t("addCategory")}</p>
        <input aria-label={t("key")} placeholder={t("key")} value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} pattern="^[a-z][a-z0-9_]{1,39}$" required className={inputCls} />
        <input aria-label={t("nameEn")} placeholder={t("nameEn")} value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} required className={inputCls} />
        <input aria-label={t("nameBn")} placeholder={t("nameBn")} value={f.nameBn} onChange={(e) => setF({ ...f, nameBn: e.target.value })} required className={inputCls} />
        <fieldset className="flex flex-wrap gap-3 text-sm">
          {SHOP_TYPES.map((s) => (
            <label key={s} className="flex items-center gap-1">
              <input type="checkbox" checked={f.shopTypes.includes(s)} onChange={(e) => setF({ ...f, shopTypes: e.target.checked ? [...f.shopTypes, s] : f.shopTypes.filter((x) => x !== s) })} />
              {t(`shopType.${s}`)}
            </label>
          ))}
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.isSupplement} onChange={(e) => setF({ ...f, isSupplement: e.target.checked })} />
          {t("supplementHelp")}
        </label>
        <button type="submit" disabled={!keyOk(f.key) || !f.shopTypes.length} className={`${btn} border-brand`}>
          {t("add")}
        </button>
      </form>
    </li>
  );
}

function AddType({ onAdd }: { onAdd: (body: Record<string, unknown>) => Promise<boolean> }) {
  const t = useTranslations("itemsCatalog");
  const [f, setF] = useState({ key: "", nameEn: "", nameBn: "", floor: "", ceiling: "" });
  return (
    <li className="border-t-2 border-line pt-3">
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void onAdd({ key: f.key, nameEn: f.nameEn, nameBn: f.nameBn, priceFloorPoisha: Math.round(Number(f.floor) * 100), priceCeilingPoisha: Math.round(Number(f.ceiling) * 100) }).then((ok) => ok && setF({ key: "", nameEn: "", nameBn: "", floor: "", ceiling: "" }));
        }}
      >
        <p className="text-sm font-bold">{t("addType")}</p>
        <input aria-label={t("key")} placeholder={t("key")} value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} required className={inputCls} />
        <input aria-label={t("nameEn")} placeholder={t("nameEn")} value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} required className={inputCls} />
        <input aria-label={t("nameBn")} placeholder={t("nameBn")} value={f.nameBn} onChange={(e) => setF({ ...f, nameBn: e.target.value })} required className={inputCls} />
        <div className="grid grid-cols-2 gap-2">
          <input aria-label={t("floor")} placeholder={t("floor")} inputMode="decimal" value={f.floor} onChange={(e) => setF({ ...f, floor: e.target.value })} required className={inputCls} />
          <input aria-label={t("ceiling")} placeholder={t("ceiling")} inputMode="decimal" value={f.ceiling} onChange={(e) => setF({ ...f, ceiling: e.target.value })} required className={inputCls} />
        </div>
        <button type="submit" disabled={!keyOk(f.key)} className={`${btn} border-brand`}>
          {t("add")}
        </button>
      </form>
    </li>
  );
}

function PriceRange({ row, onSave }: { row?: Row; onSave: (body: Record<string, unknown>) => Promise<boolean> }) {
  const t = useTranslations("itemsCatalog");
  const [floor, setFloor] = useState(row ? String((row.priceFloorPoisha ?? 0) / 100) : "");
  const [ceiling, setCeiling] = useState(row ? String((row.priceCeilingPoisha ?? 0) / 100) : "");
  if (!row) return null;
  return (
    <li className="border-t-2 border-line pt-3">
      <form className="grid gap-2" onSubmit={(e) => (e.preventDefault(), void onSave({ priceFloorPoisha: Math.round(Number(floor) * 100), priceCeilingPoisha: Math.round(Number(ceiling) * 100) }))}>
        <p className="text-sm font-bold">{t("priceRange", { name: row.nameEn ?? row.key })}</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t("floor")}>
            <input inputMode="decimal" value={floor} onChange={(e) => setFloor(e.target.value)} className={inputCls} />
          </Field>
          <Field label={t("ceiling")}>
            <input inputMode="decimal" value={ceiling} onChange={(e) => setCeiling(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <button type="submit" className={`${btn} border-brand`}>
          {t("save")}
        </button>
      </form>
    </li>
  );
}

function AddField({ onAdd }: { onAdd: (body: Record<string, unknown>) => Promise<boolean> }) {
  const t = useTranslations("itemsCatalog");
  const empty = { key: "", labelEn: "", labelBn: "", kind: "select", options: "", unit: "", min: "", max: "", required: false, isVariantAxis: false };
  const [f, setF] = useState(empty);
  return (
    <li className="border-t-2 border-line pt-3">
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void onAdd({
            key: f.key,
            labelEn: f.labelEn,
            labelBn: f.labelBn,
            kind: f.kind,
            required: f.required,
            isVariantAxis: f.kind === "select" && f.isVariantAxis,
            ...(f.kind === "select" ? { options: parseOptions(f.options) } : {}),
            ...(f.unit ? { unit: f.unit } : {}),
            ...(f.kind === "number" && f.min ? { minValue: Number(f.min) } : {}),
            ...(f.kind === "number" && f.max ? { maxValue: Number(f.max) } : {}),
          }).then((ok) => ok && setF(empty));
        }}
      >
        <p className="text-sm font-bold">{t("addField")}</p>
        <input aria-label={t("key")} placeholder={t("key")} value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} required className={inputCls} />
        <input aria-label={t("labelEn")} placeholder={t("labelEn")} value={f.labelEn} onChange={(e) => setF({ ...f, labelEn: e.target.value })} required className={inputCls} />
        <input aria-label={t("labelBn")} placeholder={t("labelBn")} value={f.labelBn} onChange={(e) => setF({ ...f, labelBn: e.target.value })} required className={inputCls} />
        <select aria-label={t("kindLabel")} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={inputCls}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`kind.${k}`)}
            </option>
          ))}
        </select>
        {f.kind === "select" ? <textarea aria-label={t("options")} placeholder={t("optionsHelp")} value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} rows={4} className={`${inputCls} py-2`} /> : null}
        {f.kind === "number" ? (
          <div className="grid grid-cols-3 gap-2">
            <input aria-label={t("unit")} placeholder={t("unit")} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} className={inputCls} />
            <input aria-label={t("min")} placeholder={t("min")} inputMode="decimal" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} className={inputCls} />
            <input aria-label={t("max")} placeholder={t("max")} inputMode="decimal" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} className={inputCls} />
          </div>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.required} onChange={(e) => setF({ ...f, required: e.target.checked })} />
          {t("required")}
        </label>
        {f.kind === "select" ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.isVariantAxis} onChange={(e) => setF({ ...f, isVariantAxis: e.target.checked })} />
            {t("axisHelp")}
          </label>
        ) : null}
        <button type="submit" disabled={!keyOk(f.key)} className={`${btn} border-brand`}>
          {t("add")}
        </button>
      </form>
    </li>
  );
}

"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { api, problemOf } from "@/lib/api/client";
import { formatTaka } from "@/lib/admin/finance";
import { Notice } from "../../ui";
import { AdminSubnav } from "../AdminSubnav";
import { Chip, Field, inputCls } from "../finance/shared";
import { useAdminMe } from "../useAdminMe";

type Table = "hire-categories" | "hire-roles";
type Tier = { level: string; labelEn: string; labelBn: string };
type Row = {
  id: string;
  key: string;
  nameEn: string;
  nameBn: string;
  isActive: boolean;
  code?: string;
  forRole?: "player" | "pro";
  categoryId?: string;
  allowedUnits?: string[];
  formatPriced?: boolean;
  formats?: string[];
  baseHourlyPoisha?: number;
  credentialTiers?: Tier[];
  requiresCredential?: boolean;
  policeCheckForU16?: boolean;
};
const LEVELS = ["amateur", "semi_pro", "pro", "national"];
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

/** "pro|BCB Level 2|বিসিবি লেভেল ২" per line ↔ credential tiers. */
const tiersToText = (tiers: Tier[] = []) => tiers.map((x) => `${x.level}|${x.labelEn}|${x.labelBn}`).join("\n");
const textToTiers = (text: string): Tier[] =>
  text
    .split("\n")
    .map((l) => l.split("|").map((x) => x.trim()))
    .filter((p) => p[0])
    .map(([level, labelEn = "", labelBn = ""]) => ({ level, labelEn: labelEn || level, labelBn: labelBn || labelEn || level }));

/**
 * /admin/catalog/hire (M03, M11 §6.1; manage_catalog): hire categories (players list in 01, pros in
 * the rest) and their roles:
 * - how the role is hired (by the hour, by the match, priced per match format);
 * - the base hourly rate its rate limits come from (hire.rate_band, Q74);
 * - the credential tiers (amateur to national), and whether a credential or (for under-16 work) a
 *   police clearance is needed.
 * Keys never change and rows are never deleted: deactivating hides a role from new profiles.
 */
export function HireCatalog() {
  const t = useTranslations("hireAdmin");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready } = useAdminMe();
  const [catId, setCatId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cats = useQuery({ queryKey: ["catalog", "hire-categories"], queryFn: () => listOf("hire-categories"), enabled: ready });
  const cat = cats.data?.items.find((c) => c.id === (catId ?? cats.data?.items[0]?.id));
  const roles = useQuery({ queryKey: ["catalog", "hire-roles", cat?.id], queryFn: () => listOf("hire-roles", { categoryId: cat!.id }), enabled: ready && Boolean(cat) });
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const refresh = () => qc.invalidateQueries({ queryKey: ["catalog", "hire-roles"] });
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await refresh();
      return true;
    } catch (err) {
      const p = problemOf(err);
      setError(p?.errors?.length ? p.errors.map((e) => `${e.field}: ${e.message}`).join(" · ") : (p?.title ?? t("failed")));
      return false;
    }
  };

  return (
    <>
      <AdminSubnav />
      <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-8">
        <h1 className="text-3xl font-extrabold">{t("catalogTitle")}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t("catalogIntro")}</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <ul className="flex flex-col gap-2" data-testid="hire-categories">
            {(cats.data?.items ?? []).map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => (setCatId(c.id), setEdit(null), setAdding(false))} className={`block w-full border-2 p-3 text-left ${cat?.id === c.id ? "border-brand" : "border-line hover:border-brand"}`}>
                  <span className="block font-bold">
                    {c.code} · {name(c)}
                  </span>
                  <span className="text-sm text-muted">{t(`forRole.${c.forRole}`)}</span>
                </button>
              </li>
            ))}
          </ul>
          <div>
            {error ? (
              <div className="mb-3">
                <Notice tone="error">{error}</Notice>
              </div>
            ) : null}
            <ul className="divide-y-2 divide-line border-y-2 border-line" data-testid="hire-roles">
              {(roles.data?.items ?? []).map((r) => (
                <li key={r.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">
                        {name(r)} <span className="font-normal text-muted">({r.key})</span>
                      </span>
                      <span className="block text-sm text-muted">
                        {(r.allowedUnits ?? []).map((u) => t(`unitName.${u}`)).join(" · ")}
                        {r.formatPriced ? ` · ${(r.formats ?? []).join(", ")}` : ""} · {t("baseRate", { rate: formatTaka(r.baseHourlyPoisha ?? 0, locale) })}
                        {r.requiresCredential ? ` · ${t("needsCredential")}` : ""}
                        {r.policeCheckForU16 ? ` · ${t("policeU16")}` : ""}
                      </span>
                    </span>
                    {!r.isActive ? <Chip tone="muted">{t("inactive")}</Chip> : null}
                    <button type="button" className={`${btn} border-line`} onClick={() => (setEdit(r), setAdding(false))}>
                      {t("edit")}
                    </button>
                    <button type="button" className={`${btn} ${r.isActive ? "border-danger text-danger" : "border-line"}`} onClick={() => void run(() => toggle("hire-roles", r.id, !r.isActive))}>
                      {r.isActive ? t("deactivate") : t("reactivate")}
                    </button>
                  </div>
                  {edit?.id === r.id ? <RoleForm row={r} onCancel={() => setEdit(null)} onSave={async (body) => (await run(() => patch("hire-roles", r.id, body))) && setEdit(null)} /> : null}
                </li>
              ))}
            </ul>
            {cat && !adding ? (
              <button type="button" className={`${btn} mt-4 border-brand`} onClick={() => (setAdding(true), setEdit(null))} data-testid="hire-role-add">
                {t("addRole")}
              </button>
            ) : null}
            {cat && adding ? <RoleForm onCancel={() => setAdding(false)} onSave={async (body) => (await run(() => create("hire-roles", { ...body, categoryId: cat.id }))) && setAdding(false)} /> : null}
          </div>
        </div>
      </div>
    </>
  );
}

function RoleForm({ row, onSave, onCancel }: { row?: Row; onSave: (body: Record<string, unknown>) => Promise<unknown>; onCancel: () => void }) {
  const t = useTranslations("hireAdmin");
  const [key, setKey] = useState(row?.key ?? "");
  const [nameEn, setNameEn] = useState(row?.nameEn ?? "");
  const [nameBn, setNameBn] = useState(row?.nameBn ?? "");
  const [units, setUnits] = useState<string[]>(row?.allowedUnits ?? ["match"]);
  const [formatPriced, setFormatPriced] = useState(Boolean(row?.formatPriced));
  const [formats, setFormats] = useState((row?.formats ?? []).join(", "));
  const [base, setBase] = useState(String((row?.baseHourlyPoisha ?? 50000) / 100));
  const [tiers, setTiers] = useState(tiersToText(row?.credentialTiers));
  const [needsCredential, setNeedsCredential] = useState(Boolean(row?.requiresCredential));
  const [police, setPolice] = useState(Boolean(row?.policeCheckForU16));
  const [busy, setBusy] = useState(false);
  const flip = (u: string) => setUnits(units.includes(u) ? units.filter((x) => x !== u) : [...units, u]);
  return (
    <form
      className="mt-3 grid gap-3 border-2 border-line p-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave({
          ...(row ? {} : { key }),
          nameEn,
          nameBn,
          allowedUnits: units,
          formatPriced,
          formats: formatPriced ? formats.split(",").map((f) => f.trim()).filter(Boolean) : [],
          baseHourlyPoisha: Math.round(Number(base) * 100),
          credentialTiers: textToTiers(tiers),
          requiresCredential: needsCredential,
          policeCheckForU16: police,
        });
        setBusy(false);
      }}
      data-testid="hire-role-form"
    >
      {!row ? (
        <Field label={t("key")}>
          <input value={key} onChange={(e) => setKey(e.target.value)} required pattern="[a-z][a-z0-9_]{1,39}" className={inputCls} />
        </Field>
      ) : null}
      <Field label={t("nameEn")}>
        <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} required maxLength={80} className={inputCls} />
      </Field>
      <Field label={t("nameBn")}>
        <input value={nameBn} onChange={(e) => setNameBn(e.target.value)} required maxLength={80} className={inputCls} />
      </Field>
      <Field label={t("baseHourly")}>
        <input inputMode="decimal" value={base} onChange={(e) => setBase(e.target.value)} required className={inputCls} />
      </Field>
      <fieldset className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <legend className="text-sm font-semibold text-muted">{t("hiredBy")}</legend>
        {["hourly", "match"].map((u) => (
          <label key={u} className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="h-5 w-5" checked={units.includes(u)} onChange={() => flip(u)} />
            {t(`unitName.${u}`)}
          </label>
        ))}
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" className="h-5 w-5" checked={formatPriced} onChange={(e) => setFormatPriced(e.target.checked)} />
          {t("formatPriced")}
        </label>
      </fieldset>
      {formatPriced ? (
        <Field label={t("formats")}>
          <input value={formats} onChange={(e) => setFormats(e.target.value)} placeholder="T10, T20, OD, TAPE" className={inputCls} />
        </Field>
      ) : null}
      <Field label={t("tiers", { levels: LEVELS.join(", ") })}>
        <textarea value={tiers} onChange={(e) => setTiers(e.target.value)} rows={4} placeholder="pro|BCB Level 2|বিসিবি লেভেল ২" className="border-2 border-line bg-surface p-2 font-mono text-sm text-ink" />
      </Field>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" className="h-5 w-5" checked={needsCredential} onChange={(e) => setNeedsCredential(e.target.checked)} />
          {t("needsCredential")}
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" className="h-5 w-5" checked={police} onChange={(e) => setPolice(e.target.checked)} />
          {t("policeU16")}
        </label>
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={busy} className={`${btn} border-brand bg-brand text-white`}>
          {t("save")}
        </button>
        <button type="button" className={`${btn} border-line`} onClick={onCancel}>
          {t("close")}
        </button>
      </div>
    </form>
  );
}

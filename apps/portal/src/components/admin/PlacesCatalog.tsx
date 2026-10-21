"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api, problemOf } from "@kriraghor/api-client";
import { Notice } from "@kriraghor/ui/primitives";
import { Chip, Field, inputCls } from "./finance/shared";

type Table = "sports" | "areas" | "facilities" | "surfaces";
const TABLES: Table[] = ["areas", "sports", "facilities", "surfaces"];
type Row = { id: string; key: string; nameEn: string; nameBn: string; isActive: boolean; aliases?: string[]; serviceFlags?: number; isDhakaMetro?: boolean; lat?: number; lng?: number; districtId?: string };
const btn = "min-h-10 border-2 px-3 text-sm font-semibold disabled:opacity-50";

async function call<T>(p: Promise<{ data?: T; error?: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error || data === undefined) throw error;
  return data;
}

/**
 * /admin/catalog/places (M03 §6.1, §6.3; manage_catalog): sports, areas, facilities and surfaces.
 * Keys never change and rows are never deleted (deactivate hides them from pickers). Grounds can be
 * listed only in areas with the grounds service flag (Dhaka metro, Q15).
 */
export function PlacesCatalog() {
  const t = useTranslations("places");
  const qc = useQueryClient();
  const [table, setTable] = useState<Table>("areas");
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const q = useQuery({ queryKey: ["places", table], queryFn: () => call(api("admin").GET("/admin/catalog/{table}", { params: { path: { table } } })) });
  const rows = (q.data?.items ?? []) as unknown as Row[];
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setMsg(null);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["places", table] });
      setMsg({ text: done, tone: "info" });
    } catch (err) {
      const p = problemOf(err);
      setMsg({ text: p?.errors?.length ? p.errors.map((e) => e.message).join(" · ") : p?.title ?? t("failed"), tone: "error" });
    }
  };

  return (
    <>
      <div className="mx-auto max-w-[1100px] px-5 pb-16 pt-8">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t("intro")}</p>
        <div role="tablist" aria-label={t("title")} className="mt-6 flex flex-wrap gap-2">
          {TABLES.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={table === k} onClick={() => (setTable(k), setMsg(null))} className={`min-h-11 border-2 px-4 text-sm font-bold ${table === k ? "border-brand text-ink" : "border-line text-muted"}`}>
              {t(`tab.${k}`)}
            </button>
          ))}
        </div>
        {msg ? (
          <div className="mt-4">
            <Notice tone={msg.tone}>{msg.text}</Notice>
          </div>
        ) : null}
        {q.isError ? <Notice tone="error">{problemOf(q.error)?.title ?? t("failed")}</Notice> : null}
        <ul className="mt-4 divide-y-2 divide-line border-y-2 border-line" data-testid="places-rows">
          {rows.map((r) => (
            <PlaceRow key={r.id} table={table} row={r} onSave={(body, done) => run(() => call(api("admin").PATCH("/admin/catalog/{table}/{id}", { params: { path: { table, id: r.id } }, body: body as never })), done)} onToggle={() =>
              run(() => call(api("admin").POST(r.isActive ? "/admin/catalog/{table}/{id}/deactivate" : "/admin/catalog/{table}/{id}/reactivate", { params: { path: { table, id: r.id } } })), r.isActive ? t("deactivated") : t("reactivated"))
            } />
          ))}
        </ul>
        {table === "areas" || table === "facilities" ? <AddPlace table={table} onAdd={(body) => run(() => call(api("admin").POST("/admin/catalog/{table}", { params: { path: { table } }, body: body as never })), t("added"))} /> : null}
      </div>
    </>
  );
}

function PlaceRow({ table, row, onSave, onToggle }: { table: Table; row: Row; onSave: (body: Record<string, unknown>, done: string) => Promise<void>; onToggle: () => Promise<void> }) {
  const t = useTranslations("places");
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ nameEn: row.nameEn, nameBn: row.nameBn, aliases: (row.aliases ?? []).join(", "), grounds: Boolean((row.serviceFlags ?? 0) & 1) });
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-xs text-muted">{row.key}</span>
        <span className="font-semibold">{row.nameEn}</span>
        <span className="text-muted">{row.nameBn}</span>
        {table === "areas" && (row.serviceFlags ?? 0) & 1 ? <Chip tone="ok">{t("groundsOn")}</Chip> : null}
        {!row.isActive ? <Chip tone="muted">{t("inactive")}</Chip> : null}
        <span className="ml-auto flex gap-2">
          <button type="button" className={`${btn} border-line`} onClick={() => setEdit(!edit)}>
            {t("edit")}
          </button>
          <button type="button" className={`${btn} border-line`} onClick={() => void onToggle()}>
            {row.isActive ? t("deactivate") : t("reactivate")}
          </button>
        </span>
      </div>
      {edit ? (
        <form
          className="mt-3 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const body: Record<string, unknown> = { nameEn: f.nameEn, nameBn: f.nameBn };
            if (table === "areas") {
              body.aliases = f.aliases.split(",").map((x) => x.trim()).filter(Boolean);
              body.serviceFlags = ((row.serviceFlags ?? 0) & ~1) | (f.grounds ? 1 : 0);
            }
            void onSave(body, t("saved")).then(() => setEdit(false));
          }}
        >
          <Field label={t("nameEn")}>
            <input value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} maxLength={80} required className={inputCls} />
          </Field>
          <Field label={t("nameBn")}>
            <input value={f.nameBn} onChange={(e) => setF({ ...f, nameBn: e.target.value })} maxLength={80} required className={inputCls} />
          </Field>
          {table === "areas" ? (
            <>
              <Field label={t("aliases")}>
                <input value={f.aliases} onChange={(e) => setF({ ...f, aliases: e.target.value })} className={inputCls} />
              </Field>
              <label className="flex min-h-11 items-center gap-2 self-end">
                <input type="checkbox" className="h-5 w-5" checked={f.grounds} disabled={!row.isDhakaMetro} onChange={(e) => setF({ ...f, grounds: e.target.checked })} />
                {t("groundsFlag")}
              </label>
            </>
          ) : null}
          <div className="sm:col-span-2">
            <button type="submit" className={`${btn} border-brand`}>
              {t("save")}
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

function AddPlace({ table, onAdd }: { table: "areas" | "facilities"; onAdd: (body: Record<string, unknown>) => Promise<void> }) {
  const t = useTranslations("places");
  const locations = useQuery({ queryKey: ["catalog-locations"], enabled: table === "areas", queryFn: () => call(api("admin").GET("/catalog/locations")) });
  const districts = (locations.data?.items ?? []).flatMap((d) => d.districts);
  const [f, setF] = useState({ key: "", nameEn: "", nameBn: "", districtId: "", lat: "", lng: "", metro: true, zone: "north" });
  return (
    <form
      className="mt-6 grid gap-3 border-2 border-dashed border-line p-4 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        const base = { key: f.key, nameEn: f.nameEn, nameBn: f.nameBn };
        void onAdd(
          table === "facilities"
            ? base
            : { ...base, districtId: f.districtId, lat: Number(f.lat), lng: Number(f.lng), isDhakaMetro: f.metro, dhakaZone: f.metro ? f.zone : null, aliases: [], serviceFlags: f.metro ? 3 : 2 }
        );
      }}
    >
      <p className="font-bold sm:col-span-3">{t(`add.${table}`)}</p>
      <Field label={t("key")}>
        <input value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} pattern="[a-z][a-z0-9_]{1,39}" required className={inputCls} />
      </Field>
      <Field label={t("nameEn")}>
        <input value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} required className={inputCls} />
      </Field>
      <Field label={t("nameBn")}>
        <input value={f.nameBn} onChange={(e) => setF({ ...f, nameBn: e.target.value })} required className={inputCls} />
      </Field>
      {table === "areas" ? (
        <>
          <Field label={t("district")}>
            <select value={f.districtId} onChange={(e) => setF({ ...f, districtId: e.target.value })} required className={inputCls}>
              <option value="">{t("choose")}</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nameEn}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("lat")}>
            <input value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} inputMode="decimal" required className={inputCls} />
          </Field>
          <Field label={t("lng")}>
            <input value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} inputMode="decimal" required className={inputCls} />
          </Field>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="h-5 w-5" checked={f.metro} onChange={(e) => setF({ ...f, metro: e.target.checked })} />
            {t("metro")}
          </label>
          {f.metro ? (
            <Field label={t("zone")}>
              <select value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })} className={inputCls}>
                <option value="north">{t("north")}</option>
                <option value="south">{t("south")}</option>
              </select>
            </Field>
          ) : null}
        </>
      ) : null}
      <div className="sm:col-span-3">
        <button type="submit" className={`${btn} border-brand`}>
          {t("addButton")}
        </button>
      </div>
    </form>
  );
}

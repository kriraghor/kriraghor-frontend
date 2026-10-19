"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { problemOf } from "@/lib/api/client";
import { publicEnv } from "@/lib/env";
import { halfHours, nextActions, vendor, type Court, type HoursRow, type OwnerGround } from "@/lib/vendor/grounds";
import { Notice } from "../ui";
import { Chip, Field, inputCls } from "../admin/finance/shared";
import { STATUS_TONE } from "./GroundsDesk";

const btn = "min-h-11 border-2 px-4 text-sm font-bold disabled:opacity-50";
type Msg = { text: string; tone: "info" | "error" } | null;

/** Run an API call, refresh the ground, and report the result (problem title or a done message). */
function useRunner(groundId: string) {
  const qc = useQueryClient();
  const t = useTranslations("vendorGrounds");
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setMsg(null);
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["vendor-ground", groundId] });
      await qc.invalidateQueries({ queryKey: ["vendor-grounds"] });
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

/** /vendor/grounds/[id]: the owner's working copy (M09 §4.4). */
export function GroundEditor({ id }: { id: string }) {
  const t = useTranslations("vendorGrounds");
  const q = useQuery({ queryKey: ["vendor-ground", id], queryFn: () => vendor.get(id) });
  const { msg, busy, run } = useRunner(id);
  if (q.isPending) return <div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />;
  if (q.isError) return <p className="mx-auto max-w-[1100px] px-5 py-10 text-danger">{problemOf(q.error)?.title ?? t("loadFailed")}</p>;
  const g = q.data;
  const actions = nextActions(g.status, g.editStatus);
  const locked = !actions.includes("edit");
  const web = publicEnv().WEB_URL;

  return (
    <section className="mx-auto max-w-[1100px] px-5 py-8">
      <Link href="/vendor/venues" className="text-sm font-semibold text-brand underline">
        ← {t("title")}
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold">{g.name}</h1>
        <Chip tone={STATUS_TONE[g.status] ?? "muted"}>{t(`status.${g.status}`)}</Chip>
        {g.editStatus ? <Chip tone={g.editStatus === "changes_requested" || g.editStatus === "rejected" ? "bad" : "warn"}>{t(`edit.${g.editStatus}`)}</Chip> : null}
      </div>
      {g.reviewReason ? (
        <div className="mt-3">
          <Notice tone="error">{t("reviewNote", { reason: t(`reason.${g.reviewReason.code}`) })}</Notice>
        </div>
      ) : null}
      {g.editStatus === "draft" ? (
        <div className="mt-3">
          <Notice>{t("editNote")}</Notice>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2" data-testid="ground-actions">
        {actions.includes("submit") ? (
          <button type="button" disabled={busy} className={`${btn} border-brand bg-brand text-white`} onClick={() => void run(() => vendor.submit(id), t("sent"))} data-testid="submit-ground">
            {t("submit")}
          </button>
        ) : null}
        {actions.includes("submit_edit") ? (
          <button type="button" disabled={busy} className={`${btn} border-brand bg-brand text-white`} onClick={() => void run(() => vendor.submit(id), t("sent"))} data-testid="submit-edit">
            {t("submitEdit")}
          </button>
        ) : null}
        {actions.includes("withdraw") ? (
          <button type="button" disabled={busy} className={`${btn} border-line`} onClick={() => void run(() => vendor.withdraw(id), t("withdrawn"))}>
            {t("withdraw")}
          </button>
        ) : null}
        {actions.includes("pause") ? (
          <button type="button" disabled={busy} className={`${btn} border-line`} onClick={() => void run(() => vendor.pause(id), t("paused"))}>
            {t("pause")}
          </button>
        ) : null}
        {actions.includes("resume") ? (
          <button type="button" disabled={busy} className={`${btn} border-brand`} onClick={() => void run(() => vendor.resume(id), t("resumed"))}>
            {t("resume")}
          </button>
        ) : null}
        <Link href={`/vendor/venues/${id}/pricing`} className={`${btn} inline-flex items-center border-line`} data-testid="open-pricing">
          {t("pricing")}
        </Link>
        {g.status === "live" ? (
          <a href={`${web}/grounds/${g.slug}`} className={`${btn} inline-flex items-center border-line`} target="_blank" rel="noreferrer">
            {t("viewPublic")}
          </a>
        ) : null}
      </div>
      {msg ? (
        <div className="mt-3">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Basics g={g} locked={locked} />
        <Photos g={g} locked={locked} />
      </div>
      <Courts g={g} locked={locked} />
    </section>
  );
}

function Basics({ g, locked }: { g: OwnerGround; locked: boolean }) {
  const t = useTranslations("vendorGrounds");
  const areas = useQuery({ queryKey: ["catalog-areas"], queryFn: () => vendor.areas() });
  const facilities = useQuery({ queryKey: ["catalog-facilities"], queryFn: () => vendor.facilities() });
  const [f, setF] = useState({
    name: g.name,
    areaId: g.areaId,
    addressLine: g.addressLine,
    lat: String(g.lat),
    lng: String(g.lng),
    isIndoor: g.isIndoor,
    description: g.description ?? "",
    rulesText: g.rulesText ?? "",
    bookingCutoffMin: g.bookingCutoffMin,
    facilityIds: g.facilityIds,
  });
  const { msg, busy, run } = useRunner(g.id);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <form
      className="grid content-start gap-3 border-2 border-line bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        void run(
          () =>
            vendor.update(g.id, {
              name: f.name,
              areaId: f.areaId,
              addressLine: f.addressLine,
              lat: Number(f.lat),
              lng: Number(f.lng),
              isIndoor: f.isIndoor,
              description: f.description || null,
              rulesText: f.rulesText || null,
              bookingCutoffMin: f.bookingCutoffMin as 0 | 15 | 30 | 60,
              facilityIds: f.facilityIds,
            }),
          t("saved")
        );
      }}
      data-testid="ground-basics"
    >
      <h2 className="text-xl font-extrabold">{t("basics")}</h2>
      <fieldset disabled={locked} className="grid gap-3">
        <Field label={t("form.name")}>
          <input value={f.name} onChange={(e) => set("name", e.target.value)} minLength={3} maxLength={80} required className={inputCls} />
        </Field>
        <Field label={t("form.area")}>
          <select value={f.areaId} onChange={(e) => set("areaId", e.target.value)} className={inputCls}>
            {(areas.data?.items ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.nameEn}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("form.address")}>
          <input value={f.addressLine} onChange={(e) => set("addressLine", e.target.value)} minLength={5} maxLength={200} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("form.lat")}>
            <input value={f.lat} onChange={(e) => set("lat", e.target.value)} inputMode="decimal" className={inputCls} />
          </Field>
          <Field label={t("form.lng")}>
            <input value={f.lng} onChange={(e) => set("lng", e.target.value)} inputMode="decimal" className={inputCls} />
          </Field>
        </div>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" className="h-5 w-5" checked={f.isIndoor} onChange={(e) => set("isIndoor", e.target.checked)} />
          {t("form.indoor")}
        </label>
        <Field label={t("form.description")}>
          <textarea value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={1000} className={`${inputCls} min-h-20 py-2`} />
        </Field>
        <Field label={t("form.rules")}>
          <textarea value={f.rulesText} onChange={(e) => set("rulesText", e.target.value)} maxLength={1000} className={`${inputCls} min-h-20 py-2`} />
        </Field>
        <Field label={t("form.cutoff")}>
          <select value={f.bookingCutoffMin} onChange={(e) => set("bookingCutoffMin", Number(e.target.value) as 0 | 15 | 30 | 60)} className={inputCls}>
            {[0, 15, 30, 60].map((m) => (
              <option key={m} value={m}>
                {t("form.cutoffMin", { n: m })}
              </option>
            ))}
          </select>
        </Field>
        <fieldset>
          <legend className="text-sm font-semibold text-muted">{t("form.facilities")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(facilities.data?.items ?? []).map((x) => {
              const on = f.facilityIds.includes(x.id);
              return (
                <button
                  key={x.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set("facilityIds", on ? f.facilityIds.filter((v) => v !== x.id) : [...f.facilityIds, x.id])}
                  className={`min-h-10 border-2 px-3 text-sm font-semibold ${on ? "border-brand bg-brand/10" : "border-line"}`}
                >
                  {x.nameEn}
                </button>
              );
            })}
          </div>
        </fieldset>
      </fieldset>
      <p className="text-xs text-muted">{t("reviewFields")}</p>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <div>
        <button type="submit" disabled={locked || busy} className={`${btn} border-brand`}>
          {t("save")}
        </button>
      </div>
    </form>
  );
}

function Photos({ g, locked }: { g: OwnerGround; locked: boolean }) {
  const t = useTranslations("vendorGrounds");
  const { msg, busy, run } = useRunner(g.id);
  const ids = g.photos.map((p) => p.id);
  const move = (i: number, d: number) => {
    const next = [...ids];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    return run(() => vendor.orderPhotos(g.id, next));
  };
  return (
    <div className="border-2 border-line bg-surface p-5" data-testid="ground-photos">
      <h2 className="text-xl font-extrabold">{t("photos")}</h2>
      <p className="mt-1 text-sm text-muted">{t("photosHelp", { n: g.photos.length })}</p>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {g.photos.map((p, i) => (
          <li key={p.id} className="border-2 border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={i === 0 ? t("cover") : t("photoN", { n: i + 1 })} className="aspect-[4/3] w-full object-cover" />
            <div className="flex items-center gap-1 p-1">
              {i === 0 ? <span className="px-1 text-xs font-bold text-brand">{t("cover")}</span> : null}
              <span className="ml-auto flex gap-1">
                <button type="button" disabled={locked || busy || i === 0} onClick={() => void move(i, -1)} className="min-h-9 min-w-9 border-2 border-line text-sm disabled:opacity-40" aria-label={t("moveLeft")}>
                  ←
                </button>
                <button type="button" disabled={locked || busy || i === g.photos.length - 1} onClick={() => void move(i, 1)} className="min-h-9 min-w-9 border-2 border-line text-sm disabled:opacity-40" aria-label={t("moveRight")}>
                  →
                </button>
                <button type="button" disabled={locked || busy} onClick={() => void run(() => vendor.removePhoto(g.id, p.id))} className="min-h-9 border-2 border-line px-2 text-xs font-semibold text-danger disabled:opacity-40">
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
          className="mt-1 block min-h-12 w-full border-2 border-line bg-surface px-3 py-2 text-sm"
          onChange={async (e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            for (const file of files) if (!(await run(() => vendor.uploadPhoto(g.id, file)))) break;
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

function Courts({ g, locked }: { g: OwnerGround; locked: boolean }) {
  const t = useTranslations("vendorGrounds");
  const sports = useQuery({ queryKey: ["catalog-sports"], queryFn: () => vendor.sports() });
  const surfaces = useQuery({ queryKey: ["catalog-surfaces"], queryFn: () => vendor.surfaces() });
  const groundSports = (sports.data?.items ?? []).filter((s) => (s.verticalFlags & 1) === 1);
  return (
    <div className="mt-8" data-testid="ground-courts">
      <h2 className="text-xl font-extrabold">{t("courtsTitle")}</h2>
      <div className="mt-3 grid gap-4">
        {g.courts.map((c) => (
          <CourtCard key={c.id} groundId={g.id} court={c} locked={locked} sports={groundSports} surfaces={surfaces.data?.items ?? []} />
        ))}
        {!locked ? <CourtForm groundId={g.id} sports={groundSports} surfaces={surfaces.data?.items ?? []} /> : null}
      </div>
    </div>
  );
}

type Opt = { id: string; nameEn: string };

function SportPicker({ value, onChange, sports }: { value: string[]; onChange: (v: string[]) => void; sports: Opt[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {sports.map((s) => {
        const on = value.includes(s.id);
        return (
          <button key={s.id} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((v) => v !== s.id) : [...value, s.id])} className={`min-h-10 border-2 px-3 text-sm font-semibold ${on ? "border-brand bg-brand/10" : "border-line"}`}>
            {s.nameEn}
          </button>
        );
      })}
    </div>
  );
}

function CourtForm({ groundId, sports, surfaces }: { groundId: string; sports: Opt[]; surfaces: Opt[] }) {
  const t = useTranslations("vendorGrounds");
  const { msg, busy, run } = useRunner(groundId);
  const [f, setF] = useState({ name: "", sportIds: [] as string[], surfaceId: "", sizeText: "", capacityText: "", combinableGroup: "" });
  return (
    <form
      className="grid gap-3 border-2 border-dashed border-line p-4 md:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run(
          () => vendor.addCourt(groundId, { name: f.name, sportIds: f.sportIds, surfaceId: f.surfaceId, sizeText: f.sizeText || null, capacityText: f.capacityText || null, combinableGroup: f.combinableGroup || null }),
          t("courtAdded")
        );
        if (ok) setF({ name: "", sportIds: [], surfaceId: "", sizeText: "", capacityText: "", combinableGroup: "" });
      }}
      data-testid="add-court"
    >
      <p className="font-bold md:col-span-3">{t("addCourt")}</p>
      <Field label={t("court.name")}>
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={40} required className={inputCls} />
      </Field>
      <Field label={t("court.surface")}>
        <select value={f.surfaceId} onChange={(e) => setF({ ...f, surfaceId: e.target.value })} required className={inputCls}>
          <option value="">{t("choose")}</option>
          {surfaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nameEn}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("court.size")}>
        <input value={f.sizeText} onChange={(e) => setF({ ...f, sizeText: e.target.value })} maxLength={40} placeholder="40 x 20 m" className={inputCls} />
      </Field>
      <div className="md:col-span-3">
        <p className="text-sm font-semibold text-muted">{t("court.sports")}</p>
        <div className="mt-1">
          <SportPicker value={f.sportIds} onChange={(v) => setF({ ...f, sportIds: v })} sports={sports} />
        </div>
      </div>
      {msg ? (
        <div className="md:col-span-3">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      ) : null}
      <div className="md:col-span-3">
        <button type="submit" disabled={busy || !f.sportIds.length} className={`${btn} border-brand`}>
          {t("addCourt")}
        </button>
      </div>
    </form>
  );
}

const DAYS = [0, 1, 2, 3, 4, 5, 6];

function CourtCard({ groundId, court, locked, sports, surfaces }: { groundId: string; court: Court; locked: boolean; sports: Opt[]; surfaces: Opt[] }) {
  const t = useTranslations("vendorGrounds");
  const { msg, busy, run } = useRunner(groundId);
  const [f, setF] = useState({ name: court.name, sportIds: court.sportIds, surfaceId: court.surfaceId, sizeText: court.sizeText ?? "", capacityText: court.capacityText ?? "", combinableGroup: court.combinableGroup ?? "" });
  const [hours, setHours] = useState<HoursRow[]>(DAYS.map((dow) => court.hours.find((x) => x.dow === dow) ?? { dow, isClosed: true, openTime: null, closeTime: null }));
  const times = halfHours();
  const setDay = (dow: number, patch: Partial<HoursRow>) => setHours((hs) => hs.map((h) => (h.dow === dow ? { ...h, ...patch } : h)));
  return (
    <div className="border-2 border-line bg-surface p-4" data-testid="court-card">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-extrabold">{court.name}</h3>
        <Chip tone={court.status === "active" ? "ok" : "warn"}>{t(`courtStatus.${court.status}`)}</Chip>
        {!locked ? (
          <button type="button" disabled={busy} className="ml-auto min-h-9 border-2 border-line px-3 text-xs font-semibold text-danger" onClick={() => void run(() => vendor.retireCourt(court.id), t("courtRetired"))}>
            {t("retire")}
          </button>
        ) : null}
      </div>
      <form
        className="mt-3 grid gap-3 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            () => vendor.updateCourt(court.id, { name: f.name, sportIds: f.sportIds, surfaceId: f.surfaceId, sizeText: f.sizeText || null, capacityText: f.capacityText || null, combinableGroup: f.combinableGroup || null }),
            t("saved")
          );
        }}
      >
        <fieldset disabled={locked} className="contents">
          <Field label={t("court.name")}>
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={40} className={inputCls} />
          </Field>
          <Field label={t("court.surface")}>
            <select value={f.surfaceId} onChange={(e) => setF({ ...f, surfaceId: e.target.value })} className={inputCls}>
              {surfaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameEn}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("court.size")}>
            <input value={f.sizeText} onChange={(e) => setF({ ...f, sizeText: e.target.value })} maxLength={40} className={inputCls} />
          </Field>
          <Field label={t("court.capacity")}>
            <input value={f.capacityText} onChange={(e) => setF({ ...f, capacityText: e.target.value })} maxLength={40} placeholder={t("court.capacityHint")} className={inputCls} />
          </Field>
          <Field label={t("court.group")}>
            <input value={f.combinableGroup} onChange={(e) => setF({ ...f, combinableGroup: e.target.value.toLowerCase() })} maxLength={32} placeholder="futsal_full" className={inputCls} />
          </Field>
          <div className="md:col-span-3">
            <SportPicker value={f.sportIds} onChange={(v) => setF({ ...f, sportIds: v })} sports={sports} />
          </div>
        </fieldset>
        {!locked ? (
          <div className="md:col-span-3">
            <button type="submit" disabled={busy || !f.sportIds.length} className={`${btn} border-brand`}>
              {t("saveCourt")}
            </button>
          </div>
        ) : null}
      </form>

      <h4 className="mt-5 font-bold">{t("hours")}</h4>
      <p className="text-xs text-muted">{t("hoursHelp")}</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm" data-testid="hours">
          <tbody>
            {hours.map((h) => (
              <tr key={h.dow} className="border-t border-line">
                <th scope="row" className="py-2 pr-3 text-left font-semibold">
                  {t(`dow.${h.dow}`)}
                </th>
                <td className="py-2 pr-3">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="h-5 w-5" checked={!h.isClosed} onChange={(e) => setDay(h.dow, e.target.checked ? { isClosed: false, openTime: h.openTime ?? "06:00", closeTime: h.closeTime ?? "23:00" } : { isClosed: true })} />
                    {h.isClosed ? t("closed") : t("open")}
                  </label>
                </td>
                <td className="py-2 pr-3">
                  <select disabled={h.isClosed} value={h.openTime ?? ""} onChange={(e) => setDay(h.dow, { openTime: e.target.value })} className={`${inputCls} min-h-10`} aria-label={t("opens")}>
                    {times.slice(0, -1).map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2">
                  <select disabled={h.isClosed} value={h.closeTime ?? ""} onChange={(e) => setDay(h.dow, { closeTime: e.target.value })} className={`${inputCls} min-h-10`} aria-label={t("closes")}>
                    {times.slice(1).map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" disabled={busy} className={`${btn} border-brand`} onClick={() => void run(() => vendor.setHours(court.id, hours.map((h) => (h.isClosed ? { dow: h.dow, isClosed: true, openTime: null, closeTime: null } : h))), t("hoursSaved"))}>
          {t("saveHours")}
        </button>
        <button type="button" className={`${btn} border-line`} onClick={() => setHours((hs) => hs.map((h) => ({ ...hs[1], dow: h.dow })))}>
          {t("copyMonday")}
        </button>
      </div>
      {msg ? (
        <div className="mt-2">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      ) : null}
    </div>
  );
}

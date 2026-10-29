"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { formatTaka } from "@kriraghor/ui/format";
import { publicEnv } from "@kriraghor/session/env";
import { copyDayToAll, gymActions, gymDesk, hoursProblems, windowsOf, type Hours, type OwnerGym } from "@/lib/manage";
import { Notice } from "@kriraghor/ui/primitives";
import { TimePicker } from "@kriraghor/ui/date";
import { Chip, Field, inputCls, STATUS_TONE } from "@kriraghor/ui/desk";

const btn = "min-h-11 border-2 px-4 text-sm font-bold disabled:opacity-50";
const WEEK = [6, 0, 1, 2, 3, 4, 5]; // Saturday first (the Bangladesh week)
type Msg = { text: string; tone: "info" | "error" } | null;

/** Run an API call, refresh the gym and report the result (field problems, the problem title or a done message). */
function useRunner(gymId: string) {
  const qc = useQueryClient();
  const t = useTranslations("vendorGym");
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setMsg(null);
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["vendor-gym", gymId] });
      await qc.invalidateQueries({ queryKey: ["vendor-gyms"] });
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
 * /manage/[gymId]/edit (M20; /vendor/gyms/[id] until 25 Oct 2026): the owner's working copy. A live
 * gym's edits go back to review before they show.
 */
export function GymEditor({ id }: { id: string }) {
  const t = useTranslations("vendorGym");
  const q = useQuery({ queryKey: ["vendor-gym", id], queryFn: () => gymDesk.get(id) });
  const { msg, busy, run } = useRunner(id);
  if (q.isPending) return <div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />;
  if (q.isError) return <p className="mx-auto max-w-[1100px] px-5 py-10 text-danger">{problemOf(q.error)?.title ?? t("loadFailed")}</p>;
  const g = q.data;
  const actions = gymActions(g.status, g.editStatus);
  const locked = !actions.includes("edit");
  const site = publicEnv().GYM_URL;

  return (
    <section className="mx-auto max-w-[1100px] px-5 py-8">
      <Link href="/manage" className="text-sm font-semibold text-brand underline">
        ← {t("title")}
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold" data-testid="gym-name">
          {g.name}
        </h1>
        <Chip tone={STATUS_TONE[g.status] ?? "muted"}>{t(`status.${g.status}`)}</Chip>
        {g.editStatus ? <Chip tone={g.editStatus === "changes_requested" || g.editStatus === "rejected" ? "bad" : "warn"}>{t(`edit.${g.editStatus}`)}</Chip> : null}
      </div>
      {g.reviewReason ? (
        <div className="mt-3">
          <Notice tone="error">{t("reviewNote", { reason: g.reviewReason.text ?? g.reviewReason.code })}</Notice>
        </div>
      ) : null}
      {g.editStatus === "draft" ? (
        <div className="mt-3">
          <Notice>{t("editNote")}</Notice>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2" data-testid="gym-actions">
        {actions.includes("submit") || actions.includes("submit_edit") ? (
          <button type="button" disabled={busy} className={`${btn} border-brand bg-brand text-white`} onClick={() => void run(() => gymDesk.submit(id), t("sent"))} data-testid="submit-gym">
            {actions.includes("submit") ? t("submit") : t("submitEdit")}
          </button>
        ) : null}
        {actions.includes("pause") ? (
          <button type="button" disabled={busy} className={`${btn} border-line`} onClick={() => void run(() => gymDesk.pause(id), t("paused"))}>
            {t("pause")}
          </button>
        ) : null}
        {actions.includes("resume") ? (
          <button type="button" disabled={busy} className={`${btn} border-brand`} onClick={() => void run(() => gymDesk.resume(id), t("resumed"))}>
            {t("resume")}
          </button>
        ) : null}
        {g.status === "live" || g.status === "paused" ? (
          <>
            <Link href={`/manage/${id}/desk`} className={`${btn} inline-flex items-center border-line`}>
              {t("desk.open")}
            </Link>
            <Link href={`/manage/${id}/passes`} className={`${btn} inline-flex items-center border-line`}>
              {t("sold.open")}
            </Link>
          </>
        ) : null}
        {g.status === "live" ? (
          <a href={`${site}/gyms/${g.slug}`} className={`${btn} inline-flex items-center border-line`} target="_blank" rel="noreferrer">
            {t("viewPublic")}
          </a>
        ) : null}
      </div>
      {msg ? (
        <div className="mt-3">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <Basics g={g} locked={locked} />
        <Photos g={g} locked={locked} />
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <WeekHours g={g} locked={locked} />
        <Packages g={g} locked={locked} />
      </div>
    </section>
  );
}

function Basics({ g, locked }: { g: OwnerGym; locked: boolean }) {
  const t = useTranslations("vendorGym");
  const areas = useQuery({ queryKey: ["gym-areas"], queryFn: () => gymDesk.areas() });
  const facilities = useQuery({ queryKey: ["catalog-facilities"], queryFn: () => gymDesk.facilities() });
  const [f, setF] = useState({ name: g.name, areaId: g.areaId, addressLine: g.addressLine, lat: g.lat === null ? "" : String(g.lat), lng: g.lng === null ? "" : String(g.lng), about: g.about ?? "", facilityIds: g.facilityIds, dailyCapacity: g.dailyCapacity === null ? "" : String(g.dailyCapacity) });
  const { msg, busy, run } = useRunner(g.id);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  return (
    <form
      className="grid content-start gap-3 border-2 border-line bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        void run(
          () =>
            gymDesk.update(g.id, {
              name: f.name,
              areaId: f.areaId,
              addressLine: f.addressLine,
              lat: num(f.lat),
              lng: num(f.lng),
              about: f.about.trim() || null,
              facilityIds: f.facilityIds,
              dailyCapacity: num(f.dailyCapacity),
            }),
          t("saved")
        );
      }}
      data-testid="gym-basics"
    >
      <h2 className="text-xl font-extrabold">{t("basics")}</h2>
      <fieldset disabled={locked} className="grid gap-3">
        <Field label={t("form.name")}>
          <input value={f.name} onChange={(e) => set("name", e.target.value)} minLength={3} maxLength={120} required className={inputCls} />
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
          <input value={f.addressLine} onChange={(e) => set("addressLine", e.target.value)} minLength={5} maxLength={300} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("form.lat")}>
            <input value={f.lat} onChange={(e) => set("lat", e.target.value)} inputMode="decimal" className={inputCls} />
          </Field>
          <Field label={t("form.lng")}>
            <input value={f.lng} onChange={(e) => set("lng", e.target.value)} inputMode="decimal" className={inputCls} />
          </Field>
        </div>
        <Field label={t("form.about")}>
          <textarea value={f.about} onChange={(e) => set("about", e.target.value)} maxLength={3000} className={`${inputCls} min-h-24 py-2`} />
        </Field>
        <Field label={t("form.capacity")}>
          <input value={f.dailyCapacity} onChange={(e) => set("dailyCapacity", e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder={t("form.noLimit")} className={inputCls} />
        </Field>
        <fieldset>
          <legend className="text-sm font-semibold text-muted">{t("form.facilities")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(facilities.data?.items ?? []).map((x) => {
              const on = f.facilityIds.includes(x.id);
              return (
                <button key={x.id} type="button" aria-pressed={on} onClick={() => set("facilityIds", on ? f.facilityIds.filter((v) => v !== x.id) : [...f.facilityIds, x.id])} className={`min-h-10 border-2 px-3 text-sm font-semibold ${on ? "border-brand bg-brand/10" : "border-line"}`}>
                  {x.nameEn}
                </button>
              );
            })}
          </div>
        </fieldset>
      </fieldset>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <div>
        <button type="submit" disabled={locked || busy} className={`${btn} border-brand`}>
          {t("save")}
        </button>
      </div>
    </form>
  );
}

function Photos({ g, locked }: { g: OwnerGym; locked: boolean }) {
  const t = useTranslations("vendorGym");
  const { msg, busy, run } = useRunner(g.id);
  const ids = g.photos.map((p) => p.id);
  const move = (i: number, d: number) => {
    const next = [...ids];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    return run(() => gymDesk.orderPhotos(g.id, next));
  };
  return (
    <div className="border-2 border-line bg-surface p-5" data-testid="gym-photos">
      <h2 className="text-xl font-extrabold">{t("photos")}</h2>
      <p className="mt-1 text-sm text-muted">{t("photosHelp", { n: g.photos.length, min: g.limits.minPhotos, max: g.limits.maxPhotos })}</p>
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
                <button type="button" disabled={locked || busy} onClick={() => void run(() => gymDesk.removePhoto(g.id, p.id))} className="min-h-9 border-2 border-line px-2 text-xs font-semibold text-danger disabled:opacity-40">
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
          disabled={locked || busy || g.photos.length >= g.limits.maxPhotos}
          data-testid="gym-photo-input"
          className="mt-1 block min-h-12 w-full border-2 border-line bg-surface px-3 py-2 text-sm"
          onChange={async (e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            for (const file of files) if (!(await run(() => gymDesk.uploadPhoto(g.id, file)))) break;
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

/** The week: up to four windows a day, each optionally women-only. A day without windows is closed. */
function WeekHours({ g, locked }: { g: OwnerGym; locked: boolean }) {
  const t = useTranslations("vendorGym");
  const days = t.raw("days") as string[];
  const [hours, setHours] = useState<Hours>(g.hours);
  const { msg, busy, run } = useRunner(g.id);
  const problems = hoursProblems(hours);
  const others = (dow: number) => hours.filter((h) => h.dow !== dow);
  const setDay = (dow: number, ws: Hours) => setHours([...others(dow), ...ws]);
  return (
    <form
      className="border-2 border-line bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => gymDesk.setHours(g.id, hours.map(({ dow, openTime, closeTime, womenOnly }) => ({ dow, openTime, closeTime, womenOnly }))), t("hoursSaved"));
      }}
      data-testid="gym-hours"
    >
      <h2 className="text-xl font-extrabold">{t("hours")}</h2>
      <p className="mt-1 text-sm text-muted">{t("hoursHelp")}</p>
      <fieldset disabled={locked} className="mt-3 flex flex-col divide-y-2 divide-line">
        {WEEK.map((dow) => {
          const ws = windowsOf(hours, dow);
          return (
            <div key={dow} className="py-3">
              <div className="flex items-center gap-2">
                <span className="w-28 font-bold">{days[dow]}</span>
                {!ws.length ? <span className="text-sm text-muted">{t("closed")}</span> : null}
                <span className="ml-auto flex gap-2">
                  {ws.length < 4 ? (
                    <button type="button" className="min-h-9 border-2 border-line px-2 text-xs font-bold" onClick={() => setDay(dow, [...ws, { dow, openTime: ws.at(-1)?.closeTime ?? "06:00", closeTime: "22:00", womenOnly: false }])}>
                      {t("addWindow")}
                    </button>
                  ) : null}
                  {ws.length ? (
                    <button type="button" className="min-h-9 border-2 border-line px-2 text-xs font-bold" onClick={() => setHours(copyDayToAll(hours, dow))}>
                      {t("copyToAll")}
                    </button>
                  ) : null}
                </span>
              </div>
              {ws.map((w, i) => {
                const bad = problems.find((p) => p.startsWith(`${dow}:${i}:`));
                const patch = (x: Partial<typeof w>) => setDay(dow, ws.map((v, j) => (j === i ? { ...v, ...x } : v)));
                return (
                  <div key={i} className="mt-2 flex flex-wrap items-center gap-2">
                    <TimePicker id={`hours-${dow}-${i}-open`} label={t("opens")} labelHidden step={30} required value={w.openTime} onChange={(v) => patch({ openTime: v })} className="w-40" />
                    <span aria-hidden>–</span>
                    <TimePicker id={`hours-${dow}-${i}-close`} label={t("closes")} labelHidden step={30} endOfDay required value={w.closeTime} onChange={(v) => patch({ closeTime: v })} className="w-48" />
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="checkbox" className="h-5 w-5" checked={w.womenOnly} onChange={(e) => patch({ womenOnly: e.target.checked })} />
                      {t("womenOnly")}
                    </label>
                    <button type="button" className="min-h-9 border-2 border-line px-2 text-xs font-semibold text-danger" onClick={() => setDay(dow, ws.filter((_, j) => j !== i))}>
                      {t("remove")}
                    </button>
                    {bad ? <span className="text-sm text-danger">{t(`hoursProblem.${bad.split(":")[2]}`)}</span> : null}
                  </div>
                );
              })}
            </div>
          );
        })}
      </fieldset>
      {msg ? (
        <div className="mt-2">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      ) : null}
      <button type="submit" disabled={locked || busy || problems.length > 0} className={`${btn} mt-3 border-brand`}>
        {t("saveHours")}
      </button>
    </form>
  );
}

/**
 * The packages, now edited on /manage/[gymId]/packages (M24-FR-24: day, month, 3, 6 and 12 months and
 * custom days, admission fee, channel, visit limit). Saving replaces the whole active set, so this
 * editor only summarises them and links there; a day pass sold online is needed to list the gym.
 */
function Packages({ g }: { g: OwnerGym; locked: boolean }) {
  const t = useTranslations("vendorGym");
  const tg = useTranslations("gm");
  const locale = useLocale();
  const day = g.packages.find((p) => p.kind === "day" && p.channel !== "desk");
  return (
    <div className="border-2 border-line bg-surface p-5" data-testid="gym-packages">
      <h2 className="text-xl font-extrabold">{t("packages")}</h2>
      <p className="mt-1 text-sm text-muted">{t("packagesHelp", { min: formatTaka(g.limits.dayMin, locale), max: formatTaka(g.limits.dayMax, locale) })}</p>
      {g.packages.length ? (
        <ul className="mt-3 divide-y-2 divide-line border-y-2 border-line">
          {[...g.packages].sort((a, b) => a.sort - b.sort).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="font-semibold">{p.title}</span>
              <span className="text-sm text-muted">
                {tg(`kind.${p.kind}`)} · {tg(`channel.${p.channel}`)} · {formatTaka(p.price, locale)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">{t("noPackages")}</p>
      )}
      {!day ? <p className="mt-2 text-sm font-semibold text-danger">{tg("packages.dayNeeded")}</p> : null}
      <Link href={`/manage/${g.id}/packages`} className={`${btn} mt-3 inline-flex items-center border-brand`} data-testid="edit-packages">
        {tg("packages.edit")}
      </Link>
    </div>
  );
}

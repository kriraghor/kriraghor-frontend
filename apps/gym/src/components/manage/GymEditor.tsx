"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Check, ImageSquare, Trash } from "@phosphor-icons/react";
import { Button, ButtonLink, Card, Chip, ChecklistCard, IconButton, Notice, type ChecklistStep } from "@kriraghor/ui/kit";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { formatTaka } from "@kriraghor/ui/format";
import { publicEnv } from "@kriraghor/session/env";
import { copyDayToAll, dayPassState, gymActions, gymDesk, hoursProblems, listingSteps, windowsOf, type Hours, type OwnerGym } from "@/lib/manage";
import { packageRowsOf, packagesPayload } from "@/lib/gym-manage";
import { TimePicker } from "@kriraghor/ui/date";
import { Chip as StatusChip, Field, inputCls, STATUS_TONE } from "@kriraghor/ui/desk";

const WEEK = [6, 0, 1, 2, 3, 4, 5]; // Saturday first (the Bangladesh week)
type Msg = { text: string; tone: "info" | "error"; apply?: boolean } | null;

/** Run an API call, refresh the gym and report the result (field problems, the problem title or a done message). */
function useRunner(gymId: string, explain?: (field: string, message: string) => string) {
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
      // M01 gate: only an approved gym owner can list a gym, so say so and lead to the application.
      if (p?.status === 403 && (p as { role?: string }).role === "gym_owner") return setMsg({ text: t("gate"), tone: "error", apply: true }), false;
      setMsg({ text: p?.errors?.length ? p.errors.map((e) => explain?.(e.field ?? "", e.message) ?? e.message).join("\n") : p?.title ?? t("failed"), tone: "error" });
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { msg, busy, run };
}

/** A saved or failed message, keeping the line per problem. */
function Said({ msg }: { msg: Msg }) {
  const t = useTranslations("vendorGym");
  if (!msg) return null;
  return (
    <div className="mt-3">
      <Notice tone={msg.tone} action={msg.apply ? <ButtonLink href={`${publicEnv().WEB_URL}/account/business?as=gym`} size="sm" data-testid="gym-apply">{t("gateLink")}</ButtonLink> : undefined}>
        <span className="whitespace-pre-line">{msg.text}</span>
      </Notice>
    </div>
  );
}

/** What's left before this gym can go to review, each step leading to where it is fixed (M24-FR-24). */
function ListingChecklist({ g }: { g: OwnerGym }) {
  const t = useTranslations("vendorGym.listing");
  const locale = useLocale();
  const range = { min: formatTaka(g.limits.dayMin, locale), max: formatTaka(g.limits.dayMax, locale) };
  const steps = listingSteps(g);
  const view: ChecklistStep[] = steps.map((s) => {
    if (s.key === "photos") return { key: s.key, done: s.done, label: s.done ? t("photosDone") : t("photos", { need: s.need }), hint: t("photosHint", { have: s.have, need: s.need }), href: "#gym-photos" };
    if (s.key === "hours") return { key: s.key, done: s.done, label: s.done ? t("hoursDone") : t("hours"), hint: t("hoursHint"), href: "#gym-hours" };
    if (s.state === "online") return { key: s.key, done: true, label: t("dayDone") };
    if (s.state === "desk") return { key: s.key, done: false, label: t("dayDesk"), hint: t("dayDeskHint"), href: "#gym-packages" };
    if (s.state === "price") return { key: s.key, done: false, label: t("dayPrice"), hint: t("dayPriceHint", range), href: `/manage/${g.id}/packages` };
    return { key: s.key, done: false, label: t("dayNone"), hint: t("dayNoneHint"), href: `/manage/${g.id}/packages` };
  });
  return <ChecklistCard className="mt-5" title={t("title")} description={t("description")} score={(steps.filter((s) => s.done).length / steps.length) * 100} steps={view} testId="gym-listing" />;
}

/**
 * /manage/[gymId]/edit (M20; /vendor/gyms/[id] until 25 Oct 2026): the owner's working copy. A live
 * gym's edits go back to review before they show.
 */
export function GymEditor({ id }: { id: string }) {
  const t = useTranslations("vendorGym");
  const tl = useTranslations("vendorGym.listing");
  const q = useQuery({ queryKey: ["vendor-gym", id], queryFn: () => gymDesk.get(id) });
  const locale = useLocale();
  const g0 = q.data;
  // The API's completeness problems in the visitor's language, and the exact reason for the day pass.
  const explain = (field: string, message: string) => {
    if (!g0) return message;
    if (field === "photos") return tl("photos", { need: g0.limits.minPhotos });
    if (field === "hours") return tl("hours");
    if (field === "packages" || field === "packages.day") {
      const state = dayPassState(g0);
      if (state === "desk") return t("dayDesk");
      if (state === "price") return t("dayPrice", { min: formatTaka(g0.limits.dayMin, locale), max: formatTaka(g0.limits.dayMax, locale) });
      if (state === "none") return tl("dayNone");
    }
    return message;
  };
  const { msg, busy, run } = useRunner(id, explain);
  // A refusal describes the gym as it was: once the gym changes, it is out of date and goes away.
  const [triedAt, setTriedAt] = useState(0);
  const act = (fn: () => Promise<unknown>, done: string) => {
    setTriedAt(q.dataUpdatedAt);
    void run(fn, done);
  };
  if (q.isPending) return <div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse rounded-card bg-surface-2" />;
  if (q.isError) return <p className="mx-auto max-w-[1100px] px-5 py-10 text-danger">{problemOf(q.error)?.title ?? t("loadFailed")}</p>;
  const g = q.data;
  const actions = gymActions(g.status, g.editStatus);
  const locked = !actions.includes("edit");
  const canSend = actions.includes("submit") || actions.includes("submit_edit");
  const site = publicEnv().GYM_URL;

  return (
    <section className="mx-auto max-w-[1100px] px-4 py-6 sm:px-5 md:py-8">
      <Link href="/manage" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-text underline-offset-4 hover:underline">
        <ArrowLeft size={16} aria-hidden /> {t("title")}
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold" data-testid="gym-name">
          {g.name}
        </h1>
        <StatusChip tone={STATUS_TONE[g.status] ?? "muted"}>{t(`status.${g.status}`)}</StatusChip>
        {g.editStatus ? <StatusChip tone={g.editStatus === "changes_requested" || g.editStatus === "rejected" ? "bad" : "warn"}>{t(`edit.${g.editStatus}`)}</StatusChip> : null}
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
        {canSend ? (
          <Button type="button" busy={busy} onClick={() => act(() => gymDesk.submit(id), t("sent"))} data-testid="submit-gym">
            {actions.includes("submit") ? t("submit") : t("submitEdit")}
          </Button>
        ) : null}
        {actions.includes("pause") ? (
          <Button type="button" variant="secondary" disabled={busy} onClick={() => act(() => gymDesk.pause(id), t("paused"))}>
            {t("pause")}
          </Button>
        ) : null}
        {actions.includes("resume") ? (
          <Button type="button" variant="secondary" disabled={busy} onClick={() => act(() => gymDesk.resume(id), t("resumed"))}>
            {t("resume")}
          </Button>
        ) : null}
        {g.status === "live" || g.status === "paused" ? (
          <>
            <ButtonLink href={`/manage/${id}/desk`} variant="secondary">
              {t("desk.open")}
            </ButtonLink>
            <ButtonLink href={`/manage/${id}/passes`} variant="secondary">
              {t("sold.open")}
            </ButtonLink>
          </>
        ) : null}
        {g.status === "live" ? (
          <a href={`${site}/gyms/${g.slug}`} className="inline-flex min-h-11 items-center rounded-control border border-line-strong/60 bg-surface px-4 text-sm font-semibold no-underline hover:bg-surface-2" target="_blank" rel="noreferrer">
            {t("viewPublic")}
          </a>
        ) : null}
      </div>
      <Said msg={msg?.tone === "error" && triedAt !== q.dataUpdatedAt ? null : msg} />
      {canSend ? <ListingChecklist g={g} /> : null}

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
        <Basics g={g} locked={locked} />
        <div className="grid gap-5">
          <Photos g={g} locked={locked} />
          <Packages g={g} locked={locked} />
        </div>
      </div>
      <div className="mt-5">
        <WeekHours g={g} locked={locked} />
      </div>
    </section>
  );
}

function Basics({ g, locked }: { g: OwnerGym; locked: boolean }) {
  const t = useTranslations("vendorGym");
  const locale = useLocale();
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const areas = useQuery({ queryKey: ["gym-areas"], queryFn: () => gymDesk.areas() });
  const facilities = useQuery({ queryKey: ["catalog-facilities"], queryFn: () => gymDesk.facilities() });
  const [f, setF] = useState({ name: g.name, areaId: g.areaId, addressLine: g.addressLine, lat: g.lat === null ? "" : String(g.lat), lng: g.lng === null ? "" : String(g.lng), about: g.about ?? "", facilityIds: g.facilityIds, dailyCapacity: g.dailyCapacity === null ? "" : String(g.dailyCapacity) });
  const { msg, busy, run } = useRunner(g.id);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  return (
    <Card className="min-w-0" data-testid="gym-basics">
      <form
        className="grid content-start gap-3"
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
                  {name(a)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("form.address")}>
            <input value={f.addressLine} onChange={(e) => set("addressLine", e.target.value)} minLength={5} maxLength={300} className={inputCls} />
          </Field>
          <div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("form.lat")}>
                <input value={f.lat} onChange={(e) => set("lat", e.target.value)} inputMode="decimal" className={inputCls} />
              </Field>
              <Field label={t("form.lng")}>
                <input value={f.lng} onChange={(e) => set("lng", e.target.value)} inputMode="decimal" className={inputCls} />
              </Field>
            </div>
            <p className="mt-1 text-sm text-muted">{t("coordsHint")}</p>
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
                  <Chip key={x.id} active={on} onClick={() => set("facilityIds", on ? f.facilityIds.filter((v) => v !== x.id) : [...f.facilityIds, x.id])}>
                    {on ? <Check size={16} weight="bold" aria-hidden /> : null}
                    {name(x)}
                  </Chip>
                );
              })}
            </div>
          </fieldset>
        </fieldset>
        <Said msg={msg} />
        <div>
          <Button type="submit" variant="secondary" disabled={locked} busy={busy}>
            {t("save")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Photos({ g, locked }: { g: OwnerGym; locked: boolean }) {
  const t = useTranslations("vendorGym");
  const { msg, busy, run } = useRunner(g.id);
  const ids = g.photos.map((p) => p.id);
  const full = g.photos.length >= g.limits.maxPhotos;
  const move = (i: number, d: number) => {
    const next = [...ids];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    return run(() => gymDesk.orderPhotos(g.id, next));
  };
  return (
    <Card id="gym-photos" className="min-w-0 scroll-mt-24" data-testid="gym-photos">
      <h2 className="text-xl font-extrabold">{t("photos")}</h2>
      <p className="mt-1 text-sm text-muted">{t("photosHelp", { n: g.photos.length, min: g.limits.minPhotos, max: g.limits.maxPhotos })}</p>
      <ul className="mt-3 grid grid-cols-2 gap-3">
        {g.photos.map((p, i) => (
          <li key={p.id} className="overflow-hidden rounded-control border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={i === 0 ? t("cover") : t("photoN", { n: i + 1 })} className="aspect-[4/3] w-full object-cover" />
            <div className="flex flex-wrap items-center gap-x-1 p-1">
              {i === 0 ? <span className="px-1.5 text-xs font-bold text-brand-text">{t("cover")}</span> : null}
              <span className="ml-auto flex">
                <IconButton label={t("moveLeft")} disabled={locked || busy || i === 0} className="disabled:opacity-40" onClick={() => void move(i, -1)}>
                  <ArrowLeft size={18} aria-hidden />
                </IconButton>
                <IconButton label={t("moveRight")} disabled={locked || busy || i === g.photos.length - 1} className="disabled:opacity-40" onClick={() => void move(i, 1)}>
                  <ArrowRight size={18} aria-hidden />
                </IconButton>
                <IconButton label={t("remove")} disabled={locked || busy} className="text-danger disabled:opacity-40" onClick={() => void run(() => gymDesk.removePhoto(g.id, p.id))}>
                  <Trash size={18} aria-hidden />
                </IconButton>
              </span>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className={`inline-flex min-h-11 items-center gap-2 rounded-control border border-line-strong/60 bg-surface px-4 text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${locked || busy || full ? "opacity-50" : "cursor-pointer hover:bg-surface-2"}`}>
          <ImageSquare size={18} aria-hidden />
          {t("addPhotos")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={locked || busy || full}
            data-testid="gym-photo-input"
            className="sr-only"
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              for (const file of files) if (!(await run(() => gymDesk.uploadPhoto(g.id, file)))) break;
            }}
          />
        </label>
        <span className="text-sm text-muted">{t("addPhotosHint")}</span>
      </div>
      <Said msg={msg} />
    </Card>
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
    <Card id="gym-hours" className="scroll-mt-24" data-testid="gym-hours">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => gymDesk.setHours(g.id, hours.map(({ dow, openTime, closeTime, womenOnly }) => ({ dow, openTime, closeTime, womenOnly }))), t("hoursSaved"));
        }}
      >
        <h2 className="text-xl font-extrabold">{t("hours")}</h2>
        <p className="mt-1 text-sm text-muted">{t("hoursHelp")}</p>
        <fieldset disabled={locked} className="mt-3 flex flex-col divide-y divide-line">
          {WEEK.map((dow) => {
            const ws = windowsOf(hours, dow);
            return (
              <div key={dow} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-28 font-bold">{days[dow]}</span>
                  {!ws.length ? <span className="text-sm text-muted">{t("closed")}</span> : null}
                  <span className="ml-auto flex flex-wrap gap-2">
                    {ws.length < 4 ? (
                      <Button type="button" size="sm" variant="secondary" onClick={() => setDay(dow, [...ws, { dow, openTime: ws.at(-1)?.closeTime ?? "06:00", closeTime: "22:00", womenOnly: false }])}>
                        {t("addWindow")}
                      </Button>
                    ) : null}
                    {ws.length ? (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setHours(copyDayToAll(hours, dow))}>
                        {t("copyToAll")}
                      </Button>
                    ) : null}
                  </span>
                </div>
                {ws.map((w, i) => {
                  const bad = problems.find((p) => p.startsWith(`${dow}:${i}:`));
                  const patch = (x: Partial<typeof w>) => setDay(dow, ws.map((v, j) => (j === i ? { ...v, ...x } : v)));
                  return (
                    <div key={i} className="mt-2 flex flex-wrap items-center gap-2">
                      <TimePicker id={`hours-${dow}-${i}-open`} label={t("opens")} labelHidden step={30} required value={w.openTime} onChange={(v) => patch({ openTime: v })} className="w-40" />
                      <span aria-hidden>-</span>
                      <TimePicker id={`hours-${dow}-${i}-close`} label={t("closes")} labelHidden step={30} endOfDay required value={w.closeTime} onChange={(v) => patch({ closeTime: v })} className="w-48" />
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <input type="checkbox" className="h-5 w-5" checked={w.womenOnly} onChange={(e) => patch({ womenOnly: e.target.checked })} />
                        {t("womenOnly")}
                      </label>
                      <IconButton label={t("remove")} className="text-danger" onClick={() => setDay(dow, ws.filter((_, j) => j !== i))}>
                        <Trash size={18} aria-hidden />
                      </IconButton>
                      {bad ? <span className="text-sm text-danger">{t(`hoursProblem.${bad.split(":")[2]}`)}</span> : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </fieldset>
        <Said msg={msg} />
        <Button type="submit" variant="secondary" className="mt-3" disabled={locked || problems.length > 0} busy={busy}>
          {t("saveHours")}
        </Button>
      </form>
    </Card>
  );
}

/**
 * The packages, now edited on /manage/[gymId]/packages (M24-FR-24: day, month, 3, 6 and 12 months and
 * custom days, admission fee, channel, visit limit). Saving replaces the whole active set, so this
 * editor summarises them and links there. A day pass sold online is needed to list the gym: one sold
 * only at the desk can be switched here in one tap, keeping every other package as it is.
 */
function Packages({ g, locked }: { g: OwnerGym; locked: boolean }) {
  const t = useTranslations("vendorGym");
  const tg = useTranslations("gm");
  const locale = useLocale();
  const qc = useQueryClient();
  const { msg, busy, run } = useRunner(g.id);
  const state = dayPassState(g);
  const sellOnline = () => {
    const body = packagesPayload(packageRowsOf(g.packages).map((r) => (r.kind === "day" ? { ...r, channel: "both" as const } : r)), g.limits.maxCustomPackages);
    if (!body.ok) return;
    void run(async () => {
      await gymDesk.setPackages(g.id, body.packages);
      await qc.invalidateQueries({ queryKey: ["gm-packages", g.id] });
    }, t("sellDone"));
  };
  return (
    <Card id="gym-packages" className="min-w-0 scroll-mt-24" data-testid="gym-packages">
      <h2 className="text-xl font-extrabold">{t("packages")}</h2>
      <p className="mt-1 text-sm text-muted">{t("packagesHelp", { min: formatTaka(g.limits.dayMin, locale), max: formatTaka(g.limits.dayMax, locale) })}</p>
      {g.packages.length ? (
        <ul className="mt-3 divide-y divide-line">
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
      {state === "desk" ? (
        <div className="mt-3" data-testid="day-desk-only">
          <Notice tone="warning">{t("dayDesk")}</Notice>
          <Button type="button" className="mt-3" disabled={locked} busy={busy} onClick={sellOnline} data-testid="sell-day-online">
            {t("sellOnline")}
          </Button>
        </div>
      ) : null}
      {state === "price" ? (
        <div className="mt-3">
          <Notice tone="warning">{t("dayPrice", { min: formatTaka(g.limits.dayMin, locale), max: formatTaka(g.limits.dayMax, locale) })}</Notice>
        </div>
      ) : null}
      {state === "none" ? (
        <div className="mt-3">
          <Notice tone="warning">{tg("packages.dayNeeded")}</Notice>
        </div>
      ) : null}
      <Said msg={msg} />
      <ButtonLink href={`/manage/${g.id}/packages`} variant="secondary" className="mt-3" data-testid="edit-packages">
        {state === "none" ? t("addDayPass") : tg("packages.edit")}
      </ButtonLink>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { problemOf, type Problem } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { formatTaka } from "@/lib/admin/finance";
import { dhakaIso, halfHours, nextDays, vendor } from "@/lib/vendor/grounds";
import { desk, hhmm, type ClosureReason, type SeriesInput } from "@/lib/vendor/bookings";
import { Notice } from "@kriraghor/ui/primitives";
import { Chip, Field, inputCls } from "../admin/finance/shared";

const REASONS: ClosureReason[] = ["maintenance", "re_turfing", "floodlight_repair", "private_event", "waterlogged"];
type Clash = { kind: string; code?: string; label: string; start: string; end: string };

/**
 * /vendor/grounds/[id]/schedule (M09 step 2, FR-15 to FR-24): close courts for a period (with the
 * clash list first: move or cancel those bookings on the bookings desk) and book weekly series for
 * regular teams (paid at the venue).
 */
export function GroundSchedule({ groundId }: { groundId: string }) {
  const t = useTranslations("vendorSchedule");
  const { status } = useAuth();
  const g = useQuery({ queryKey: ["vendor-ground", groundId], enabled: status === "signed_in", queryFn: () => vendor.get(groundId) });
  if (g.isPending) return <div className="rounded-card mx-auto mt-10 h-64 max-w-[1100px] kg-shimmer bg-surface-2" />;
  if (g.isError || !g.data)
    return (
      <section className="mx-auto max-w-3xl px-5 py-10">
        <Notice tone="error">{problemOf(g.error)?.title ?? t("loadFailed")}</Notice>
      </section>
    );
  const courts = g.data.courts.filter((k) => k.status === "active");
  return (
    <section className="mx-auto max-w-[1100px] px-5 py-8">
      <Link href="/vendor/bookings" className="text-sm font-semibold text-brand underline">
        ← {t("back")}
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold">{t("title", { name: g.data.name })}</h1>
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <Closures groundId={groundId} courts={courts} />
        <SeriesPanel groundId={groundId} courts={courts} />
      </div>
    </section>
  );
}

function Clashes({ problem }: { problem: Problem | null }) {
  const t = useTranslations("vendorSchedule");
  if (!problem) return null;
  const list = ((problem as unknown as { conflicts?: Clash[]; weeks?: { week: number; date: string; clash: string }[] }).conflicts ?? []) as Clash[];
  const weeks = (problem as unknown as { weeks?: { week: number; date: string; clash: string }[] }).weeks ?? [];
  return (
    <div className="mt-3 space-y-2">
      <Notice tone="error">{problem.title}</Notice>
      {list.length ? (
        <ul className="text-sm" data-testid="clashes">
          {list.map((c, i) => (
            <li key={i}>
              {hhmm(c.start)}–{hhmm(c.end)} · {c.kind === "booking" ? `${t("booking")} ${c.code ?? ""}` : t("closure")}
            </li>
          ))}
        </ul>
      ) : null}
      {weeks.length ? <p className="text-sm">{t("clashWeeks", { weeks: weeks.map((w) => w.date).join(", ") })}</p> : null}
    </div>
  );
}

function Closures({ groundId, courts }: { groundId: string; courts: { id: string; name: string }[] }) {
  const t = useTranslations("vendorSchedule");
  const qc = useQueryClient();
  const days = nextDays(90);
  const [day, setDay] = useState(days[1]);
  const [from, setFrom] = useState("06:00");
  const [to, setTo] = useState("12:00");
  const [reason, setReason] = useState<ClosureReason>("maintenance");
  const [picked, setPicked] = useState<string[]>([]);
  const list = useQuery({ queryKey: ["closures", groundId], queryFn: () => desk.closures(groundId, "upcoming") });
  const body = () => ({ start: dhakaIso(day, from), end: dhakaIso(day, to), reason, ...(picked.length ? { courtIds: picked } : {}) });
  const create = useMutation({ mutationFn: () => desk.createClosure(groundId, body()), onSuccess: () => qc.invalidateQueries({ queryKey: ["closures", groundId] }) });
  const act = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onSuccess: () => qc.invalidateQueries({ queryKey: ["closures", groundId] }) });
  return (
    <div>
      <h2 className="text-xl font-extrabold">{t("closures")}</h2>
      <p className="mt-1 text-sm text-muted">{t("closuresLead")}</p>
      <form
        className="mt-4 grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <Field label={t("day")}>
          <select className={inputCls} value={day} onChange={(e) => setDay(e.target.value)}>
            {days.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field label={t("reason")}>
          <select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value as ClosureReason)}>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`reasons.${r}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("from")}>
          <select className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)}>
            {halfHours("00:00", "23:30").map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label={t("to")}>
          <select className={inputCls} value={to} onChange={(e) => setTo(e.target.value)}>
            {halfHours("00:30", "23:30").map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <fieldset className="col-span-2">
          <legend className="text-sm font-semibold text-muted">{t("courts")}</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {courts.map((k) => (
              <label key={k.id} className="rounded-control flex min-h-11 items-center gap-2 border border-line-strong/60 px-3 text-sm">
                <input type="checkbox" checked={picked.includes(k.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, k.id] : picked.filter((x) => x !== k.id))} />
                {k.name}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">{t("allCourts")}</p>
        </fieldset>
        <button type="submit" disabled={create.isPending} className="col-span-2 min-h-12 bg-brand px-5 font-bold text-white disabled:opacity-50" data-testid="create-closure">
          {t("close")}
        </button>
      </form>
      <Clashes problem={create.error ? problemOf(create.error) : null} />
      <ul className="mt-6 divide-y-2 divide-line border-y-2 border-line text-sm">
        {(list.data?.items ?? []).map((x) => (
          <li key={x.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="font-bold">
              {x.start.slice(0, 10)} {hhmm(x.start)}–{hhmm(x.end)}
            </span>
            <Chip tone="muted">{t(`reasons.${x.reason}`)}</Chip>
            <span className="ml-auto flex gap-2">
              {x.phase === "upcoming" ? (
                <button type="button" className="rounded-control min-h-11 border border-line-strong/60 px-3 font-semibold" onClick={() => act.mutate(() => desk.reopen(x.id))}>
                  {t("reopen")}
                </button>
              ) : null}
              {x.phase === "in_progress" ? (
                <button type="button" className="rounded-control min-h-11 border border-line-strong/60 px-3 font-semibold" onClick={() => act.mutate(() => desk.endNow(x.id))}>
                  {t("endNow")}
                </button>
              ) : null}
            </span>
          </li>
        ))}
        {!list.isPending && !list.data?.items.length ? <li className="py-3 text-muted">{t("noClosures")}</li> : null}
      </ul>
    </div>
  );
}

function SeriesPanel({ groundId, courts }: { groundId: string; courts: { id: string; name: string }[] }) {
  const t = useTranslations("vendorSchedule");
  const locale = useLocale();
  const qc = useQueryClient();
  const days = nextDays(30);
  const [form, setForm] = useState<SeriesInput>({ courtId: courts[0]?.id ?? "", teamName: "", dow: new Date(`${days[1]}T12:00:00Z`).getUTCDay(), startTime: "19:00", lengthMin: 60, weeks: 8, firstDate: days[1] });
  const set = (patch: Partial<SeriesInput>) => setForm((f) => ({ ...f, ...patch }));
  const list = useQuery({ queryKey: ["series", groundId], queryFn: () => desk.series(groundId) });
  const preview = useMutation({ mutationFn: () => desk.seriesPreview(groundId, form) });
  const create = useMutation({
    mutationFn: (skip: boolean) => desk.createSeries(groundId, { ...form, skipClashingWeeks: skip }),
    onSuccess: () => {
      preview.reset();
      void qc.invalidateQueries({ queryKey: ["series", groundId] });
    },
  });
  const end = useMutation({ mutationFn: (sid: string) => desk.endSeries(sid), onSuccess: () => qc.invalidateQueries({ queryKey: ["series", groundId] }) });
  const p = preview.data;
  const clashes = p?.weeks.filter((w) => w.clash).length ?? 0;
  return (
    <div>
      <h2 className="text-xl font-extrabold">{t("series")}</h2>
      <p className="mt-1 text-sm text-muted">{t("seriesLead")}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label={t("team")}>
          <input className={inputCls} value={form.teamName} onChange={(e) => set({ teamName: e.target.value })} maxLength={80} />
        </Field>
        <Field label={t("phoneOptional")}>
          <input className={inputCls} value={form.phone ?? ""} onChange={(e) => set({ phone: e.target.value || undefined })} inputMode="tel" autoComplete="off" />
        </Field>
        <Field label={t("court")}>
          <select className={inputCls} value={form.courtId} onChange={(e) => set({ courtId: e.target.value })}>
            {courts.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("firstDate")}>
          <select className={inputCls} value={form.firstDate} onChange={(e) => set({ firstDate: e.target.value, dow: new Date(`${e.target.value}T12:00:00Z`).getUTCDay() })}>
            {days.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field label={t("startTime")}>
          <select className={inputCls} value={form.startTime} onChange={(e) => set({ startTime: e.target.value })}>
            {halfHours("06:00", "22:00").map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label={t("length")}>
          <select className={inputCls} value={form.lengthMin} onChange={(e) => set({ lengthMin: Number(e.target.value) as SeriesInput["lengthMin"] })}>
            {[60, 90, 120, 180].map((m) => (
              <option key={m} value={m}>
                {t("minutes", { n: m })}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("weeks")}>
          <select className={inputCls} value={form.weeks} onChange={(e) => set({ weeks: Number(e.target.value) })}>
            {[4, 6, 8, 12].map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end">
          <button type="button" disabled={form.teamName.trim().length < 2 || preview.isPending} onClick={() => preview.mutate()} className="rounded-control min-h-11 w-full border border-brand px-4 font-bold text-brand disabled:opacity-50" data-testid="series-preview">
            {t("check")}
          </button>
        </div>
      </div>
      <Clashes problem={preview.error ? problemOf(preview.error) : create.error ? problemOf(create.error) : null} />
      {p ? (
        <div className="rounded-card mt-4 border border-line p-3 text-sm">
          <p className="font-bold">{t("perSession", { amount: formatTaka(p.pricePerSession, locale), pct: p.discountPct })}</p>
          <ul className="mt-2 grid grid-cols-2 gap-1">
            {p.weeks.map((w) => (
              <li key={w.week} className={w.clash ? "text-danger" : ""}>
                {w.date} {w.clash ? `· ${t(`clash.${w.clash}`)}` : ""}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => create.mutate(clashes > 0)} disabled={create.isPending} className="mt-3 min-h-11 bg-brand px-4 font-bold text-white disabled:opacity-50" data-testid="series-create">
            {clashes ? t("bookSkipping", { n: clashes }) : t("book", { total: formatTaka(p.total, locale) })}
          </button>
        </div>
      ) : null}
      <ul className="mt-6 divide-y-2 divide-line border-y-2 border-line text-sm">
        {(list.data?.items ?? []).map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="font-bold">{s.teamName}</span>
            <span className="text-muted">
              {t(`dow.${s.dow}`)} {s.startTime} · {t("minutes", { n: s.lengthMin })} · {s.weeks}×
            </span>
            <Chip tone={s.status === "active" ? "ok" : "muted"}>{t(`seriesStatus.${s.status}`)}</Chip>
            {s.status === "active" ? (
              <button type="button" className="rounded-control ml-auto min-h-11 border border-danger px-3 font-semibold text-danger" onClick={() => end.mutate(s.id)}>
                {t("end")}
              </button>
            ) : null}
          </li>
        ))}
        {!list.isPending && !list.data?.items.length ? <li className="py-3 text-muted">{t("noSeries")}</li> : null}
      </ul>
    </div>
  );
}

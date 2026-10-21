"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowsClockwise, CaretLeft, CaretRight, Lock, Prohibit } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { Button, Checkbox, cn, ErrorState, Field, IconButton, MD, Notice, Skeleton, useMinWidth, useToast } from "@kriraghor/ui/kit";
import {
  addDays,
  buildWeek,
  calendar,
  dhakaDayOf,
  HOUR_MS,
  HOURS,
  lastWeekIndex,
  planSave,
  saveErrorOf,
  startingIn,
  toggleCell,
  weekFirstDay,
  weekRange,
  type Block,
  type Calendar,
  type Lock as LockKind,
  type Week,
} from "@/lib/availability";

/**
 * /pro/availability (M11 §4 Manage › Availability, FR-05, FR-14; Round B1): the pro's week on the
 * Dhaka clock, 7 days × 24 hours from today. Tap or drag hours to block or free them (arrow keys and
 * Space work too); booked jobs and weekly repeats are locked here. Save the week with an optional
 * reason (never shown to the public), or save the hours added as a weekly repeat. Weeks go as far as
 * hire.availability_horizon_days (the response carries it). Phones show one day at a time.
 */
export function ProAvailability() {
  const t = useTranslations("hire.cal");
  const [now] = useState(() => Date.now());
  const today = dhakaDayOf(now);
  const [index, setIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const firstDay = weekFirstDay(today, index);
  const range = weekRange(firstDay);
  // The previous week stays as placeholder while the next one loads, so the horizon (hire.availability_horizon_days, sent with each read) stays known.
  const q = useQuery({ queryKey: ["pro-availability", firstDay], queryFn: () => calendar.read(range.from, range.to), placeholderData: keepPreviousData });
  const last = q.data ? lastWeekIndex(q.data.horizonDays) : null;

  return (
    <div className="flex flex-col gap-5" data-testid="pro-availability">
      <div>
        <h2 className="text-2xl font-extrabold">{t("title")}</h2>
        <p className="mt-1 max-w-2xl text-muted">{t("lead")}</p>
      </div>
      <WeekNav firstDay={firstDay} index={index} last={last} locked={dirty} onGo={setIndex} />
      {q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : !q.data || q.isPlaceholderData ? (
        <Skeleton className="h-[480px] rounded-card" />
      ) : (
        <WeekEditor key={`${firstDay}:${q.dataUpdatedAt}`} firstDay={firstDay} data={q.data} now={now} today={today} onDirty={setDirty} />
      )}
    </div>
  );
}

function WeekNav({ firstDay, index, last, locked, onGo }: { firstDay: string; index: number; last: number | null; locked: boolean; onGo: (i: number) => void }) {
  const t = useTranslations("hire.cal");
  const locale = useLocale();
  const fmt = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const label = `${fmt.format(new Date(`${firstDay}T00:00:00Z`))} – ${fmt.format(new Date(`${addDays(firstDay, 6)}T00:00:00Z`))}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <IconButton label={t("prevWeek")} variant="secondary" disabled={locked || index === 0} onClick={() => onGo(index - 1)} data-testid="cal-prev">
        <CaretLeft size={20} aria-hidden />
      </IconButton>
      <p className="min-w-40 text-center font-bold tabular-nums" aria-live="polite" data-testid="cal-week">
        {label}
      </p>
      <IconButton label={t("nextWeek")} variant="secondary" disabled={locked || last === null || index >= last} onClick={() => onGo(index + 1)} data-testid="cal-next">
        <CaretRight size={20} aria-hidden />
      </IconButton>
      {index > 0 ? (
        <Button type="button" variant="ghost" disabled={locked} onClick={() => onGo(0)}>
          {t("thisWeek")}
        </Button>
      ) : null}
      {locked ? <p className="w-full text-sm text-muted">{t("saveFirst")}</p> : null}
    </div>
  );
}

type Kind = "free" | "blocked" | LockKind;

const KIND_CLASS: Record<Kind, string> = {
  free: "bg-surface hover:bg-surface-2",
  blocked: "bg-warning-soft text-warning",
  repeat: "bg-warning-soft/70 text-warning",
  outside: "bg-warning-soft/70 text-warning",
  booked: "bg-brand-soft text-brand-text",
  past: "bg-surface-2 text-muted opacity-60",
  horizon: "bg-surface-2 text-muted opacity-40",
};

function KindIcon({ kind, size }: { kind: Kind; size: number }) {
  if (kind === "blocked") return <Prohibit size={size} weight="bold" aria-hidden />;
  if (kind === "repeat") return <ArrowsClockwise size={size} weight="bold" aria-hidden />;
  if (kind === "booked" || kind === "outside") return <Lock size={size} weight="bold" aria-hidden />;
  return null;
}

function WeekEditor({ firstDay, data, now, today, onDirty }: { firstDay: string; data: Calendar; now: number; today: string; onDirty: (d: boolean) => void }) {
  const t = useTranslations("hire.cal");
  const locale = useLocale();
  const qc = useQueryClient();
  const toast = useToast();
  const wide = useMinWidth(MD, false);
  const week = useMemo(() => buildWeek(firstDay, data, now), [firstDay, data, now]);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(week.initial));
  const [reason, setReason] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [until, setUntil] = useState("");
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [day, setDay] = useState(0);
  const [focus, setFocus] = useState(() => firstFree(week));
  const cellRefs = useRef(new Map<number, HTMLDivElement>());
  const drag = useRef<{ on: boolean; last: number } | null>(null);

  const opts = { reason, repeat, until: until || null, repeats: data.repeats, removedRepeats: removed };
  const plan = planSave(week, selected, opts);
  useEffect(() => onDirty(plan.dirty), [plan.dirty, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);

  const save = useMutation({
    mutationFn: async () => {
      // A block that runs past the week grows the save range; the blocks after the week that the
      // range now covers are read first and kept as they are.
      let carry: Block[] = [];
      let loadedTo = week.from + 7 * 24 * HOUR_MS;
      let p = planSave(week, selected, opts);
      for (let i = 0; i < 3 && new Date(p.body.to).getTime() > loadedTo; i += 1) {
        const more = await calendar.read(new Date(loadedTo).toISOString(), p.body.to);
        const next = new Date(p.body.to).getTime();
        carry = [...carry, ...startingIn(more.blocks, loadedTo, next).filter((b) => !carry.some((c) => c.id === b.id))];
        loadedTo = next;
        p = planSave(week, selected, { ...opts, carry });
      }
      return calendar.save(p.body);
    },
    onSuccess: async () => {
      toast.show(t("saved"));
      await Promise.all([qc.invalidateQueries({ queryKey: ["pro-availability"] }), qc.invalidateQueries({ queryKey: ["pro-profiles"] })]);
    },
  });
  const saveError = save.error ? saveErrorOf(save.error) : null;

  const kindOf = (c: number): Kind => week.locks[c] ?? (selected.has(c) ? "blocked" : "free");
  const dayFmt = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });
  const longDay = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const hourFmt = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
  const hourLabel = (h: number) => hourFmt.format(new Date(Date.UTC(2000, 0, 1, h)));
  const dayDate = (d: number) => new Date(`${week.days[d]}T00:00:00Z`);
  const blockReason = (c: number) => week.inWeek.find((b) => new Date(b.start).getTime() < week.from + (c + 1) * HOUR_MS && new Date(b.end).getTime() > week.from + c * HOUR_MS)?.reason ?? null;
  const stateText = (c: number) => {
    const k = kindOf(c);
    return k === "booked" ? t("kind.bookedCode", { code: week.jobAt[c] ?? "" }) : t(`kind.${k}`);
  };
  const cellLabel = (c: number) => {
    const d = Math.floor(c / HOURS);
    const h = c % HOURS;
    return `${longDay.format(dayDate(d))}, ${hourLabel(h)}–${h === 23 ? "24:00" : hourLabel(h + 1)}: ${stateText(c)}`;
  };

  // ---- pointer: tap toggles; drag paints the state of the first cell
  const cellAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-cell]");
    return el ? Number(el.dataset.cell) : null;
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const c = cellAt(e.clientX, e.clientY);
    if (c === null) return;
    setFocus(c);
    if (week.locks[c]) return;
    const on = !selected.has(c);
    drag.current = { on, last: c };
    setSelected((s) => toggleCell(s, week, c, on));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const c = cellAt(e.clientX, e.clientY);
    if (c === null || c === d.last) return;
    d.last = c;
    setSelected((s) => toggleCell(s, week, c, d.on));
  };
  const endDrag = () => {
    drag.current = null;
  };

  // ---- keyboard: arrows move, Space or Enter toggles, Shift+arrow paints as it moves
  const moveTo = (c: number, paint: boolean, from: number) => {
    if (c < 0 || c >= week.cells) return;
    if (!wide && Math.floor(c / HOURS) !== day) setDay(Math.floor(c / HOURS));
    setFocus(c);
    if (paint && !week.locks[from]) setSelected((s) => toggleCell(s, week, c, s.has(from)));
    requestAnimationFrame(() => cellRefs.current.get(c)?.focus());
  };
  const onKeyDown = (c: number) => (e: KeyboardEvent<HTMLDivElement>) => {
    const h = c % HOURS;
    const step: Record<string, number> = { ArrowUp: h > 0 ? -1 : 0, ArrowDown: h < HOURS - 1 ? 1 : 0, ArrowLeft: c >= HOURS ? -HOURS : 0, ArrowRight: c + HOURS < week.cells ? HOURS : 0, Home: -h, End: HOURS - 1 - h };
    if (e.key in step) {
      e.preventDefault();
      if (step[e.key]) moveTo(c + step[e.key], e.shiftKey, c);
      return;
    }
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      setSelected((s) => toggleCell(s, week, c));
    }
  };

  const cell = (c: number, tall: boolean) => {
    const k = kindOf(c);
    const reasonText = k === "blocked" ? blockReason(c) : null;
    return (
      <div
        key={c}
        ref={(el) => {
          if (el) cellRefs.current.set(c, el);
          else cellRefs.current.delete(c);
        }}
        role="gridcell"
        data-cell={c}
        data-kind={k}
        data-testid={`cal-cell-${c}`}
        aria-selected={k === "blocked"}
        aria-readonly={week.locks[c] ? true : undefined}
        aria-label={cellLabel(c)}
        title={reasonText ?? undefined}
        tabIndex={focus === c ? 0 : -1}
        onKeyDown={onKeyDown(c)}
        onFocus={() => setFocus(c)}
        className={cn(
          "flex select-none items-center border border-line text-xs font-semibold outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-brand",
          tall ? "min-h-11 justify-between gap-2 px-3" : "h-7 justify-center",
          week.locks[c] ? "cursor-not-allowed" : "cursor-pointer",
          KIND_CLASS[k],
        )}
      >
        {tall ? (
          <>
            <span className="tabular-nums text-ink">{`${hourLabel(c % HOURS)}–${c % HOURS === 23 ? "24:00" : hourLabel((c % HOURS) + 1)}`}</span>
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              <KindIcon kind={k} size={14} />
              {k === "free" || k === "past" || k === "horizon" ? <span className="text-muted">{t(`kind.${k}`)}</span> : stateText(c)}
            </span>
          </>
        ) : (
          <KindIcon kind={k} size={13} />
        )}
      </div>
    );
  };

  const gridProps = {
    role: "grid" as const,
    "aria-label": t("gridLabel"),
    "aria-multiselectable": true,
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onPointerLeave: endDrag,
  };

  const blockedHours = [...selected].filter((c) => !week.locks[c]).length;

  return (
    <div className="flex flex-col gap-5">
      {wide ? (
        <div className="overflow-x-auto">
          <div {...gridProps} aria-rowcount={HOURS + 1} aria-colcount={8} className="grid min-w-[640px] touch-pan-y grid-cols-[56px_repeat(7,minmax(0,1fr))]" data-testid="cal-grid">
            <div role="row" className="contents">
              {/* The cell stays in the grid; only its text is hidden (sr-only on the cell would take it out of the columns). */}
              <span role="columnheader">
                <span className="sr-only">{t("hour")}</span>
              </span>
              {week.days.map((d, i) => (
                <span key={d} role="columnheader" className={cn("pb-1 text-center text-sm font-bold", d === today && "text-brand-text")}>
                  {dayFmt.format(dayDate(i))}
                </span>
              ))}
            </div>
            {Array.from({ length: HOURS }, (_, h) => (
              <div key={h} role="row" className="contents">
                <span role="rowheader" className="pr-2 text-right text-xs leading-7 tabular-nums text-muted">
                  {hourLabel(h)}
                </span>
                {week.days.map((_, d) => cell(d * HOURS + h, false))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div role="group" aria-label={t("pickDay")} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            {week.days.map((d, i) => (
              <button
                key={d}
                type="button"
                aria-pressed={day === i}
                onClick={() => {
                  setDay(i);
                  setFocus(i * HOURS + (focus % HOURS));
                }}
                className={cn("min-h-11 shrink-0 rounded-control border px-3 text-sm font-semibold", day === i ? "border-brand bg-brand-soft text-brand-text" : "border-line bg-surface")}
                data-testid={`cal-day-${i}`}
              >
                {dayFmt.format(dayDate(i))}
              </button>
            ))}
          </div>
          <div {...gridProps} aria-rowcount={HOURS} aria-colcount={1} className="flex touch-pan-y flex-col gap-px" data-testid="cal-grid">
            {Array.from({ length: HOURS }, (_, h) => (
              <div key={h} role="row" className="contents">
                {cell(day * HOURS + h, true)}
              </div>
            ))}
          </div>
        </div>
      )}

      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label={t("legend")}>
        {(["free", "blocked", "repeat", "booked"] as const).map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span className={cn("inline-flex size-5 items-center justify-center rounded-[4px] border border-line", KIND_CLASS[k])}>
              <KindIcon kind={k} size={12} />
            </span>
            {t(`kind.${k}`)}
          </li>
        ))}
      </ul>

      <Repeats repeats={data.repeats} removed={removed} onToggle={(id) => setRemoved((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])))} />

      <form
        className="flex flex-col gap-4 rounded-card border border-line p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (plan.dirty) save.mutate();
        }}
        data-testid="cal-save-form"
      >
        <p className="text-sm text-muted" aria-live="polite">
          {t("blockedCount", { n: blockedHours })}
        </p>
        <Field id="cal-reason" label={t("reason")} optional={t("optional")} hint={t("reasonHint")} value={reason} maxLength={120} onChange={(e) => setReason(e.target.value)} />
        <Checkbox id="cal-repeat" label={t("repeat")} checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
        {repeat ? (
          <Field id="cal-until" type="date" label={t("until")} optional={t("optional")} hint={t("untilHint")} value={until} min={today} max={addDays(today, data.horizonDays)} onChange={(e) => setUntil(e.target.value)} className="max-w-xs" />
        ) : null}
        {saveError ? (
          <Notice tone="error">{saveError.key === "overJob" ? t("errors.overJob", { jobs: saveError.jobs }) : saveError.key === "horizon" ? t("errors.horizon", { days: data.horizonDays }) : t(`errors.${saveError.key}`)}</Notice>
        ) : save.error ? (
          <Notice tone="error">{problemOf(save.error)?.title ?? t("errors.invalid")}</Notice>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" busy={save.isPending} disabled={!plan.dirty} data-testid="cal-save">
            {t("save")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!plan.dirty || save.isPending}
            onClick={() => {
              setSelected(new Set(week.initial));
              setRemoved(new Set());
              save.reset();
            }}
          >
            {t("undo")}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Repeats({ repeats, removed, onToggle }: { repeats: Calendar["repeats"]; removed: Set<string>; onToggle: (id: string) => void }) {
  const t = useTranslations("hire.cal");
  const locale = useLocale();
  if (!repeats.length) return null;
  const tag = locale === "bn" ? "bn-BD" : "en-GB";
  const wd = new Intl.DateTimeFormat(tag, { weekday: "short", timeZone: "UTC" });
  // 4 Jan 2026 was a Sunday (weekday 0).
  const dayName = (n: number) => wd.format(new Date(Date.UTC(2026, 0, 4 + n)));
  const date = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <section aria-labelledby="cal-repeats" className="flex flex-col gap-2">
      <h3 id="cal-repeats" className="text-lg font-bold">
        {t("repeats")}
      </h3>
      <ul className="flex flex-col gap-2" data-testid="cal-repeats">
        {repeats.map((r) => {
          const off = removed.has(r.id);
          return (
            <li key={r.id} className={cn("flex flex-wrap items-center gap-3 rounded-control border border-line px-3 py-2", off && "opacity-60")}>
              <ArrowsClockwise size={18} aria-hidden className="text-warning" />
              <span className={cn("min-w-0 flex-1", off && "line-through")}>
                {t("repeatLine", { days: r.weekdays.map(dayName).join(", "), from: r.from, to: r.to === "23:59" ? "24:00" : r.to })}
                {r.until ? ` · ${t("repeatUntil", { date: date.format(new Date(`${r.until}T00:00:00Z`)) })}` : ""}
                {r.reason ? <span className="block text-sm text-muted">{r.reason}</span> : null}
              </span>
              <Button type="button" size="sm" variant={off ? "secondary" : "ghost"} className="min-h-11" onClick={() => onToggle(r.id)} aria-pressed={off}>
                {off ? t("keepRepeat") : t("removeRepeat")}
              </Button>
            </li>
          );
        })}
      </ul>
      {removed.size ? <p className="text-sm text-muted">{t("removeNote")}</p> : null}
    </section>
  );
}

/** The first editable hour, for the grid's single tab stop. */
function firstFree(week: Week): number {
  const i = week.locks.findIndex((l) => !l);
  return i < 0 ? 0 : i;
}

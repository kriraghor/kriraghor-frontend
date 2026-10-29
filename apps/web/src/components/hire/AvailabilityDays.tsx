"use client";

import type { ReactNode } from "react";
import { CheckCircle, CircleHalf, Prohibit } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@kriraghor/ui/cn";
import { formatDateLong, localDigits } from "@kriraghor/ui/date";
import { clock, dayBusy, stateOfBusy, type DayState } from "@/lib/availability";

export const DAY_STATES: DayState[] = ["available", "partly", "unavailable"];

/** The same open / booked looks as the venue slot grid (BookingWidget), one per day state. */
export const DAY_CELL: Record<DayState, string> = {
  available: "border-line-strong/50 bg-surface text-ink",
  partly: "border-warning/40 bg-warning-soft/60 text-ink",
  unavailable: "border-transparent bg-surface-2 text-muted",
};

const ICON_TONE: Record<DayState, string> = { available: "text-brand-text", partly: "text-warning", unavailable: "text-muted" };

/** The state's icon: the shape says it too, so the state never rests on colour alone. */
export function DayStateIcon({ state, size = 16, className }: { state: DayState; size?: number; className?: string }) {
  const Icon = state === "available" ? CheckCircle : state === "partly" ? CircleHalf : Prohibit;
  return <Icon size={size} weight="bold" aria-hidden className={cn("shrink-0", className ?? ICON_TONE[state])} />;
}

/** "Available / Partly available / Unavailable" with a swatch drawn like the day cells. */
export function DayStateLegend({ className }: { className?: string }) {
  const t = useTranslations("hire");
  return (
    <ul className={cn("flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted", className)} aria-label={t("stateLegend")}>
      {DAY_STATES.map((s) => (
        <li key={s} className="inline-flex items-center gap-2">
          <span className={cn("inline-flex size-6 items-center justify-center rounded-[6px] border", DAY_CELL[s])} aria-hidden>
            <DayStateIcon state={s} size={14} />
          </span>
          {t(`dayState.${s}`)}
        </li>
      ))}
    </ul>
  );
}

/**
 * The next 14 Dhaka days on a public profile (M11 FR-05): each day Available (no busy time), Partly
 * available (its booked times listed, the rest of the day open) or Unavailable (busy 00:00 to 24:00).
 * Busy time is booked jobs and the pro's blocked hours merged, times only (never a reason or a job).
 * With `onPick`, an Available or Partly available day is a button that sets the request form's date;
 * Unavailable days are disabled. Without it the grid is read-only.
 */
export function AvailabilityDays({
  days,
  busy,
  selected,
  onPick,
  note,
}: {
  days: string[];
  busy: { start: string; end: string }[];
  selected?: string | null;
  onPick?: (day: string) => void;
  /** A line under the grid (what the last pick did), announced politely. */
  note?: ReactNode;
}) {
  const t = useTranslations("hire");
  const locale = useLocale();
  const tag = locale === "bn" ? "bn-BD" : "en-GB";
  const fmt = new Intl.DateTimeFormat(tag, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const dayText = (d: string) => localDigits(fmt.format(new Date(`${d}T12:00:00Z`)).replace(/^(\w+),/, "$1"), locale);
  const time = (m: number) => localDigits(clock(m), locale);

  return (
    <div className="mt-8">
      <h2 className="text-xl font-extrabold">{t("availability")}</h2>
      {onPick ? <p className="mt-1 text-sm text-muted">{t("availabilityHint")}</p> : null}
      <DayStateLegend className="mt-3" />
      <ol className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2" data-testid="hire-busy">
        {days.map((d) => {
          const parts = dayBusy(busy, d);
          const state = stateOfBusy(parts);
          const times = parts.map((x) => `${time(x.from)}-${time(x.to)}`).join(", ");
          const on = selected === d && state !== "unavailable";
          const label =
            state === "partly"
              ? t("dayCellBooked", { date: formatDateLong(d, locale), state: t(`dayState.${state}`), times })
              : t("dayCell", { date: formatDateLong(d, locale), state: t(`dayState.${state}`) });
          const body = (
            <>
              <span className="text-sm font-bold">{dayText(d)}</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <DayStateIcon state={state} size={14} className={on ? "text-on-brand" : undefined} />
                {t(`dayState.${state}`)}
              </span>
              {state === "partly" ? <span className={cn("text-xs tabular-nums", on ? "text-on-brand" : "text-muted")}>{t("bookedAt", { times })}</span> : null}
            </>
          );
          const cls = cn(
            "flex h-full min-h-11 w-full flex-col items-start gap-1 rounded-control border p-2.5 text-left transition-colors",
            on ? "border-brand bg-brand text-on-brand" : DAY_CELL[state],
          );
          return (
            <li key={d} className="min-w-0">
              {onPick ? (
                <button
                  type="button"
                  disabled={state === "unavailable"}
                  aria-pressed={state === "unavailable" ? undefined : on}
                  aria-label={label}
                  onClick={() => onPick(d)}
                  className={cn(cls, "outline-none focus-visible:ring-4 focus-visible:ring-brand/25 disabled:cursor-not-allowed", !on && state !== "unavailable" && "hover:border-brand")}
                  data-state={state}
                  data-day={d}
                  data-selected={on || undefined}
                >
                  {body}
                </button>
              ) : (
                <div role="group" aria-label={label} className={cls} data-state={state} data-day={d}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p aria-live="polite" className="mt-2 min-h-5 text-sm text-muted" data-testid="hire-busy-note">
        {note}
      </p>
    </div>
  );
}

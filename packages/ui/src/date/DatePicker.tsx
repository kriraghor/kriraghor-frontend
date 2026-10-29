"use client";

import { useMemo, useRef, useState } from "react";
import { DayPicker, type ChevronProps, type ClassNames } from "react-day-picker";
import { bn as bnLocale, enGB } from "react-day-picker/locale";
import { CalendarBlank, CaretDown, CaretLeft, CaretRight, CaretUp } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "../cn";
import { dhakaToday, formatDateLabel, formatDateLong, formatMonthLabel, initialMonth, intlTag, isBn, isDayDisabled, localDigits, navRange, parseYmd, toYmd, WEEK_STARTS_ON, type DayRule } from "./dates";
import { FormValue, PickerShell, PickerSurface, PickerTrigger, describedBy, type PickerChrome } from "./parts";

function Chevron({ orientation, className }: ChevronProps) {
  const Icon = orientation === "left" ? CaretLeft : orientation === "right" ? CaretRight : orientation === "up" ? CaretUp : CaretDown;
  return <Icon size={orientation === "down" ? 16 : 20} weight="bold" aria-hidden className={className} />;
}

/** react-day-picker styled with the project tokens only (no default CSS, no default blue). */
const CLASSES: Partial<ClassNames> = {
  root: "relative w-[308px] max-w-full select-none text-ink",
  months: "relative",
  month: "relative flex flex-col gap-2",
  month_caption: "mx-11 flex h-11 items-center justify-center",
  caption_label: "inline-flex min-h-11 items-center gap-1 whitespace-nowrap px-2 text-[15px] font-bold",
  dropdowns: "flex items-center justify-center",
  dropdown_root: "relative inline-flex items-center rounded-control hover:bg-surface-2 has-[select:focus-visible]:ring-2 has-[select:focus-visible]:ring-brand",
  dropdown: "absolute inset-0 z-10 w-full cursor-pointer appearance-none opacity-0",
  chevron: "shrink-0 text-muted",
  nav: "",
  button_previous:
    "absolute left-0 top-0 z-10 inline-flex size-11 items-center justify-center rounded-control text-ink outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand aria-disabled:pointer-events-none aria-disabled:opacity-35",
  button_next:
    "absolute right-0 top-0 z-10 inline-flex size-11 items-center justify-center rounded-control text-ink outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand aria-disabled:pointer-events-none aria-disabled:opacity-35",
  month_grid: "w-full border-collapse",
  weekdays: "",
  weekday: "h-8 w-11 p-0 text-center text-xs font-semibold text-muted",
  weeks: "",
  week: "",
  day: "p-0 text-center",
  day_button:
    "mx-auto inline-flex size-11 items-center justify-center rounded-control border border-transparent text-sm font-medium tabular-nums outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed",
  today: "[&>button]:border-brand [&>button]:font-bold [&>button]:text-brand-text",
  selected: "[&>button]:border-brand [&>button]:bg-brand [&>button]:font-bold [&>button]:text-on-brand [&>button]:hover:bg-brand-hover",
  outside: "[&>button]:text-muted",
  disabled: "[&>button]:text-muted/50 [&>button]:line-through [&>button]:hover:bg-transparent",
  hidden: "invisible",
  focused: "",
  footer: "",
};

export type CalendarProps = DayRule & {
  /** "YYYY-MM-DD" or "". */
  value: string;
  onPick: (value: string) => void;
  /** Today on the Dhaka calendar unless given (tests). */
  today?: string;
  autoFocus?: boolean;
};

/**
 * The month calendar on its own (react-day-picker v9): Saturday-first weeks, today ringed, the chosen
 * day in brand, days outside [min, max] or in `disabledDays` muted and not clickable, arrows plus month
 * and year dropdowns for far dates, react-day-picker's full keyboard support (arrows, Home/End,
 * PageUp/PageDown). Bangla month and weekday names and Bangla digits when the locale is bn.
 */
export function Calendar({ value, onPick, min, max, disabledDays, today: todayProp, autoFocus }: CalendarProps) {
  const t = useTranslations("kit.date");
  const locale = useLocale();
  const bn = isBn(locale);
  const today = todayProp ?? dhakaToday();
  const rule = useMemo(() => ({ min, max, disabledDays }), [min, max, disabledDays]);
  const [month, setMonth] = useState(() => initialMonth(value, today, rule));
  const range = navRange(today, rule);
  const weekday = useMemo(() => new Intl.DateTimeFormat(intlTag(locale), { weekday: "short" }), [locale]);
  return (
    <DayPicker
      mode="single"
      required
      selected={parseYmd(value)}
      onSelect={(d) => onPick(toYmd(d))}
      month={month}
      onMonthChange={setMonth}
      startMonth={range.start}
      endMonth={range.end}
      captionLayout="dropdown"
      navLayout="around"
      weekStartsOn={WEEK_STARTS_ON}
      locale={bn ? bnLocale : enGB}
      today={parseYmd(today)}
      disabled={(d: Date) => isDayDisabled(toYmd(d), rule)}
      showOutsideDays
      autoFocus={autoFocus}
      classNames={CLASSES}
      components={{ Chevron }}
      // Digits through formatters, not `numerals`, so data-day stays "2026-11-02" for tests in both languages.
      formatters={{
        formatWeekdayName: (d: Date) => weekday.format(d),
        formatDay: (d: Date) => localDigits(String(d.getDate()), locale),
        formatYearDropdown: (d: Date) => localDigits(String(d.getFullYear()), locale),
      }}
      labels={{
        labelPrevious: () => t("previousMonth"),
        labelNext: () => t("nextMonth"),
        labelMonthDropdown: () => t("month"),
        labelYearDropdown: () => t("year"),
        labelNav: () => t("navigation"),
        labelGrid: (d: Date) => formatMonthLabel(toYmd(d).slice(0, 7), locale),
        labelDayButton: (d: Date, m: { today?: boolean; selected?: boolean }) => [formatDateLong(toYmd(d), locale), m.today ? t("today") : null, m.selected ? t("selected") : null].filter(Boolean).join(", "),
      }}
    />
  );
}

export type DatePickerProps = PickerChrome &
  DayRule & {
    /** "YYYY-MM-DD", or "" for none. */
    value: string;
    onChange: (value: string) => void;
    /** Shows a Clear action (default: when not required). */
    clearable?: boolean;
    /** Shows a Today action (default true; hidden when today cannot be picked). */
    showToday?: boolean;
    /** Classes for the trigger (width in a toolbar, for example). */
    triggerClassName?: string;
  };

/**
 * The one date field (replaces <input type="date">): a trigger that looks like the kit's text inputs
 * and shows "Mon 2 Nov 2026" (Bangla names and digits for bn), opening the calendar in a popover, or
 * in a bottom sheet on phones. Value in and out is "YYYY-MM-DD" ("" when cleared), like the native input.
 */
export function DatePicker({
  id,
  label,
  labelHidden,
  hint,
  error,
  optional,
  className,
  testId,
  name,
  required,
  disabled,
  placeholder,
  value,
  onChange,
  min,
  max,
  disabledDays,
  clearable,
  showToday = true,
  triggerClassName,
}: DatePickerProps) {
  const t = useTranslations("kit.date");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const today = dhakaToday();
  const rule = { min, max, disabledDays };
  const canClear = (clearable ?? !required) && Boolean(value);
  const todayOk = showToday && !isDayDisabled(today, rule);
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <PickerShell id={id} label={label} labelHidden={labelHidden} hint={hint} error={error} optional={optional} className={className}>
      <div className="relative">
        <PickerSurface
          open={open}
          onOpenChange={setOpen}
          title={label}
          testId={testId ? `${testId}-calendar` : undefined}
          trigger={
            <PickerTrigger
              ref={trigger}
              id={id}
              testId={testId}
              open={open}
              invalid={Boolean(error)}
              disabled={disabled}
              aria-describedby={describedBy(id, hint, error)}
              aria-required={required || undefined}
              display={formatDateLabel(value, locale)}
              placeholder={placeholder ?? t("choose")}
              icon={<CalendarBlank aria-hidden />}
              className={triggerClassName}
              onClick={() => setOpen(true)}
              data-value={value}
            />
          }
        >
          <div className="flex flex-col gap-2">
            <Calendar value={value} onPick={pick} min={min} max={max} disabledDays={disabledDays} today={today} autoFocus />
            {todayOk || canClear ? (
              <div className="flex items-center justify-between gap-2 border-t border-line pt-2">
                {todayOk ? (
                  <button type="button" onClick={() => pick(today)} className="min-h-11 rounded-control px-3 text-sm font-semibold text-brand-text hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" data-testid={testId ? `${testId}-today` : undefined}>
                    {t("today")}
                  </button>
                ) : (
                  <span />
                )}
                {canClear ? (
                  <button type="button" onClick={() => pick("")} className={cn("min-h-11 rounded-control px-3 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand")} data-testid={testId ? `${testId}-clear` : undefined}>
                    {t("clear")}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </PickerSurface>
        <FormValue name={name} value={value} required={required} trigger={trigger} />
      </div>
    </PickerShell>
  );
}

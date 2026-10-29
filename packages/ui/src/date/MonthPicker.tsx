"use client";

import { useRef, useState } from "react";
import { CalendarBlank, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "../cn";
import { dhakaToday, formatMonthLabel, localDigits, monthNames } from "./dates";
import { FormValue, PickerShell, PickerSurface, PickerTrigger, describedBy, type PickerChrome } from "./parts";

export type MonthPickerProps = PickerChrome & {
  /** "YYYY-MM", or "" for none. */
  value: string;
  onChange: (value: string) => void;
  /** "YYYY-MM" bounds. */
  min?: string;
  max?: string;
  clearable?: boolean;
  triggerClassName?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The one month field (replaces <input type="month">): the trigger shows "November 2026" (Bangla for
 * bn) and opens a year with its twelve months; months outside [min, max] are muted and not clickable.
 * Value in and out is "YYYY-MM" like the native input.
 */
export function MonthPicker({ id, label, labelHidden, hint, error, optional, className, testId, name, required, disabled, placeholder, value, onChange, min, max, clearable, triggerClassName }: MonthPickerProps) {
  const t = useTranslations("kit.date");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const thisMonth = dhakaToday().slice(0, 7);
  const [year, setYear] = useState(() => Number((value || thisMonth).slice(0, 4)));
  const names = monthNames(locale, "short");
  const off = (ym: string) => Boolean((min && ym < min) || (max && ym > max));
  const minYear = min ? Number(min.slice(0, 4)) : -Infinity;
  const maxYear = max ? Number(max.slice(0, 4)) : Infinity;
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };
  const canClear = (clearable ?? !required) && Boolean(value);

  return (
    <PickerShell id={id} label={label} labelHidden={labelHidden} hint={hint} error={error} optional={optional} className={className}>
      <div className="relative">
        <PickerSurface
          open={open}
          onOpenChange={(o) => {
            if (o) setYear(Number((value || thisMonth).slice(0, 4)));
            setOpen(o);
          }}
          title={label}
          testId={testId ? `${testId}-months` : undefined}
          trigger={
            <PickerTrigger
              ref={trigger}
              id={id}
              testId={testId}
              open={open}
              invalid={Boolean(error)}
              disabled={disabled}
              aria-describedby={describedBy(id, hint, error)}
              display={formatMonthLabel(value, locale)}
              placeholder={placeholder ?? t("chooseMonth")}
              icon={<CalendarBlank aria-hidden />}
              className={triggerClassName}
              onClick={() => {
                setYear(Number((value || thisMonth).slice(0, 4)));
                setOpen(true);
              }}
              data-value={value}
            />
          }
        >
          <div className="flex w-[308px] max-w-full flex-col gap-2">
            <div className="flex items-center justify-between">
              <button type="button" aria-label={t("previousYear")} disabled={year <= minYear} onClick={() => setYear(year - 1)} className="inline-flex size-11 items-center justify-center rounded-control hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-35">
                <CaretLeft size={20} weight="bold" aria-hidden />
              </button>
              <span className="text-[15px] font-bold tabular-nums" aria-live="polite">
                {localDigits(String(year), locale)}
              </span>
              <button type="button" aria-label={t("nextYear")} disabled={year >= maxYear} onClick={() => setYear(year + 1)} className="inline-flex size-11 items-center justify-center rounded-control hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-35">
                <CaretRight size={20} weight="bold" aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={localDigits(String(year), locale)}>
              {names.map((n, i) => {
                const ym = `${year}-${pad(i + 1)}`;
                const on = ym === value;
                return (
                  <button
                    key={ym}
                    type="button"
                    disabled={off(ym)}
                    aria-pressed={on}
                    aria-label={formatMonthLabel(ym, locale)}
                    autoFocus={on || (!value && ym === thisMonth)}
                    onClick={() => pick(ym)}
                    className={cn(
                      "min-h-11 rounded-control border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:text-muted/50 disabled:line-through",
                      on ? "border-brand bg-brand text-on-brand" : ym === thisMonth ? "border-brand text-brand-text hover:bg-surface-2" : "border-transparent hover:bg-surface-2",
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            {canClear ? (
              <div className="flex justify-end border-t border-line pt-2">
                <button type="button" onClick={() => pick("")} className="min-h-11 rounded-control px-3 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink">
                  {t("clear")}
                </button>
              </div>
            ) : null}
          </div>
        </PickerSurface>
        <FormValue name={name} value={value} required={required} trigger={trigger} />
      </div>
    </PickerShell>
  );
}

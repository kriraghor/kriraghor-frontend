"use client";

import { CaretDown, Clock } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "../cn";
import { controlClass } from "../kit/Form";
import { formatTimeLabel, timeOptions, type TimeRule } from "./dates";
import { PickerShell, describedBy, type PickerChrome } from "./parts";

export type TimePickerProps = PickerChrome &
  TimeRule & {
    /** "HH:MM" (24 h), or "" for none. */
    value: string;
    onChange: (value: string) => void;
    /** Classes for the select (width in a compact row, for example). */
    triggerClassName?: string;
  };

/**
 * The one time field (replaces <input type="time">): a select of times every `step` minutes (default
 * 30), inside [min, max], shown on the 12-hour clock ("7:30 pm"; Bangla digits for bn). It is a native
 * select styled like the kit's fields, so phones get their own wheel and keyboards type-ahead works.
 * Value in and out is "HH:MM" like the native input; `endOfDay` adds "24:00" for closing hours.
 */
export function TimePicker({ id, label, labelHidden, hint, error, optional, className, testId, name, required, disabled, placeholder, value: raw, onChange, step, min, max, endOfDay, triggerClassName }: TimePickerProps) {
  const t = useTranslations("kit.date");
  const locale = useLocale();
  // A stored "07:00:00" shows as "07:00" (what the native input did); choosing a time sends "HH:MM".
  const value = /^\d{2}:\d{2}:\d{2}$/.test(raw) ? raw.slice(0, 5) : raw;
  const options = timeOptions({ step, min, max, endOfDay }, value);
  const label12 = (v: string) => (v === "24:00" ? t("endOfDay", { time: formatTimeLabel(v, locale) }) : formatTimeLabel(v, locale));
  return (
    <PickerShell id={id} label={label} labelHidden={labelHidden} hint={hint} error={error} optional={optional} className={className}>
      <div className="relative">
        <Clock size={20} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <select
          id={id}
          name={name}
          value={value}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          onChange={(e) => onChange(e.target.value)}
          data-testid={testId}
          className={cn(controlClass, "appearance-none pl-11 pr-10 tabular-nums", !value && "text-muted", triggerClassName)}
        >
          {!value || !required ? <option value="">{placeholder ?? t("chooseTime")}</option> : null}
          {options.map((o) => (
            <option key={o} value={o}>
              {label12(o)}
            </option>
          ))}
        </select>
        <CaretDown size={18} aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
      </div>
    </PickerShell>
  );
}

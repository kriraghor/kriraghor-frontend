"use client";

import { useState, type ReactNode } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { cn } from "../cn";
import { DatePicker } from "./DatePicker";
import { TimePicker } from "./TimePicker";
import { joinDateTime, splitDateTime, type DayRule } from "./dates";

export type DateTimePickerProps = {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: string;
  className?: string;
  /** data-testid: the date trigger gets it, the time select gets `${testId}-time`. */
  testId?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  /** "YYYY-MM-DDTHH:MM" (a wall-clock value, like <input type="datetime-local">), or "". */
  value: string;
  onChange: (value: string) => void;
  /** "YYYY-MM-DD" bounds for the date half (a datetime-local `min` can be passed; its day is used). */
  min?: string;
  max?: string;
  disabledDays?: DayRule["disabledDays"];
  /** Minutes between times (default 30). */
  step?: number;
};

/**
 * The one date-and-time field (replaces <input type="datetime-local">): a DatePicker and a TimePicker
 * side by side under one label. It reports exactly what the native input did: "YYYY-MM-DDTHH:MM" once
 * both halves are chosen, "" until then, so each caller keeps its own time zone handling.
 */
export function DateTimePicker({ id, label, hint, error, optional, className, testId, name, required, disabled, value, onChange, min, max, disabledDays, step }: DateTimePickerProps) {
  const t = useTranslations("kit.date");
  // A half chosen on its own is kept here until the other half arrives (the value stays "" meanwhile).
  const [draft, setDraft] = useState<[string, string]>(() => splitDateTime(value));
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value || draft.every(Boolean)) setDraft(splitDateTime(value));
  }
  const [date, time] = value ? splitDateTime(value) : draft;
  const set = (d: string, tm: string) => {
    setDraft([d, tm]);
    const next = joinDateTime(d, tm);
    setSeen(next);
    onChange(next);
  };
  const errId = `${id}-error`;
  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-1.5", className)} aria-describedby={error ? errId : hint ? `${id}-hint` : undefined}>
      <legend className="mb-1.5 flex w-full items-baseline justify-between gap-2 text-sm font-semibold text-ink">
        <span>{label}</span>
        {optional ? <span className="text-xs font-normal text-muted">{optional}</span> : null}
      </legend>
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
        <DatePicker
          id={id}
          label={t("dateOf", { label: typeof label === "string" ? label : t("date") })}
          labelHidden
          value={date}
          onChange={(d) => set(d, time)}
          min={min?.slice(0, 10)}
          max={max?.slice(0, 10)}
          disabledDays={disabledDays}
          required={required}
          disabled={disabled}
          clearable={!required}
          testId={testId}
        />
        <TimePicker
          id={`${id}-time`}
          label={t("timeOf", { label: typeof label === "string" ? label : t("time") })}
          labelHidden
          value={time}
          onChange={(tm) => set(date, tm)}
          step={step}
          required={required}
          disabled={disabled}
          testId={testId ? `${testId}-time` : undefined}
        />
      </div>
      {name ? <input type="hidden" name={name} value={joinDateTime(date, time)} /> : null}
      {error ? (
        <p id={errId} role="alert" className="flex items-center gap-1.5 text-sm text-danger">
          <WarningCircle size={16} weight="fill" aria-hidden className="shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
}

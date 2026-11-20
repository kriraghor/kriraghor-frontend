"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { DatePicker } from "../date/DatePicker";
import { MonthPicker } from "../date/MonthPicker";
import { Dropdown } from "../kit/Dropdown";
import { IconButton } from "../kit/Button";
import { cn } from "../cn";
import { presetOf, presetPeriod, shiftMonth, addDays, type Period, type Preset } from "./range";

/**
 * The one period control above a dashboard (kriraghor-docs design, charts): presets first (this month,
 * last month, the last 7 or 30 days), then a month picker with back and forward, or two dates. The
 * caller keeps the period in the URL (periodFromParams / periodParams), so every chart and tile below
 * reads the same slice. Never past today.
 */
export function RangePicker({ value, onChange, today, presets = ["thisMonth", "lastMonth", "last7", "last30", "month", "custom"], className, testId = "range-picker" }: { value: Period; onChange: (p: Period) => void; today: string; presets?: Preset[]; className?: string; testId?: string }) {
  const t = useTranslations("kit.charts.range");
  const preset = presetOf(value, today);
  const shown: Preset = presets.includes(preset) ? preset : "month" in value ? "month" : "custom";
  const thisMonth = today.slice(0, 7);
  return (
    <div className={cn("flex flex-wrap items-end gap-2", className)} data-testid={testId}>
      <Dropdown
        id={`${testId}-preset`}
        label={t("label")}
        value={shown}
        onChange={(v) => onChange(presetPeriod(v as Preset, today, value))}
        options={presets.map((p) => ({ value: p, label: t(p) }))}
        className="w-48"
        testId={`${testId}-preset`}
      />
      {"month" in value && (shown === "month" || shown === "thisMonth" || shown === "lastMonth") ? (
        <div className="flex items-center gap-1">
          <IconButton label={t("prev")} variant="secondary" onClick={() => onChange({ month: shiftMonth(value.month, -1) })} data-testid="month-prev">
            <CaretLeft size={18} aria-hidden />
          </IconButton>
          <MonthPicker id={`${testId}-month`} label={t("month")} labelHidden value={value.month} max={thisMonth} clearable={false} onChange={(v) => v && onChange({ month: v })} triggerClassName="min-h-12 w-auto min-w-44 text-sm font-semibold" testId="report-month" />
          <IconButton label={t("next")} variant="secondary" onClick={() => onChange({ month: shiftMonth(value.month, 1) })} disabled={value.month >= thisMonth} data-testid="month-next">
            <CaretRight size={18} aria-hidden />
          </IconButton>
        </div>
      ) : null}
      {"from" in value && shown === "custom" ? (
        <div className="flex flex-wrap items-end gap-2">
          <DatePicker id={`${testId}-from`} label={t("from")} value={value.from} max={value.to} clearable={false} showToday={false} onChange={(v) => v && onChange({ from: v, to: value.to })} triggerClassName="min-h-12 w-auto min-w-40 text-sm" testId={`${testId}-from`} />
          <DatePicker id={`${testId}-to`} label={t("to")} value={value.to} min={value.from} max={today} clearable={false} onChange={(v) => v && onChange({ from: value.from > v ? addDays(v, -6) : value.from, to: v })} triggerClassName="min-h-12 w-auto min-w-40 text-sm" testId={`${testId}-to`} />
        </div>
      ) : null}
    </div>
  );
}

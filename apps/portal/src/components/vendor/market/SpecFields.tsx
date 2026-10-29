"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ItemField } from "@/lib/vendor/market";
import { DatePicker } from "@kriraghor/ui/date";
import { Field, inputCls } from "../../admin/finance/shared";

/** The spec fields of an item type (non-axis fields): pick-lists, numbers with units, text and dates. */
export function SpecFields({ fields, values, onChange, disabled }: { fields: ItemField[]; values: Record<string, string>; onChange: (v: Record<string, string>) => void; disabled?: boolean }) {
  const t = useTranslations("vendorMarket");
  const locale = useLocale();
  const label = (x: { labelEn: string; labelBn: string }) => (locale === "bn" ? x.labelBn : x.labelEn);
  return (
    <>
      {fields
        .filter((f) => !f.isVariantAxis)
        .map((f) =>
          f.kind === "date" ? (
            // A date spec: the shared picker, value "YYYY-MM-DD" like the native input it replaces.
            <DatePicker
              key={f.key}
              id={`spec-${f.key}`}
              label={`${label(f)}${f.required ? " *" : ""}`}
              value={values[f.key] ?? ""}
              onChange={(v) => onChange({ ...values, [f.key]: v })}
              required={f.required}
              disabled={disabled}
              testId={`spec-${f.key}`}
            />
          ) : (
          <Field key={f.key} label={`${label(f)}${f.unit ? ` (${f.unit})` : ""}${f.required ? " *" : ""}`}>
            {f.kind === "select" ? (
              <select value={values[f.key] ?? ""} onChange={(e) => onChange({ ...values, [f.key]: e.target.value })} required={f.required} disabled={disabled} className={inputCls} data-testid={`spec-${f.key}`}>
                <option value="">{t("choose")}</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {label(o)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={f.kind === "number" ? "number" : "text"}
                min={f.min ?? undefined}
                max={f.max ?? undefined}
                value={values[f.key] ?? ""}
                onChange={(e) => onChange({ ...values, [f.key]: e.target.value })}
                required={f.required}
                disabled={disabled}
                className={inputCls}
                data-testid={`spec-${f.key}`}
              />
            )}
          </Field>
          ),
        )}
    </>
  );
}

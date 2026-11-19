"use client";

import { forwardRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Field, type FieldProps } from "./Form";

/**
 * Bangladesh mobile numbers (tester feedback, 19 Nov 2026): 11 digits starting 013–019. A pasted
 * +880 or 880 number is accepted and shown in the local form.
 */
export const bdMobile = {
  /** The local 11-digit form of what was typed or pasted (digits only, +880/880 dropped); may be partial. */
  local(input: string): string {
    let d = input.replace(/\D/g, "");
    if (d.startsWith("880")) d = d.slice(3);
    if (d && !d.startsWith("0")) d = `0${d}`;
    return d.slice(0, 11);
  },
  valid: (input: string) => /^01[3-9]\d{8}$/.test(bdMobile.local(input)),
};

export type PhoneFieldProps = Omit<FieldProps, "type" | "inputMode" | "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  /** The server's message for this field, if any. */
  error?: string;
};

/**
 * A mobile number field: digits only, at most 11, checked when the person leaves it (and by the form
 * before it is sent). `value` is the local form, for example 01712345678.
 */
export const PhoneField = forwardRef<HTMLInputElement, PhoneFieldProps>(function PhoneField({ value, onChange, error, hint, required, onBlur, ...rest }, ref) {
  const t = useTranslations("kit.phone");
  const [touched, setTouched] = useState(false);
  const local = bdMobile.local(value);
  const own = touched && local && !bdMobile.valid(local) ? t("invalid") : undefined;
  return (
    <Field
      ref={ref}
      {...rest}
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      maxLength={16}
      pattern="01[3-9][0-9]{8}"
      title={t("invalid")}
      required={required}
      value={local}
      hint={hint ?? t("hint")}
      error={error ?? own}
      onChange={(e) => onChange(bdMobile.local(e.target.value))}
      onBlur={(e) => {
        setTouched(true);
        onBlur?.(e);
      }}
    />
  );
});

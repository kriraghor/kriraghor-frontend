"use client";

import {
  forwardRef,
  useRef,
  useState,
  type ClipboardEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { CaretDown, Eye, EyeSlash, WarningCircle } from "@phosphor-icons/react";
import { cn } from "../cn";

/** Text inputs, selects and text areas share this look: solid surface, 1px 3:1 border, brand focus ring. */
export const controlClass =
  "w-full min-h-12 rounded-control border border-line-strong/70 bg-surface px-3.5 text-base text-ink placeholder:text-muted/70 transition-[border-color,box-shadow] duration-150 hover:border-line-strong focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 aria-invalid:border-danger aria-invalid:focus:ring-danger/15 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-70";

type FieldChrome = { label: ReactNode; id: string; hint?: ReactNode; error?: string; optional?: string; className?: string };

/** Label above, hint or error below (error replaces the hint and is announced). */
export function FieldShell({ label, id, hint, error, optional, className, children }: FieldChrome & { children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm font-semibold text-ink">
        <span>{label}</span>
        {optional ? <span className="text-xs font-normal text-muted">{optional}</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1.5 text-sm text-danger">
          <WarningCircle size={16} weight="fill" aria-hidden className="shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const describedBy = (id: string, hint?: ReactNode, error?: string) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

export type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & FieldChrome & { inputClassName?: string; leading?: ReactNode };

/** A labelled text input. `leading` puts a fixed prefix (an icon, +880) inside the box. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, id, hint, error, optional, className, inputClassName, leading, ...input }, ref) {
  const control = (
    <input
      ref={ref}
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, hint, error)}
      className={cn(controlClass, leading ? "pl-14" : null, inputClassName)}
      {...input}
    />
  );
  return (
    <FieldShell label={label} id={id} hint={hint} error={error} optional={optional} className={className}>
      {leading ? (
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center border-r border-line text-sm font-semibold text-muted">{leading}</span>
          {control}
        </div>
      ) : (
        control
      )}
    </FieldShell>
  );
});

export function Select({ label, id, hint, error, optional, className, children, ...select }: Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> & FieldChrome & { children: ReactNode }) {
  return (
    <FieldShell label={label} id={id} hint={hint} error={error} optional={optional} className={className}>
      <div className="relative">
        <select id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} className={cn(controlClass, "appearance-none pr-10")} {...select}>
          {children}
        </select>
        <CaretDown size={18} aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
      </div>
    </FieldShell>
  );
}

export function Textarea({ label, id, hint, error, optional, className, ...area }: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & FieldChrome) {
  return (
    <FieldShell label={label} id={id} hint={hint} error={error} optional={optional} className={className}>
      <textarea id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} className={cn(controlClass, "min-h-28 py-3 leading-relaxed")} {...area} />
    </FieldShell>
  );
}

/** A password input with a show/hide eye; the toggle is a real button announced by its label. */
export function PasswordField({ label, id, hint, error, optional, className, showLabel, hideLabel, ...input }: Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type"> & FieldChrome & { showLabel: string; hideLabel: string }) {
  const [shown, setShown] = useState(false);
  return (
    <FieldShell label={label} id={id} hint={hint} error={error} optional={optional} className={className}>
      <div className="relative">
        <input id={id} type={shown ? "text" : "password"} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} className={cn(controlClass, "pr-12")} {...input} />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          aria-controls={id}
          aria-label={shown ? hideLabel : showLabel}
          className="absolute right-1 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-[10px] text-muted hover:bg-surface-2 hover:text-ink"
        >
          {shown ? <EyeSlash size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
        </button>
      </div>
    </FieldShell>
  );
}

/**
 * A 6-digit code entry: one box per digit, typing moves on, Backspace moves back, pasting fills
 * every box, and the phone's one-time-code autofill lands in the first box and spreads.
 */
export function OtpInput({ id, name, length = 6, label, error, hint, value, onChange, autoFocus, disabled }: { id: string; name?: string; length?: number; label: ReactNode; error?: string; hint?: ReactNode; value: string; onChange: (v: string) => void; autoFocus?: boolean; disabled?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");
  const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  const fill = (from: number, text: string) => {
    const clean = text.replace(/\D/g, "");
    if (!clean) return;
    const next = (value.slice(0, from) + clean).slice(0, length);
    onChange(next);
    focus(next.length >= length ? length - 1 : next.length);
  };
  const onKey = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) onChange(value.slice(0, i) + value.slice(i + 1));
      else if (i > 0) {
        onChange(value.slice(0, i - 1) + value.slice(i));
        focus(i - 1);
      }
    } else if (e.key === "ArrowLeft") focus(i - 1);
    else if (e.key === "ArrowRight") focus(i + 1);
  };
  const onPaste = (i: number) => (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    fill(i, e.clipboardData.getData("text"));
  };

  return (
    <fieldset className="flex flex-col gap-1.5" aria-describedby={describedBy(id, hint, error)}>
      <legend id={`${id}-label`} className="mb-1.5 text-sm font-semibold text-ink">
        {label}
      </legend>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <div className="flex gap-2 sm:gap-2.5">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={i === 0 ? id : `${id}-${i}`}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            // The first box carries the field's label (autofill and "fill" land there); the rest say which digit.
            aria-labelledby={i === 0 ? `${id}-label` : undefined}
            aria-label={i === 0 ? undefined : `${i + 1} / ${length}`}
            aria-invalid={error ? true : undefined}
            maxLength={i === 0 ? length : 1}
            value={d}
            disabled={disabled}
            autoFocus={autoFocus && i === 0}
            onChange={(e) => fill(i, e.target.value.slice(-length))}
            onKeyDown={onKey(i)}
            onPaste={onPaste(i)}
            onFocus={(e) => e.currentTarget.select()}
            className={cn(controlClass, "h-14 w-full min-w-0 max-w-14 px-0 text-center font-mono text-2xl font-semibold tabular")}
          />
        ))}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1.5 text-sm text-danger">
          <WarningCircle size={16} weight="fill" aria-hidden />
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

/** A checkbox with its label to the right, the whole row is the target. */
export function Checkbox({ label, id, className, ...input }: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & { label: ReactNode; id: string; className?: string }) {
  return (
    <label htmlFor={id} className={cn("flex min-h-11 cursor-pointer items-center gap-3 text-[15px]", className)}>
      <input id={id} type="checkbox" className="size-5 shrink-0 rounded-[6px] accent-[var(--kg-brand)]" {...input} />
      <span>{label}</span>
    </label>
  );
}

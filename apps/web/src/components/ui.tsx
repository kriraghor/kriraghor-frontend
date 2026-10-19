"use client";

import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

/** Minimal form primitives on the design tokens. Sharp corners (shape lock), 44px+ targets. */
export function Field({ label, id, hint, error, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; hint?: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-muted">
        {label}
      </label>
      <input
        id={id}
        className="min-h-12 field px-3 text-base text-ink focus:border-brand"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...input}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Button({ children, busy, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; children: ReactNode }) {
  return (
    <button
      {...rest}
      disabled={busy || rest.disabled}
      aria-busy={busy || undefined}
      className="inline-flex min-h-12 items-center justify-center bg-brand px-5 font-bold text-white shadow-[0_8px_24px_-12px_rgb(11_122_75/0.6)] hover:bg-brand-hover disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error"; children: ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-xl border-l-4 bg-[var(--glass-strong-bg)] px-3 py-2 text-sm backdrop-blur ${tone === "error" ? "border-danger text-danger" : "border-info text-ink"}`}>
      {children}
    </p>
  );
}

/** A password input with a show/hide toggle (the toggle is a real button, announced by its label). */
export function PasswordField({ label, id, hint, error, showLabel, hideLabel, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; hint?: string; error?: string; showLabel: string; hideLabel: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-muted">
        {label}
      </label>
      <div className="field flex overflow-hidden focus-within:border-brand">
        <input
          id={id}
          type={shown ? "text" : "password"}
          className="min-h-12 min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 text-base text-ink focus-visible:outline-offset-[-3px]"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...input}
        />
        <button type="button" onClick={() => setShown((s) => !s)} aria-pressed={shown} aria-controls={id} className="min-h-12 shrink-0 rounded-none border-l border-[var(--glass-edge)] px-3 text-sm font-semibold hover:bg-[var(--glass-bg)]">
          {shown ? hideLabel : showLabel}
        </button>
      </div>
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

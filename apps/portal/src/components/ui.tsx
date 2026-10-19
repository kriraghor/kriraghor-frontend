"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

/** Minimal form primitives on the design tokens. Sharp corners (shape lock), 44px+ targets. */
export function Field({ label, id, hint, error, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; hint?: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-muted">
        {label}
      </label>
      <input
        id={id}
        className="min-h-12 border-2 border-line bg-surface px-3 text-base text-ink focus:border-brand"
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
      className="inline-flex min-h-12 items-center justify-center bg-brand px-5 font-bold text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error"; children: ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`border-l-4 px-3 py-2 text-sm ${tone === "error" ? "border-danger text-danger" : "border-info text-ink"}`}>
      {children}
    </p>
  );
}

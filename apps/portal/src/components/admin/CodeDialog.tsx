"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { problemOf, type Problem } from "@/lib/api/client";
import { Button, Notice } from "../ui";

/**
 * Asks for a fresh authenticator code, then runs `onConfirm(code)` (which does the step-up and the
 * protected request). Shows the API's problem title on failure and clears the code for a retry.
 */
export function CodeDialog({ title, help, confirmLabel, onConfirm, onClose, children }: {
  title: string;
  help?: string;
  confirmLabel?: string;
  onConfirm: (code: string) => Promise<void>;
  onClose: () => void;
  children?: ReactNode;
}) {
  const t = useTranslations("common");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      await onConfirm(code);
    } catch (err) {
      setProblem(problemOf(err) ?? { code: "UNKNOWN", title: "Something went wrong", status: 0 });
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form role="dialog" aria-modal="true" aria-labelledby="code-dialog-title" onSubmit={submit} className="w-full max-w-md border-2 border-line-strong bg-surface p-6">
        <h2 id="code-dialog-title" className="text-xl font-extrabold">
          {title}
        </h2>
        {help ? <p className="mt-2 text-sm text-muted">{help}</p> : null}
        {children}
        <label htmlFor="code-dialog-code" className="mt-5 block text-sm font-semibold text-muted">
          {t("code")}
        </label>
        <input
          id="code-dialog-code"
          ref={ref}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-describedby="code-dialog-hint"
          className="mt-1 min-h-12 w-40 border-2 border-line bg-surface px-3 font-mono text-lg tracking-widest"
        />
        <p id="code-dialog-hint" className="text-xs text-muted">
          {t("codeHint")}
        </p>
        {problem ? (
          <div className="mt-4">
            <Notice tone="error">
              {problem.title}
              {problem.detail ? `: ${problem.detail}` : ""}
            </Notice>
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="min-h-12 border-2 border-line px-4 font-semibold" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </button>
          <Button type="submit" busy={busy} disabled={!/^\d{6}$/.test(code)}>
            {confirmLabel ?? t("confirm")}
          </Button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { problemOf, type Problem } from "@kriraghor/api-client";
import { Button, Dialog, Field, Notice } from "@kriraghor/ui/kit";

/**
 * Asks for a fresh authenticator code, then runs `onConfirm(code)` (which does the step-up and the
 * protected request). Shows the API's problem title on failure and clears the code for a retry.
 * Built on the kit Dialog (Radix), so it layers and traps focus correctly when opened from a
 * detail pane, whether that pane is beside the list (xl) or a drawer (below xl).
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
    <Dialog
      open
      onOpenChange={(o) => (o || busy ? undefined : onClose())}
      title={title}
      description={help}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="code-dialog-form" busy={busy} disabled={!/^\d{6}$/.test(code)} data-testid="code-dialog-confirm">
            {confirmLabel ?? t("confirm")}
          </Button>
        </>
      }
    >
      <form id="code-dialog-form" onSubmit={submit} className="px-6 pb-4" data-testid="code-dialog">
        {children}
        <Field
          id="code-dialog-code"
          className="mt-5 w-44"
          inputClassName="font-mono text-lg tracking-widest"
          label={t("code")}
          hint={t("codeHint")}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
        />
        {problem ? (
          <div className="mt-4">
            <Notice tone="error">
              {problem.title}
              {problem.detail ? `: ${problem.detail}` : ""}
            </Notice>
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { problemOf } from "@kriraghor/api-client";
import { Button, Dialog } from "@kriraghor/ui/kit";
import { errorKey, plainProblem } from "@/lib/admin/users";

/** Explains an API problem in plain words (usersDesk.errors.*), falling back to the API's own title. */
export function useExplain() {
  const t = useTranslations("usersDesk");
  return (err: unknown): string => {
    const key = errorKey(err);
    if (key) return t(`errors.${key}`);
    return problemOf(err)?.title ?? t("errors.generic");
  };
}

/** For CodeDialog, which shows the thrown problem's title: the same problem with a plain-language title. */
export function usePlainProblem() {
  const t = useTranslations("usersDesk");
  return (err: unknown) => plainProblem(err, (k) => t(`errors.${k}`));
}

/** A local check that failed, thrown inside a CodeDialog before the code is spent. */
export const formProblem = (title: string) => ({ code: "FORM_INVALID", title, status: 0 });

/**
 * A desk action without a step-up code: the fields, Cancel and the action button. `onConfirm`
 * returns a problem message to show (a failed local check) or throws (an API error, explained in
 * plain words); on success the dialog closes.
 */
export function ActionDialog({
  title,
  description,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
  children,
  testId,
}: {
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<string | void>;
  onClose: () => void;
  children?: ReactNode;
  testId: string;
}) {
  const t = useTranslations("common");
  const explain = useExplain();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const problem = await onConfirm();
      if (problem) setError(problem);
      else onClose();
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => (o || busy ? undefined : onClose())}
      title={title}
      description={description}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={`${testId}-form`} variant={danger ? "danger" : "primary"} busy={busy} data-testid={`${testId}-confirm`}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form id={`${testId}-form`} onSubmit={submit} className="flex flex-col gap-4 pb-2" data-testid={testId} noValidate>
        {children}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

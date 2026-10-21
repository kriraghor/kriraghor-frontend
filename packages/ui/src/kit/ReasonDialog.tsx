"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { Textarea } from "./Form";
import { Dialog } from "./Overlay";

/**
 * Asks for a reason before an action (suspend, reject, remove), instead of window.prompt: a
 * required note with a length check, the action button and Cancel. `onConfirm` may return a
 * promise; the dialog stays open and busy until it settles, and shows `error` if it fails.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  confirmLabel,
  danger,
  minLength = 3,
  maxLength = 500,
  busy,
  error,
  onConfirm,
  testId = "reason-dialog",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  label?: string;
  confirmLabel: string;
  danger?: boolean;
  minLength?: number;
  maxLength?: number;
  busy?: boolean;
  error?: ReactNode;
  onConfirm: (reason: string) => void;
  testId?: string;
}) {
  const t = useTranslations("kit.reason");
  const [text, setText] = useState("");
  const [tried, setTried] = useState(false);
  const reason = text.trim();
  const tooShort = reason.length < minLength;
  const close = (o: boolean) => {
    if (!o) {
      setText("");
      setTried(false);
    }
    onOpenChange(o);
  };
  const submit = () => {
    setTried(true);
    if (!tooShort) onConfirm(reason);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={title}
      description={description}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => close(false)} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button type="button" variant={danger ? "danger" : "primary"} onClick={submit} busy={busy} data-testid={`${testId}-confirm`}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="px-6 pb-2" data-testid={testId}>
        <Textarea
          id={`${testId}-text`}
          label={label ?? t("label")}
          value={text}
          maxLength={maxLength}
          onChange={(e) => setText(e.target.value)}
          error={tried && tooShort ? t("tooShort", { n: minLength }) : undefined}
          hint={t("count", { n: reason.length, max: maxLength })}
          autoFocus
        />
        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

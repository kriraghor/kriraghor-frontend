"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "@phosphor-icons/react";
import { Button } from "../kit/Button";
import { OtpInput } from "../kit/Form";
import { maskTarget } from "./flow";

const RESEND_SECONDS = 45;

/**
 * "Check your messages": where the code went (with Change), six boxes that submit by themselves
 * when full, and Resend after a countdown.
 */
export function CodeStep({ target, busy, onVerify, onResend, onChange }: { target: string; busy: boolean; onVerify: (code: string) => void; onResend: () => Promise<boolean>; onChange: () => void }) {
  const t = useTranslations("auth");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [sentAt, setSentAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const left = Math.max(0, RESEND_SECONDS - Math.floor((now - sentAt) / 1000));

  useEffect(() => {
    if (left === 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [left]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (code.length !== 6) return setError(t("codeIncomplete"));
    setError(undefined);
    onVerify(code);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <button type="button" onClick={onChange} className="-ml-2 inline-flex min-h-10 w-fit items-center gap-1.5 rounded-control px-2 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink">
        <ArrowLeft size={18} aria-hidden />
        {t("back")}
      </button>
      <div>
        <h2 className="text-2xl">{t("codeTitle")}</h2>
        <p className="mt-2 text-[15px] text-muted">
          {t("codeSentTo", { target: maskTarget(target) })}{" "}
          <button type="button" onClick={onChange} className="font-semibold text-brand-text underline-offset-4 hover:underline">
            {t("change")}
          </button>
        </p>
      </div>
      <OtpInput
        id="code"
        name="code"
        label={t("codeLabel")}
        value={code}
        error={error}
        autoFocus
        disabled={busy}
        onChange={(v) => {
          setCode(v);
          if (v.length === 6 && !busy) {
            setError(undefined);
            onVerify(v);
          }
        }}
      />
      <Button size="lg" block busy={busy}>
        {t("verify")}
      </Button>
      <p className="text-center text-sm text-muted">
        {left > 0 ? (
          <span className="tabular">{t("resendIn", { seconds: left })}</span>
        ) : (
          <button
            type="button"
            className="min-h-10 font-semibold text-brand-text underline-offset-4 hover:underline"
            onClick={() =>
              void onResend().then((ok) => {
                if (!ok) return;
                setSentAt(Date.now());
                setNow(Date.now());
                setCode("");
              })
            }
          >
            {t("resend")}
          </button>
        )}
      </p>
    </form>
  );
}

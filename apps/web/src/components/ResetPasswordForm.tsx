"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@kriraghor/ui/i18n/navigation";
import { api, problemOf } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { PASSWORD_MAX, PASSWORD_MIN, resetMessage, resetStep, targetKind, type ResetStep } from "@/lib/reset";
import { ArrowLeft } from "@phosphor-icons/react";
import { Button, Field, Notice, OtpInput, PasswordField } from "@kriraghor/ui/kit";

/**
 * /sign-in/reset (M01): the phone or email, then the code and a new password in one step. The reply
 * to "send" never says whether an account exists. After the reset every device is signed out, and the
 * member signs in here with the new password; the identifier never goes into a URL.
 */
export function ResetPasswordForm({ next = "/me" }: { next?: string }) {
  const t = useTranslations("reset");
  const ts = useTranslations("signIn");
  const te = useTranslations("errors");
  const router = useRouter();
  const { signedIn } = useAuth();
  const [step, setStep] = useState<ResetStep>({ kind: "enter" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const fail = (err: unknown) => {
    const p = problemOf(err) as (ReturnType<typeof problemOf> & { retryAfter?: number }) | null;
    const m = resetMessage(p);
    setError(m ? t(m.key, { seconds: m.seconds ?? 0 }) : (p?.detail ?? p?.title ?? te("generic")));
  };

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch {
      setError(te("network"));
    } finally {
      setBusy(false);
    }
  }

  const send = (target: string) =>
    run(async () => {
      if (!targetKind(target)) return setError(t("targetInvalid"));
      const { error: err } = await api().POST("/auth/otp/send", { body: { target, purpose: "reset" } });
      if (err) return fail(err);
      setInfo(t("sent"));
      setStep((s) => resetStep(s, { type: "sent", target }));
    });

  const onSend = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void send(String(new FormData(e.currentTarget).get("target") ?? "").trim());
  };

  const onReset = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step.kind !== "code") return;
    const f = new FormData(e.currentTarget);
    const newPassword = String(f.get("newPassword") ?? "");
    if (newPassword !== String(f.get("confirm") ?? "")) return setError(t("mismatch"));
    void run(async () => {
      const { error: err } = await api().POST("/auth/password/reset", { body: { target: step.target, code, newPassword } });
      if (err) return fail(err);
      setInfo(null);
      setStep((s) => resetStep(s, { type: "reset" }));
    });
  };

  const onSignIn = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step.kind !== "done") return;
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    void run(async () => {
      const { data, error: err } = await api().POST("/auth/login", { body: { identifier: step.target, password } });
      if (err) return fail(err);
      const body = data as { status?: string; accessToken?: string } | undefined;
      if (body?.status === "signed_in" && body.accessToken) {
        signedIn(body.accessToken);
        router.push(next);
      }
    });
  };

  return (
    <div data-testid="reset-password">
      <Link href="/sign-in" className="-ml-2 mb-4 inline-flex min-h-10 items-center gap-1.5 rounded-control px-2 text-sm font-semibold text-muted no-underline hover:bg-surface-2 hover:text-ink">
        <ArrowLeft size={18} aria-hidden />
        {t("back")}
      </Link>
      <h1 className="text-3xl sm:text-4xl">{step.kind === "done" ? t("doneTitle") : t("title")}</h1>
      <p className="mt-2 text-muted">{step.kind === "done" ? t("doneBody") : t("subtitle")}</p>

      <div className="mt-6 flex flex-col gap-4">
        {error ? <Notice tone="error">{error}</Notice> : null}
        {info && !error ? <Notice>{info}</Notice> : null}

        {step.kind === "enter" ? (
          <form onSubmit={onSend} className="flex flex-col gap-4">
            <Field id="target" name="target" required label={t("targetLabel")} autoComplete="username" hint={t("targetHint")} />
            <Button size="lg" block busy={busy}>{t("send")}</Button>
          </form>
        ) : null}

        {step.kind === "code" ? (
          <form onSubmit={onReset} className="flex flex-col gap-4">
            <OtpInput id="code" name="code" label={ts("codeLabel")} value={code} onChange={setCode} autoFocus />
            <PasswordField id="newPassword" name="newPassword" required minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} autoComplete="new-password" label={t("newPassword")} hint={t("passwordHint", { min: PASSWORD_MIN })} showLabel={t("show")} hideLabel={t("hide")} />
            <PasswordField id="confirm" name="confirm" required minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} autoComplete="new-password" label={t("confirm")} showLabel={t("show")} hideLabel={t("hide")} />
            <Button size="lg" block busy={busy}>{t("save")}</Button>
            <div className="flex flex-wrap justify-center gap-2 text-sm">
              <button type="button" className="min-h-11 rounded-control px-3 font-semibold text-brand-text hover:bg-surface-2" onClick={() => (setCode(""), void send(step.target))} disabled={busy}>
                {t("resend")}
              </button>
              <button type="button" className="min-h-11 rounded-control px-3 font-semibold hover:bg-surface-2" onClick={() => (setError(null), setInfo(null), setStep((s) => resetStep(s, { type: "restart" })))}>
                {t("other")}
              </button>
            </div>
          </form>
        ) : null}

        {step.kind === "done" ? (
          <form onSubmit={onSignIn} className="flex flex-col gap-4">
            <Field id="identifier" name="identifier" label={ts("identifierLabel")} value={step.target} readOnly autoComplete="username" />
            <PasswordField id="password" name="password" required autoComplete="current-password" label={ts("passwordLabel")} showLabel={t("show")} hideLabel={t("hide")} />
            <Button size="lg" block busy={busy}>{ts("signInButton")}</Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

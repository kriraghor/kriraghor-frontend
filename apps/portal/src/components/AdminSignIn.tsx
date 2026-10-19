"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { api, problemOf } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button, Field, Notice } from "./ui";

type Step =
  | { kind: "enter" }
  | { kind: "code"; target: string }
  | { kind: "totp"; challengeToken: string }
  | { kind: "setup"; challengeToken: string; secret: string; otpauthUrl: string };

type Challenge = { status: string; challengeToken: string };

/**
 * Staff sign-in (ADR-004, M01-FR-10): password or a phone code at /auth/admin/login, then TOTP.
 * First sign-in enrols an authenticator (setup → activate); later sign-ins verify a code.
 * The result is an admin session (aud "admin") with its own cookies, separate from customer sessions.
 */
export function AdminSignIn() {
  const t = useTranslations();
  const router = useRouter();
  const { signedIn } = useAuth();
  const [mode, setMode] = useState<"password" | "phone">("password");
  const [step, setStep] = useState<Step>({ kind: "enter" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = (err: unknown) => {
    const p = problemOf(err);
    setError(p?.detail ?? p?.title ?? t("errors.generic"));
  };

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch {
      setError(t("errors.network"));
    } finally {
      setBusy(false);
    }
  }

  /** After /auth/admin/login: enrol TOTP the first time, otherwise ask for a code. */
  async function onChallenge(c: Challenge) {
    if (c.status === "two_factor_setup_required") {
      const { data, error } = await api("admin").POST("/auth/2fa/totp/setup", { body: { challengeToken: c.challengeToken } });
      if (error) return fail(error);
      setStep({ kind: "setup", challengeToken: c.challengeToken, secret: data.secret, otpauthUrl: data.otpauthUrl });
    } else {
      setStep({ kind: "totp", challengeToken: c.challengeToken });
    }
  }

  const passwordLogin = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(async () => {
      const { data, error } = await api("admin").POST("/auth/admin/login", {
        body: { identifier: String(f.get("identifier") ?? "").trim(), password: String(f.get("password") ?? "") },
      });
      if (error) return fail(error);
      await onChallenge(data);
    });
  };

  const sendCode = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const target = String(new FormData(e.currentTarget).get("target") ?? "").trim();
    void run(async () => {
      const { error } = await api("admin").POST("/auth/otp/send", { body: { target, purpose: "login" } });
      if (error) return fail(error);
      setStep({ kind: "code", target });
    });
  };

  const verifyCode = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step.kind !== "code") return;
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    void run(async () => {
      const { data, error } = await api("admin").POST("/auth/admin/login", { body: { target: step.target, code } });
      if (error) return fail(error);
      await onChallenge(data);
    });
  };

  const confirmTotp = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step.kind !== "totp" && step.kind !== "setup") return;
    const code = String(new FormData(e.currentTarget).get("totp") ?? "").trim();
    const path = step.kind === "setup" ? "/auth/2fa/totp/activate" : "/auth/2fa/totp/verify";
    void run(async () => {
      const { data, error } = await api("admin").POST(path, { body: { challengeToken: step.challengeToken, code } });
      if (error) return fail(error);
      signedIn(data.accessToken);
      router.push("/admin");
    });
  };

  return (
    <section className="mx-auto w-full max-w-md px-5 py-12">
      <h1 className="text-3xl font-extrabold">{t("admin.title")}</h1>
      <p className="mt-2 text-muted">{t("admin.subtitle")}</p>

      <div className="mt-6 flex flex-col gap-4">
        {error ? <Notice tone="error">{error}</Notice> : null}

        {step.kind === "enter" ? (
          <>
            <div role="group" aria-label={t("admin.otpOrPassword")} className="grid grid-cols-2 border-b-2 border-line">
              {(["password", "phone"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={`-mb-0.5 min-h-12 border-b-4 text-sm font-bold ${mode === m ? "border-brand" : "border-transparent text-muted"}`}
                >
                  {t(`signIn.${m}`)}
                </button>
              ))}
            </div>
            {mode === "password" ? (
              <form onSubmit={passwordLogin} className="flex flex-col gap-4">
                <Field id="identifier" name="identifier" required label={t("signIn.identifierLabel")} autoComplete="username" />
                <Field id="password" name="password" required type="password" label={t("signIn.passwordLabel")} autoComplete="current-password" />
                <Button busy={busy}>{t("signIn.signInButton")}</Button>
              </form>
            ) : (
              <form onSubmit={sendCode} className="flex flex-col gap-4">
                <Field id="target" name="target" required type="tel" inputMode="tel" autoComplete="tel" label={t("signIn.phoneLabel")} placeholder="01XXXXXXXXX" />
                <Button busy={busy}>{t("signIn.sendCode")}</Button>
              </form>
            )}
          </>
        ) : null}

        {step.kind === "code" ? (
          <form onSubmit={verifyCode} className="flex flex-col gap-4">
            <Notice>{t("signIn.codeSent")}</Notice>
            <Field id="code" name="code" required label={t("signIn.codeLabel")} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} />
            <Button busy={busy}>{t("signIn.verify")}</Button>
          </form>
        ) : null}

        {step.kind === "setup" ? (
          <div className="flex flex-col gap-3 border-2 border-line p-4">
            <h2 className="text-xl font-bold">{t("admin.totpSetup")}</h2>
            <p className="text-sm text-muted">{t("admin.totpSetupHelp")}</p>
            <code data-testid="totp-secret" className="break-all bg-surface-2 p-3 font-mono text-lg tracking-widest">
              {step.secret}
            </code>
            <a href={step.otpauthUrl} className="text-sm font-bold text-brand-text underline">
              otpauth://
            </a>
          </div>
        ) : null}

        {step.kind === "totp" || step.kind === "setup" ? (
          <form onSubmit={confirmTotp} className="flex flex-col gap-4">
            <Field id="totp" name="totp" required label={t("admin.totpCode")} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} />
            <Button busy={busy}>{t("admin.confirm")}</Button>
          </form>
        ) : null}
      </div>
    </section>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Key } from "@phosphor-icons/react";
import { Link, useRouter } from "./i18n/navigation";
import { api, problemOf } from "@kriraghor/api-client";
import { publicEnv } from "@kriraghor/session/env";
import { useAuth } from "./auth";
import { Button } from "./kit/Button";
import { Field, PasswordField } from "./kit/Form";
import { Divider, Notice } from "./kit/Display";
import { AccountLocked } from "./kit/Support";
import { GoogleButton } from "./auth/GoogleButton";
import { CodeStep } from "./auth/CodeStep";
import { handoffFrom, identifierKind, saveHandoff, type AuthBody, type SignupHandoff } from "./auth/flow";

type Mode = "code" | "password";
type Step = { kind: "enter" } | { kind: "code"; target: string };

/**
 * Customer sign-in for M01 (kriraghor.com, esports, gym and the vendor portal). Google first, then
 * mobile, email or username with a password (the default since 30 Oct 2026); a one-time code to a
 * mobile or email is one tap away and is offered again after a wrong password or a lockout, because
 * accounts made with a code have no password. A verified code or a Google account that has no
 * Kriraghor account yet carries on at the sign-up page (hand-over in sessionStorage, never the URL).
 * `passwordReset` means this site hosts /sign-in/reset (kriraghor.com); the other sites link to
 * kriraghor.com's page. `signUpHref` is where "Create an account" goes; `subtitle` replaces the
 * line under the title where a site needs its own (gym).
 */
export function SignInForm({ next = "/me", passwordReset = false, signUpHref = "/signup", subtitle }: { next?: string; passwordReset?: boolean; signUpHref?: string | null; subtitle?: string }) {
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  const router = useRouter();
  const { signedIn } = useAuth();
  const [mode, setMode] = useState<Mode>("password");
  const [step, setStep] = useState<Step>({ kind: "enter" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  // After a wrong password or a lockout: point to the code, which works with or without a password.
  const [hint, setHint] = useState<"noPasswordHint" | "lockedHint" | null>(null);
  // What was typed in one mode is kept when switching to the other.
  const [who, setWho] = useState("");

  const withNext = (href: string) => (next === "/me" ? href : `${href}?next=${encodeURIComponent(next)}`);

  // The account is suspended (ACCOUNT_SUSPENDED): the locked panel with Kriraghor support (19 Nov 2026).
  const [locked, setLocked] = useState(false);
  const fail = (err: unknown) => {
    const p = problemOf(err);
    if (p?.code === "ACCOUNT_SUSPENDED") return setLocked(true);
    setHint(p?.code === "INVALID_CREDENTIALS" ? "noPasswordHint" : p?.code === "AUTH_LOCKED" ? "lockedHint" : null);
    setError(p?.code === "STAFF_USE_ADMIN_PORTAL" ? t("staffUseAdmin") : (p?.detail ?? p?.title ?? te("generic")));
  };

  const finish = (body: AuthBody, via: SignupHandoff["via"]) => {
    if (body?.status === "signed_in" && body.accessToken) {
      signedIn(body.accessToken);
      router.push(next);
      return;
    }
    const handoff = handoffFrom(body, via);
    if (handoff && signUpHref) {
      saveHandoff(handoff);
      router.push(withNext(signUpHref));
    }
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      await fn();
    } catch {
      setError(te("network"));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async (target: string) => {
    const { error: err } = await api().POST("/auth/otp/send", { body: { target, purpose: "login" } });
    if (err) {
      fail(err);
      return false;
    }
    return true;
  };

  const onEnter = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const target = String(new FormData(e.currentTarget).get("target") ?? "").trim();
    if (!identifierKind(target)) return setFieldError(t("identifierInvalid"));
    setFieldError(undefined);
    void run(async () => {
      if (await sendCode(target)) setStep({ kind: "code", target });
    });
  };

  const onVerify = (target: string) => (code: string) =>
    void run(async () => {
      const { data, error: err } = await api().POST("/auth/otp/verify", { body: { target, purpose: "login", code } });
      if (err) return fail(err);
      finish(data as AuthBody, identifierKind(target) ?? "phone");
    });

  const onPassword = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(async () => {
      const { data, error: err } = await api().POST("/auth/login", { body: { identifier: String(f.get("identifier") ?? "").trim(), password: String(f.get("password") ?? "") } });
      if (err) return fail(err);
      finish(data as AuthBody, "phone");
    });
  };

  const onGoogle = (idToken: string) =>
    void run(async () => {
      const { data, error: err } = await api().POST("/auth/google", { body: { idToken } });
      if (err) return fail(err);
      finish(data as AuthBody, "google");
    });

  const switchMode = (to: Mode) => {
    setMode(to);
    setError(null);
    setHint(null);
    setFieldError(undefined);
  };
  const resetHref = passwordReset ? null : `${publicEnv().WEB_URL}/sign-in/reset`;
  const forgotClass = "-mt-1 w-fit text-sm font-semibold text-brand-text underline-offset-4 hover:underline";

  if (locked) {
    return (
      <div className="flex flex-col gap-6" data-testid="sign-in">
        <h1 className="text-3xl sm:text-4xl">{t("signInTitle")}</h1>
        <AccountLocked />
      </div>
    );
  }

  if (step.kind === "code") {
    return (
      <div className="flex flex-col gap-4">
        {error ? <Notice tone="error">{error}</Notice> : null}
        <CodeStep target={step.target} busy={busy} onVerify={onVerify(step.target)} onResend={() => sendCode(step.target)} onChange={() => (setStep({ kind: "enter" }), setError(null))} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="sign-in">
      <div>
        <h1 className="text-3xl sm:text-4xl">{t("signInTitle")}</h1>
        <p className="mt-2 text-muted">{subtitle ?? t("signInSubtitle")}</p>
      </div>

      {error ? (
        <Notice tone="error">
          {error}
          {hint ? (
            <button type="button" onClick={() => switchMode("code")} className="mt-1 block text-left font-semibold underline underline-offset-4" data-testid="sign-in-hint">
              {t(hint)}
            </button>
          ) : null}
        </Notice>
      ) : null}

      <GoogleButton onCredential={onGoogle} text="continue_with" />
      <Divider>{t("or")}</Divider>

      {mode === "code" ? (
        <form onSubmit={onEnter} className="flex flex-col gap-4" noValidate>
          <Field id="target" name="target" required defaultValue={who} onChange={(e) => setWho(e.currentTarget.value)} label={t("identifierLabel")} hint={t("identifierHint")} error={fieldError} autoComplete="username" placeholder="01XXXXXXXXX" />
          <Button size="lg" block busy={busy}>
            {t("continue")}
          </Button>
        </form>
      ) : (
        <form onSubmit={onPassword} className="flex flex-col gap-4">
          <Field id="identifier" name="identifier" required defaultValue={who} onChange={(e) => setWho(e.currentTarget.value)} label={t("passwordIdentifierLabel")} autoComplete="username" />
          <PasswordField id="password" name="password" required label={t("passwordLabel")} autoComplete="current-password" showLabel={t("show")} hideLabel={t("hide")} />
          {resetHref ? (
            <a href={resetHref} className={forgotClass} data-testid="forgot-password">
              {t("forgot")}
            </a>
          ) : (
            <Link href={withNext("/sign-in/reset")} className={forgotClass} data-testid="forgot-password">
              {t("forgot")}
            </Link>
          )}
          <Button size="lg" block busy={busy}>
            {t("signIn")}
          </Button>
        </form>
      )}

      <button
        type="button"
        onClick={() => switchMode(mode === "code" ? "password" : "code")}
        className="mx-auto inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-sm font-semibold text-ink hover:bg-surface-2"
        data-testid={mode === "code" ? "use-password" : "use-code"}
      >
        <Key size={18} aria-hidden />
        {mode === "code" ? t("usePassword") : t("useCode")}
      </button>

      {signUpHref ? (
        <p className="border-t border-line pt-5 text-center text-[15px] text-muted">
          {t("noAccount")}{" "}
          <Link href={withNext(signUpHref)} className="font-semibold text-brand-text underline-offset-4 hover:underline" data-testid="create-account">
            {t("createAccount")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}

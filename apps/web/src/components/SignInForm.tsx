"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { api, problemOf } from "@kriraghor/api-client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { publicEnv } from "@kriraghor/session/env";
import { Button, Field, Notice, PasswordField } from "./ui";

type Method = "phone" | "email" | "password" | "google";
type Step = { kind: "enter" } | { kind: "code"; target: string } | { kind: "signup"; signupToken: string };

/**
 * Customer sign-in for M01 (web, esports and the vendor portal): phone OTP, email OTP,
 * password (phone, email or username) and Google. A verified code for an unknown number
 * returns a signup token, and the user finishes signup with their name.
 */
export function SignInForm({ next = "/me" }: { next?: string }) {
  const t = useTranslations();
  const router = useRouter();
  const { signedIn } = useAuth();
  const [method, setMethod] = useState<Method>("phone");
  const [step, setStep] = useState<Step>({ kind: "enter" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const fail = (err: unknown) => {
    const p = problemOf(err);
    setError(p?.code === "STAFF_USE_ADMIN_PORTAL" ? t("signIn.staffUseAdmin") : (p?.detail ?? p?.title ?? t("errors.generic")));
  };

  type AuthBody = { status?: string; accessToken?: string; signupToken?: string } | undefined;
  const finish = (body: AuthBody) => {
    if (body?.status === "signed_in" && body.accessToken) {
      signedIn(body.accessToken);
      router.push(next);
    } else if (body?.status === "signup" && body.signupToken) {
      setStep({ kind: "signup", signupToken: body.signupToken });
    }
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

  const sendCode = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const target = String(new FormData(e.currentTarget).get("target") ?? "").trim();
    void run(async () => {
      const { error: err } = await api().POST("/auth/otp/send", { body: { target, purpose: "login" } });
      if (err) return fail(err);
      setInfo(t("signIn.codeSent"));
      setStep({ kind: "code", target });
    });
  };

  const verifyCode = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step.kind !== "code") return;
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    void run(async () => {
      const { data, error: err } = await api().POST("/auth/otp/verify", { body: { target: step.target, purpose: "login", code } });
      if (err) return fail(err);
      finish(data as AuthBody);
    });
  };

  const finishSignup = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step.kind !== "signup") return;
    const displayName = String(new FormData(e.currentTarget).get("displayName") ?? "").trim();
    void run(async () => {
      const { data, error: err } = await api().POST("/auth/signup", { body: { signupToken: step.signupToken, displayName } });
      if (err) return fail(err);
      finish(data as AuthBody);
    });
  };

  const passwordLogin = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(async () => {
      const { data, error: err } = await api().POST("/auth/login", {
        body: { identifier: String(f.get("identifier") ?? "").trim(), password: String(f.get("password") ?? "") },
      });
      if (err) return fail(err);
      finish(data as AuthBody);
    });
  };

  const tabs: Method[] = ["phone", "email", "password", "google"];

  return (
    <section className="mx-auto w-full max-w-md px-5 py-12">
      <h1 className="text-3xl font-extrabold">{t("signIn.title")}</h1>
      <p className="mt-2 text-muted">{t("signIn.subtitle")}</p>

      <div role="tablist" aria-label={t("signIn.title")} className="mt-8 grid grid-cols-4 border-b-2 border-line">
        {tabs.map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={method === m}
            onClick={() => {
              setMethod(m);
              setStep({ kind: "enter" });
              setError(null);
              setInfo(null);
            }}
            className={`-mb-0.5 min-h-12 border-b-4 text-sm font-bold ${method === m ? "border-brand text-ink" : "border-transparent text-muted"}`}
          >
            {t(`signIn.${m}`)}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {error ? <Notice tone="error">{error}</Notice> : null}
        {info && !error ? <Notice>{info}</Notice> : null}

        {(method === "phone" || method === "email") && step.kind === "enter" ? (
          <form onSubmit={sendCode} className="flex flex-col gap-4">
            <Field
              id="target"
              name="target"
              required
              label={method === "phone" ? t("signIn.phoneLabel") : t("signIn.emailLabel")}
              type={method === "phone" ? "tel" : "email"}
              inputMode={method === "phone" ? "tel" : "email"}
              autoComplete={method === "phone" ? "tel" : "email"}
              placeholder={method === "phone" ? "01XXXXXXXXX" : "you@example.com"}
              hint={t("signIn.newHere")}
            />
            <Button busy={busy}>{t("signIn.sendCode")}</Button>
          </form>
        ) : null}

        {step.kind === "code" ? (
          <form onSubmit={verifyCode} className="flex flex-col gap-4">
            <Field id="code" name="code" required label={t("signIn.codeLabel")} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} />
            <Button busy={busy}>{t("signIn.verify")}</Button>
          </form>
        ) : null}

        {step.kind === "signup" ? (
          <form onSubmit={finishSignup} className="flex flex-col gap-4">
            <Field id="displayName" name="displayName" required minLength={2} maxLength={80} label={t("signIn.nameLabel")} autoComplete="name" />
            <Button busy={busy}>{t("signIn.finishSignup")}</Button>
          </form>
        ) : null}

        {method === "password" && step.kind === "enter" ? (
          <form onSubmit={passwordLogin} className="flex flex-col gap-4">
            <Field id="identifier" name="identifier" required label={t("signIn.identifierLabel")} autoComplete="username" />
            <PasswordField id="password" name="password" required label={t("signIn.passwordLabel")} autoComplete="current-password" showLabel={t("reset.show")} hideLabel={t("reset.hide")} />
            <Button busy={busy}>{t("signIn.signInButton")}</Button>
            <Link href={next === "/me" ? "/sign-in/reset" : `/sign-in/reset?next=${encodeURIComponent(next)}`} className="min-h-11 text-sm font-semibold text-brand-text underline" data-testid="forgot-password">
              {t("signIn.forgot")}
            </Link>
          </form>
        ) : null}

        {method === "google" && step.kind === "enter" ? <GoogleButton onCredential={(idToken) => void run(async () => {
          const { data, error: err } = await api().POST("/auth/google", { body: { idToken } });
          if (err) return fail(err);
          finish(data as AuthBody);
        })} /> : null}
      </div>
    </section>
  );
}

type GoogleId = {
  accounts: { id: { initialize: (o: { client_id: string; callback: (r: { credential: string }) => void }) => void; renderButton: (el: HTMLElement, o: Record<string, unknown>) => void } };
};

/** Google Identity Services button. Its credential (an ID token) goes to POST /auth/google. */
function GoogleButton({ onCredential }: { onCredential: (idToken: string) => void }) {
  const t = useTranslations();
  const ref = useRef<HTMLDivElement>(null);
  const clientId = publicEnv().GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !ref.current) return;
    const el = ref.current;
    const render = () => {
      const g = (window as unknown as { google?: GoogleId }).google;
      if (!g) return;
      g.accounts.id.initialize({ client_id: clientId, callback: (r) => onCredential(r.credential) });
      g.accounts.id.renderButton(el, { theme: "outline", size: "large", shape: "rectangular", width: 320 });
    };
    if ((window as unknown as { google?: GoogleId }).google) return render();
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [clientId, onCredential]);

  if (!clientId) return <Notice>{t("signIn.googleUnavailable")}</Notice>;
  return <div ref={ref} className="min-h-11" />;
}

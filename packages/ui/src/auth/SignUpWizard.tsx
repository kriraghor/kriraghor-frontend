"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Icon } from "@phosphor-icons/react";
import { ArrowLeft, ArrowRight, Barbell, CheckCircle, Flag, GameController, SoccerBall, Storefront, Trophy, UserCircleGear } from "@phosphor-icons/react";
import { api, problemOf } from "@kriraghor/api-client";
import { Link, useRouter } from "../i18n/navigation";
import { useAuth } from "../auth";
import { useToast } from "../kit/Toast";
import { Button, ButtonLink } from "../kit/Button";
import { Field, PasswordField } from "../kit/Form";
import { Divider, Notice } from "../kit/Display";
import { cn } from "../cn";
import { GoogleButton } from "./GoogleButton";
import { CodeStep } from "./CodeStep";
import { handoffFrom, identifierKind, normalizeUsername, signupSteps, takeHandoff, type AuthBody, type SignupHandoff, type SignupRole, type SignupStep } from "./flow";

const ROLE_ICON: Record<SignupRole, Icon> = {
  none: GameController,
  player: SoccerBall,
  pro: UserCircleGear,
  ground_owner: Flag,
  shop_owner: Storefront,
  gym_owner: Barbell,
  organiser: Trophy,
};

export type NextStep = { href: string; label: string };

type Props = {
  /** Where "Go to my account" and a returning visitor land. */
  next?: string;
  /** The roles offered on the "Your goal" step; none (or an empty list) skips the step. */
  roles?: SignupRole[];
  /** The "What to do next" links for the chosen role (each app knows its own pages). */
  nextSteps: (role: SignupRole) => NextStep[];
  signInHref?: string;
  termsHref?: string;
  privacyHref?: string;
};

type Verified = Pick<SignupHandoff, "signupToken" | "expiresAt" | "via" | "suggested">;

/**
 * /signup (M01 sign-up, design plan Part C): Verify (Google, or mobile/email and a code) → About
 * you (name, username, optional password) → Your goal (one role to ask for) → Done (next steps).
 * Uses the existing API: POST /auth/otp/send|verify (purpose signup), /auth/google and /auth/signup.
 * A number that already has an account is simply signed in (the API never says it exists).
 */
export function SignUpWizard({ next = "/me", roles = [], nextSteps, signInHref = "/sign-in", termsHref = "/terms", privacyHref = "/privacy" }: Props) {
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const { signedIn } = useAuth();
  const steps = signupSteps(roles.length > 0);

  const [step, setStep] = useState<SignupStep>("verify");
  const [target, setTarget] = useState<string | null>(null);
  const [verified, setVerified] = useState<Verified | null>(null);
  const [about, setAbout] = useState({ displayName: "", username: "", password: "" });
  const [role, setRole] = useState<SignupRole>("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [name, setName] = useState("");

  // Arriving from the sign-in page with a verified identity: start at "About you".
  useEffect(() => {
    const h = takeHandoff();
    if (!h) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from sessionStorage after mount
    setVerified(h);
    setAbout((a) => ({ ...a, displayName: h.suggested?.displayName ?? "" }));
    setStep("about");
  }, []);

  const fail = (err: unknown) => {
    const p = problemOf(err);
    setError(p?.detail ?? p?.title ?? te("generic"));
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
    await fn();
    } catch {
    setError(te("network"));
    } finally {
    setBusy(false);
  }
  };

  /** A verify or Google answer: an existing account signs in; a new one moves to "About you". */
  const onAuth = (body: AuthBody, via: SignupHandoff["via"]) => {
    if (body?.status === "signed_in" && body.accessToken) {
      signedIn(body.accessToken);
      toast.show(t("signup.welcomeBack"), "info");
      router.push(next);
      return;
    }
    const h = handoffFrom(body, via);
    if (!h) return;
    setVerified(h);
    setAbout((a) => ({ ...a, displayName: a.displayName || h.suggested?.displayName || "" }));
    setStep("about");
  };

  const sendCode = async (to: string) => {
    const { error: err } = await api().POST("/auth/otp/send", { body: { target: to, purpose: "signup", locale: locale === "bn" ? "bn" : "en" } });
    if (err) {
      fail(err);
      return false;
    }
    return true;
  };

  const onGoogle = (idToken: string) =>
    void run(async () => {
      const { data, error: err } = await api().POST("/auth/google", { body: { idToken } });
      if (err) return fail(err);
      onAuth(data as AuthBody, "google");
    });

  // The About values are passed in when the role step is skipped: setAbout has not re-rendered yet,
  // so reading `about` there would send an empty name (the gym site has no role step).
  const create = (chosen: SignupRole, a: typeof about = about) =>
    void run(async () => {
      if (!verified || verified.expiresAt <= Date.now()) {
        setVerified(null);
        setStep("verify");
        return setError(t("signup.expired"));
      }
      const { data, error: err } = await api().POST("/auth/signup", {
        body: {
          signupToken: verified.signupToken,
          displayName: a.displayName.trim(),
          username: normalizeUsername(a.username) ?? undefined,
          password: a.password || undefined,
          locale: locale === "bn" ? "bn" : "en",
          role: chosen === "none" ? undefined : chosen,
        },
      });
      if (err) {
        if (problemOf(err)?.code === "SIGNUP_TOKEN_INVALID") {
          setVerified(null);
          setStep("verify");
          return setError(t("signup.expired"));
        }
        return fail(err);
      }
      const body = data as AuthBody;
      if (body?.accessToken) signedIn(body.accessToken);
      setName(a.displayName.trim().split(/\s+/)[0] ?? "");
      setStep("done");
    });

  const index = steps.indexOf(step);

  return (
    <div className="flex flex-col gap-6" data-testid="sign-up">
      <div>
        <h1 className="text-3xl sm:text-4xl">{step === "done" ? t("signup.doneTitle", { name }) : t("signup.title")}</h1>
        <p className="mt-2 text-muted">{step === "done" ? t("signup.doneBody") : t("signup.subtitle")}</p>
      </div>

      <Progress steps={steps} index={index} />

      {error ? <Notice tone="error">{error}</Notice> : null}

      {step === "verify" && !target ? (
        <div className="flex flex-col gap-5">
          <h2 className="text-lg font-semibold">{t("signup.verifyTitle")}</h2>
          <GoogleButton onCredential={onGoogle} text="signup_with" />
          <Divider>{t("or")}</Divider>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const to = String(new FormData(e.currentTarget).get("target") ?? "").trim();
              if (!identifierKind(to)) return setFieldError(t("identifierInvalid"));
              setFieldError(undefined);
              void run(async () => {
                if (await sendCode(to)) setTarget(to);
              });
            }}
          >
            <Field id="target" name="target" required label={t("identifierLabel")} hint={t("identifierHint")} error={fieldError} autoComplete="username" placeholder="01XXXXXXXXX" />
            <Button size="lg" block busy={busy}>
              {t("continue")}
            </Button>
          </form>
          <Legal termsHref={termsHref} privacyHref={privacyHref} />
        </div>
      ) : null}

      {step === "verify" && target ? (
        <CodeStep
          target={target}
          busy={busy}
          onChange={() => (setTarget(null), setError(null))}
          onResend={() => sendCode(target)}
          onVerify={(code) =>
            void run(async () => {
              const { data, error: err } = await api().POST("/auth/otp/verify", { body: { target, purpose: "signup", code } });
              if (err) return fail(err);
              onAuth(data as AuthBody, identifierKind(target) ?? "phone");
            })
          }
        />
      ) : null}

      {step === "about" ? (
        <AboutStep
          value={about}
          needsUsername={Boolean(verified?.suggested?.needsUsername)}
          busy={busy}
          finalStep={roles.length === 0}
          onBack={() => (setVerified(null), setTarget(null), setStep("verify"))}
          onSubmit={(v) => {
            setAbout(v);
            if (roles.length) setStep("role");
            else create("none", v);
          }}
        />
      ) : null}

      {step === "role" ? (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            create(role);
          }}
        >
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-1 text-lg font-semibold">{t("signup.roleTitle")}</legend>
            <p className="-mt-1 mb-2 text-sm text-muted">{t("signup.roleHint")}</p>
            {roles.map((r) => {
              const RoleIcon = ROLE_ICON[r];
              const on = role === r;
              return (
                <label
                  key={r}
                  className={cn(
                    "flex cursor-pointer items-center gap-4 rounded-control border bg-surface px-4 py-3.5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--kg-focus)]",
                    on ? "border-brand bg-brand-soft/60" : "border-line hover:border-line-strong",
                  )}
                  data-testid={`signup-role-${r}`}
                >
                  <input type="radio" name="role" value={r} checked={on} onChange={() => setRole(r)} className="sr-only" />
                  <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-pill", on ? "bg-brand text-on-brand" : "bg-surface-2 text-ink")}>
                    <RoleIcon size={22} weight={on ? "fill" : "regular"} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{t(`signup.roles.${r}.title`)}</span>
                    <span className="block text-sm text-muted">{t(`signup.roles.${r}.body`)}</span>
                  </span>
                  <CheckCircle size={22} weight="fill" aria-hidden className={cn("shrink-0 text-brand transition-opacity", on ? "opacity-100" : "opacity-0")} />
                </label>
              );
            })}
          </fieldset>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" size="lg" onClick={() => setStep("about")} icon={<ArrowLeft size={18} aria-hidden />}>
              {t("back")}
            </Button>
            <Button size="lg" className="flex-1" busy={busy} data-testid="signup-create">
              {t("signup.create")}
            </Button>
          </div>
        </form>
      ) : null}

      {step === "done" ? (
        <div className="flex flex-col gap-4" data-testid="signup-done">
          <h2 className="text-lg font-semibold">{t("signup.next")}</h2>
          <ul className="flex flex-col gap-2">
            {nextSteps(role).map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="group flex min-h-14 items-center gap-3 rounded-control border border-line bg-surface px-4 py-3 font-semibold no-underline transition-colors hover:border-brand">
                  <span className="flex-1">{s.label}</span>
                  <ArrowRight size={20} aria-hidden className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                </Link>
              </li>
            ))}
          </ul>
          <ButtonLink href={next} size="lg" block>
            {t("signup.goAccount")}
          </ButtonLink>
        </div>
      ) : null}

      {step !== "done" ? (
        <p className="border-t border-line pt-5 text-center text-[15px] text-muted">
          {t("haveAccount")}{" "}
          <Link href={next === "/me" ? signInHref : `${signInHref}?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-text underline-offset-4 hover:underline">
            {t("signIn")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}

/** Step bars with the current step's name for screen readers and sighted users alike. */
function Progress({ steps, index }: { steps: SignupStep[]; index: number }) {
  const t = useTranslations("auth.signup");
  return (
    <div>
      <p className="mb-2 flex justify-between text-sm font-semibold">
        <span>{t(`steps.${steps[index]}`)}</span>
        <span className="tabular text-muted">{t("stepOf", { n: index + 1, total: steps.length })}</span>
      </p>
      <ol className="flex gap-1.5" aria-label={t("stepOf", { n: index + 1, total: steps.length })}>
        {steps.map((s, i) => (
          <li key={s} className={cn("h-1.5 flex-1 rounded-pill transition-colors duration-300", i <= index ? "bg-brand" : "bg-surface-2")} aria-current={i === index ? "step" : undefined}>
            <span className="sr-only">{t(`steps.${s}`)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

type About = { displayName: string; username: string; password: string };

/** Name, username (checked as you type), optional password. */
function AboutStep({ value, needsUsername, busy, finalStep, onBack, onSubmit }: { value: About; needsUsername: boolean; busy: boolean; finalStep: boolean; onBack: () => void; onSubmit: (v: About) => void }) {
  const t = useTranslations("auth");
  const tk = useTranslations("kit");
  const [v, setV] = useState(value);
  const [nameError, setNameError] = useState<string | undefined>();
  const check = useUsernameCheck(v.username);

  const usernameError = check.state === "taken" ? t("signup.usernameTaken") : check.state === "invalid" ? t("signup.usernameInvalid") : undefined;
  const usernameHint: ReactNode =
    check.state === "free" ? (
      <span className="flex items-center gap-1.5 text-brand-text">
        <CheckCircle size={16} weight="fill" aria-hidden />
        {t("signup.usernameFree", { username: check.username ?? "" })}
      </span>
    ) : check.state === "checking" ? (
      t("signup.usernameChecking")
    ) : (
      t("signup.usernameHint")
    );

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.displayName.trim().length < 2) return setNameError(t("signup.nameRequired"));
        setNameError(undefined);
        if (usernameError || (needsUsername && check.state !== "free") || check.state === "checking") return;
        if (v.password && v.password.length < 8) return;
        onSubmit(v);
      }}
    >
      <h2 className="text-lg font-semibold">{t("signup.aboutTitle")}</h2>
      <Field id="displayName" name="displayName" required minLength={2} maxLength={80} autoComplete="name" label={t("signup.nameLabel")} hint={t("signup.nameHint")} error={nameError} value={v.displayName} onChange={(e) => setV({ ...v, displayName: e.target.value })} />
      <Field
        id="username"
        name="username"
        label={t("signup.usernameLabel")}
        optional={needsUsername ? undefined : tk("optional")}
        required={needsUsername}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        leading="@"
        hint={usernameHint}
        error={usernameError}
        value={v.username}
        onChange={(e) => setV({ ...v, username: e.target.value })}
      />
      <PasswordField
        id="password"
        name="password"
        label={t("signup.passwordLabel")}
        optional={tk("optional")}
        hint={t("signup.passwordHint")}
        error={v.password && v.password.length < 8 ? t("signup.passwordHint") : undefined}
        autoComplete="new-password"
        minLength={8}
        maxLength={128}
        showLabel={t("show")}
        hideLabel={t("hide")}
        value={v.password}
        onChange={(e) => setV({ ...v, password: e.target.value })}
      />
      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" size="lg" onClick={onBack} icon={<ArrowLeft size={18} aria-hidden />}>
          {t("back")}
        </Button>
        <Button size="lg" className="flex-1" busy={busy} iconEnd={finalStep ? undefined : <ArrowRight size={18} aria-hidden />} data-testid="signup-about-next">
          {finalStep ? t("signup.create") : t("continue")}
        </Button>
      </div>
    </form>
  );
}

type UsernameCheck = { state: "empty" | "invalid" | "checking" | "free" | "taken" | "error"; username?: string };

/** Debounced GET /auth/username-available (400 ms after the last key). */
function useUsernameCheck(raw: string): UsernameCheck {
  const [result, setResult] = useState<{ for: string; taken: boolean } | { for: string; error: true } | null>(null);
  const username = normalizeUsername(raw);
  const trimmed = raw.trim();

  useEffect(() => {
    if (!username) return;
    const id = window.setTimeout(() => {
      void api()
        .GET("/auth/username-available", { params: { query: { username } } })
        .then(({ data }) => setResult(data ? { for: username, taken: !data.available } : { for: username, error: true }))
        .catch(() => setResult({ for: username, error: true }));
    }, 400);
    return () => window.clearTimeout(id);
  }, [username]);

  if (!trimmed) return { state: "empty" };
  if (!username) return { state: "invalid" };
  if (!result || result.for !== username) return { state: "checking", username };
  if ("error" in result) return { state: "error", username };
  return { state: result.taken ? "taken" : "free", username };
}

/** "By continuing you agree to …" with the two links. */
function Legal({ termsHref, privacyHref }: { termsHref: string; privacyHref: string }) {
  const t = useTranslations("auth");
  return (
    <p className="text-xs text-muted">
        {t.rich("legal", {
          terms: (c) => (
            <Link href={termsHref} className="font-semibold text-ink underline underline-offset-2">
              {c}
            </Link>
          ),
          privacy: (c) => (
            <Link href={privacyHref} className="font-semibold text-ink underline underline-offset-2">
              {c}
            </Link>
          ),
        })}
    </p>
  );
}

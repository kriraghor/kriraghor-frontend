"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Camera, DeviceMobile, Envelope, GoogleLogo, Key, Monitor, SignOut, UserCircle } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { Link, usePathname, useRouter } from "@kriraghor/ui/i18n/navigation";
import { GoogleButton } from "@kriraghor/ui/auth/google-button";
import { SignedOutCard, useMe, type Me } from "@kriraghor/ui/account";
import { Badge, Button, ButtonLink, Card, Dialog, ErrorState, Field, Notice, OtpInput, PageTitle, PasswordField, SegmentedControl, Skeleton, SkeletonList, useToast } from "@kriraghor/ui/kit";
import {
  canUnlinkGoogle,
  changePassword,
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  displayNameOk,
  emailLooksValid,
  endSession,
  errorKey,
  linkGoogle,
  listSessions,
  maskPhone,
  PASSWORD_MAX,
  PASSWORD_MIN,
  passwordProblem,
  sendEmailCode,
  sortSessions,
  unlinkGoogle,
  updateProfile,
  verifyEmailCode,
} from "@/lib/account";
import { AvatarControl } from "./AvatarControl";

/** A problem from the API in plain words: our own message for known codes, else the server's title. */
function useProblemText() {
  const t = useTranslations("accountSettings.errors");
  const te = useTranslations("errors");
  return (err: unknown): string | undefined => {
    if (!err) return undefined;
    const p = problemOf(err);
    const key = errorKey(p?.code);
    return key ? t(key) : (p?.title ?? te("generic"));
  };
}

/**
 * /account/settings (M01): the member's name and language, how they sign in (phone, email with a
 * code, Google, password) and the devices that are signed in. The backend links "account suspended"
 * notices to /account, which lands here.
 */
export function AccountSettings() {
  const t = useTranslations("accountSettings");
  const { status, me } = useMe();

  if (status === "signed_out") return <SignedOutCard signInHref="/sign-in?next=/account/settings" />;
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 md:px-0 md:py-8" data-testid="account-settings">
      <PageTitle title={t("title")} description={t("lead")} />
      {me.isError ? (
        <ErrorState onRetry={() => void me.refetch()} />
      ) : !me.data ? (
        <div className="flex flex-col gap-4" role="status" aria-label={t("loading")}>
          <Skeleton className="h-56 rounded-card" />
          <Skeleton className="h-72 rounded-card" />
        </div>
      ) : (
        <>
          {me.data.status !== "active" ? (
            <Notice tone="warning" title={t(`accountStatus.${me.data.status}`)} action={<ButtonLink href="/help" variant="secondary" size="sm">{t("getHelp")}</ButtonLink>}>
              {t("accountStatusBody")}
            </Notice>
          ) : null}
          <PhotoCard me={me.data} />
          <ProfileCard me={me.data} />
          <SignInCard me={me.data} />
          <DevicesCard />
        </>
      )}
    </section>
  );
}

function Section({ icon, title, lead, children, testId }: { icon: ReactNode; title: string; lead?: string; children: ReactNode; testId?: string }) {
  return (
    <Card className="flex flex-col gap-4" data-testid={testId}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-text" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-bold">{title}</h2>
          {lead ? <p className="mt-0.5 text-sm text-muted">{lead}</p> : null}
        </div>
      </div>
      {children}
    </Card>
  );
}

/** One sign-in method: what it is, its state, and its action. */
function Row({ icon, label, value, badge, action, children, testId }: { icon: ReactNode; label: string; value?: ReactNode; badge?: ReactNode; action?: ReactNode; children?: ReactNode; testId?: string }) {
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4 first:border-t-0 first:pt-0" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-muted" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{label}</p>
          {value ? <p className="break-words text-sm text-muted">{value}</p> : null}
        </div>
        {badge}
        {action}
      </div>
      {children}
    </div>
  );
}

// ---------------- photo (M01 avatar, Round B1)

function PhotoCard({ me }: { me: Me }) {
  const t = useTranslations("accountSettings.photo");
  return (
    <div id="photo" className="scroll-mt-24">
      <Section icon={<Camera size={22} />} title={t("title")} lead={t("lead")} testId="settings-photo">
        <AvatarControl me={me} />
      </Section>
    </div>
  );
}

// ---------------- profile

function ProfileCard({ me }: { me: Me }) {
  const t = useTranslations("accountSettings.profile");
  const toast = useToast();
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const siteLocale = useLocale();
  const problemText = useProblemText();
  const [name, setName] = useState(me.displayName);
  const [lang, setLang] = useState<"en" | "bn">(me.locale);
  const save = useMutation({
    mutationFn: () => updateProfile({ displayName: name.trim(), locale: lang }),
    onSuccess: (next) => {
      qc.setQueryData(["me"], next);
      toast.show(t("saved"));
      // The account language is also the site's language from now on.
      if (next.locale !== siteLocale) router.replace(pathname, { locale: next.locale });
    },
  });
  const nameOk = displayNameOk(name);
  const changed = name.trim() !== me.displayName || lang !== me.locale;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (nameOk && changed) save.mutate();
  };

  return (
    <Section icon={<UserCircle size={22} />} title={t("title")} testId="settings-profile">
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Field
          id="display-name"
          label={t("name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={DISPLAY_NAME_MAX}
          autoComplete="name"
          hint={t("nameHint")}
          error={!nameOk && name !== me.displayName ? t("nameLength", { min: DISPLAY_NAME_MIN, max: DISPLAY_NAME_MAX }) : undefined}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold" aria-hidden>
            {t("language")}
          </span>
          <SegmentedControl
            label={t("language")}
            value={lang}
            onChange={setLang}
            options={[
              { value: "en", label: "English", testId: "lang-en" },
              { value: "bn", label: "বাংলা", testId: "lang-bn" },
            ]}
            className="self-start"
          />
          <p className="text-sm text-muted">{t("languageHint")}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("username")}</span>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-base" data-testid="settings-username">
              {me.username ? `@${me.username}` : t("noUsername")}
            </span>
            <Link href="/me/player" className="text-sm font-semibold text-brand-text underline-offset-4 hover:underline">
              {me.username ? t("editUsername") : t("addUsername")}
            </Link>
          </div>
        </div>
        {save.error ? <Notice tone="error">{problemText(save.error)}</Notice> : null}
        <div>
          <Button type="submit" busy={save.isPending} disabled={!nameOk || !changed} data-testid="save-profile">
            {t("save")}
          </Button>
        </div>
      </form>
    </Section>
  );
}

// ---------------- sign-in methods

function SignInCard({ me }: { me: Me }) {
  const t = useTranslations("accountSettings.signIn");
  return (
    <Section icon={<Key size={22} />} title={t("title")} lead={t("lead")} testId="settings-sign-in">
      <div className="flex flex-col gap-4">
        <Row
          icon={<DeviceMobile size={22} />}
          label={t("phone")}
          value={me.phone ? maskPhone(me.phone) : t("noPhone")}
          badge={me.phone ? <Badge tone={me.phoneVerified ? "brand" : "warning"}>{me.phoneVerified ? t("verified") : t("notVerified")}</Badge> : null}
          action={
            me.phone && me.phoneVerified ? null : (
              <ButtonLink href="/me/eligibility" variant="secondary" size="sm" data-testid="settings-phone">
                {me.phone ? t("verifyPhone") : t("addPhone")}
              </ButtonLink>
            )
          }
          testId="method-phone"
        />
        <EmailRow me={me} />
        <GoogleRow me={me} />
        <PasswordRow me={me} />
      </div>
    </Section>
  );
}

function EmailRow({ me }: { me: Me }) {
  const t = useTranslations("accountSettings.email");
  const ts = useTranslations("accountSettings.signIn");
  const toast = useToast();
  const qc = useQueryClient();
  const problemText = useProblemText();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [wait, setWait] = useState(0);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  const send = useMutation({
    mutationFn: (to: string) => sendEmailCode(to),
    onSuccess: (r, to) => {
      setSentTo(to);
      setCode("");
      setWait(r.resendInSeconds);
    },
  });
  const verify = useMutation({
    mutationFn: () => verifyEmailCode(sentTo ?? "", code),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      toast.show(t("done"));
      reset();
    },
  });
  const reset = () => {
    setOpen(false);
    setEmail("");
    setSentTo(null);
    setCode("");
    send.reset();
    verify.reset();
  };
  const valid = emailLooksValid(email);

  return (
    <Row
      icon={<Envelope size={22} />}
      label={ts("email")}
      value={me.email ?? t("none")}
      badge={me.email ? <Badge tone={me.emailVerified ? "brand" : "warning"}>{me.emailVerified ? ts("verified") : ts("notVerified")}</Badge> : null}
      action={
        open ? null : (
          <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)} data-testid="email-change">
            {me.email ? (me.emailVerified ? t("change") : t("verify")) : t("add")}
          </Button>
        )
      }
      testId="method-email"
    >
      {open && !sentTo ? (
        <form
          className="flex flex-col gap-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (valid) send.mutate(email.trim());
          }}
        >
          <Field
            id="new-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            label={t("label")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={160}
            hint={t("hint")}
            error={touched && !valid ? t("invalid") : send.error ? problemText(send.error) : undefined}
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" busy={send.isPending} data-testid="email-send">
              {t("send")}
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : null}
      {open && sentTo ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 6) verify.mutate();
          }}
        >
          <OtpInput id="email-code" name="code" label={t("codeLabel", { email: sentTo })} value={code} onChange={setCode} autoFocus error={verify.error ? problemText(verify.error) : send.error ? problemText(send.error) : undefined} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" busy={verify.isPending} disabled={code.length !== 6} data-testid="email-verify">
              {t("confirm")}
            </Button>
            <Button type="button" variant="secondary" disabled={wait > 0 || send.isPending} onClick={() => send.mutate(sentTo)}>
              {wait > 0 ? t("resendIn", { seconds: wait }) : t("resend")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSentTo(null);
                verify.reset();
              }}
            >
              {t("otherEmail")}
            </Button>
          </div>
        </form>
      ) : null}
    </Row>
  );
}

function GoogleRow({ me }: { me: Me }) {
  const t = useTranslations("accountSettings.google");
  const ts = useTranslations("accountSettings.signIn");
  const toast = useToast();
  const qc = useQueryClient();
  const problemText = useProblemText();
  const [confirm, setConfirm] = useState(false);
  const google = me.identities.find((i) => i.provider === "google");
  const refresh = () => qc.invalidateQueries({ queryKey: ["me"] });
  const link = useMutation({
    mutationFn: (idToken: string) => linkGoogle(idToken),
    onSuccess: async () => {
      await refresh();
      toast.show(t("linked"));
    },
  });
  const unlink = useMutation({
    mutationFn: unlinkGoogle,
    onSuccess: async () => {
      setConfirm(false);
      await refresh();
      toast.show(t("unlinked"));
    },
  });
  const canUnlink = canUnlinkGoogle(me);

  return (
    <Row
      icon={<GoogleLogo size={22} />}
      label={ts("google")}
      value={google ? (google.email ?? t("connected")) : t("notConnected")}
      badge={google ? <Badge tone="brand">{t("connected")}</Badge> : null}
      action={
        google ? (
          <Dialog
            open={confirm}
            onOpenChange={(o) => {
              setConfirm(o);
              if (!o) unlink.reset();
            }}
            trigger={
              <Button type="button" variant="secondary" size="sm" data-testid="google-unlink">
                {t("unlink")}
              </Button>
            }
            title={t("unlinkTitle")}
            description={canUnlink ? t("unlinkBody") : t("lastMethod")}
            footer={
              <>
                <Button type="button" variant="ghost" onClick={() => setConfirm(false)}>
                  {t("keep")}
                </Button>
                <Button type="button" variant="danger" busy={unlink.isPending} disabled={!canUnlink} onClick={() => unlink.mutate()} data-testid="google-unlink-confirm">
                  {t("unlink")}
                </Button>
              </>
            }
          >
            {unlink.error ? <Notice tone="error">{problemText(unlink.error)}</Notice> : null}
          </Dialog>
        ) : null
      }
      testId="method-google"
    >
      {!google ? (
        <div className="flex flex-col gap-2">
          <div className="max-w-sm">
            <GoogleButton onCredential={(token) => link.mutate(token)} text="continue_with" />
          </div>
          <p className="text-sm text-muted">{t("hint")}</p>
          {link.isPending ? <p className="text-sm text-muted" role="status">{t("linking")}</p> : null}
          {link.error ? <Notice tone="error">{problemText(link.error)}</Notice> : null}
        </div>
      ) : null}
      {google && !canUnlink ? <p className="text-sm text-muted">{t("lastMethod")}</p> : null}
    </Row>
  );
}

function PasswordRow({ me }: { me: Me }) {
  const t = useTranslations("accountSettings.password");
  const ts = useTranslations("accountSettings.signIn");
  const toast = useToast();
  const qc = useQueryClient();
  const problemText = useProblemText();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const local = passwordProblem({ hasPassword: me.hasPassword, current, next, confirm });
  const close = () => {
    setOpen(false);
    setCurrent("");
    setNext("");
    setConfirm("");
    setTouched(false);
    save.reset();
  };
  const save = useMutation({
    mutationFn: () => changePassword({ currentPassword: me.hasPassword ? current : undefined, newPassword: next }),
    onSuccess: async () => {
      close();
      await Promise.all([qc.invalidateQueries({ queryKey: ["me"] }), qc.invalidateQueries({ queryKey: ["my-sessions"] })]);
      toast.show(me.hasPassword ? t("changed") : t("set"));
    },
  });
  const serverCode = problemOf(save.error)?.code;
  const serverText = problemText(save.error);
  const localText = touched && local ? t(`problems.${local}`, { min: PASSWORD_MIN, max: PASSWORD_MAX }) : undefined;

  return (
    <Row
      icon={<Key size={22} />}
      label={ts("password")}
      value={me.hasPassword ? t("isSet") : t("notSet")}
      action={
        open ? null : (
          <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)} data-testid="password-open">
            {me.hasPassword ? t("change") : t("setAction")}
          </Button>
        )
      }
      testId="method-password"
    >
      {open ? (
        <form
          className="flex flex-col gap-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (!local) save.mutate();
          }}
        >
          <Notice tone="info">{t("signsOut")}</Notice>
          {me.hasPassword ? (
            <PasswordField
              id="current-password"
              autoComplete="current-password"
              label={t("current")}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              showLabel={t("show")}
              hideLabel={t("hide")}
              error={serverCode === "PASSWORD_INCORRECT" ? serverText : touched && local === "currentRequired" ? localText : undefined}
            />
          ) : null}
          <PasswordField
            id="new-password"
            autoComplete="new-password"
            label={t("new")}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            maxLength={PASSWORD_MAX}
            hint={t("hint", { min: PASSWORD_MIN })}
            showLabel={t("show")}
            hideLabel={t("hide")}
            error={serverCode === "PASSWORD_WEAK" || serverCode === "PASSWORD_BREACHED" ? serverText : local === "tooShort" || local === "tooLong" ? localText : undefined}
          />
          <PasswordField
            id="confirm-password"
            autoComplete="new-password"
            label={t("confirm")}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            maxLength={PASSWORD_MAX}
            showLabel={t("show")}
            hideLabel={t("hide")}
            error={local === "mismatch" ? localText : undefined}
          />
          {save.error && !["PASSWORD_INCORRECT", "PASSWORD_WEAK", "PASSWORD_BREACHED"].includes(serverCode ?? "") ? <Notice tone="error">{serverText}</Notice> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" busy={save.isPending} data-testid="password-save">
              {me.hasPassword ? t("change") : t("setAction")}
            </Button>
            <Button type="button" variant="ghost" onClick={close}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : null}
    </Row>
  );
}

// ---------------- devices

function DevicesCard() {
  const t = useTranslations("accountSettings.devices");
  const locale = useLocale();
  const toast = useToast();
  const qc = useQueryClient();
  const problemText = useProblemText();
  const q = useQuery({ queryKey: ["my-sessions"], queryFn: listSessions });
  const end = useMutation({
    mutationFn: (id: string) => endSession(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-sessions"] });
      toast.show(t("ended"));
    },
  });
  const when = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });

  return (
    <Section icon={<Monitor size={22} />} title={t("title")} lead={t("lead")} testId="settings-devices">
      {q.isPending ? (
        <SkeletonList rows={2} label={t("loading")} />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : (
        <ul className="flex flex-col gap-3" data-testid="session-list">
          {sortSessions(q.data).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 border-t border-line pt-3 first:border-t-0 first:pt-0" data-testid="session">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  <span className="break-words">{s.device ?? t("unknown")}</span>
                  {s.current ? <Badge tone="brand">{t("thisDevice")}</Badge> : null}
                </p>
                <p className="text-sm text-muted">
                  {t("lastSeen", { when: when.format(new Date(s.lastSeenAt)) })}
                  {s.ip ? ` · ${s.ip}` : ""}
                </p>
              </div>
              {s.current ? null : (
                <Button type="button" variant="secondary" size="sm" icon={<SignOut size={16} aria-hidden />} busy={end.isPending && end.variables === s.id} onClick={() => end.mutate(s.id)} aria-label={t("signOutNamed", { device: s.device ?? t("unknown") })}>
                  {t("signOut")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {end.error ? <Notice tone="error">{problemText(end.error)}</Notice> : null}
      <p className="text-sm text-muted">{t("note")}</p>
    </Section>
  );
}

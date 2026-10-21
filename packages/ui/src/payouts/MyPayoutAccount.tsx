"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Wallet as WalletIcon } from "@phosphor-icons/react";
import { problemOf, type Problem } from "@kriraghor/api-client";
import { useAuth } from "../auth";
import { Link } from "../i18n/navigation";
import { cn } from "../cn";
import { Button, ButtonLink } from "../kit/Button";
import { Badge, Card, EmptyState, Notice, PageTitle, Skeleton, type Tone } from "../kit/Display";
import { Checkbox, Field } from "../kit/Form";
import { Dialog } from "../kit/Overlay";
import { SegmentedControl } from "../kit/Tabs";
import { addAccount, isWalletNumber, listAccounts, sendAccountCode, type PayoutAccount, type Wallet } from "./client";

const STATUS_TONE: Record<PayoutAccount["status"], Tone> = { active: "brand", pending_verification: "info", rejected: "danger", superseded: "neutral", disabled: "neutral" };

export type MyPayoutAccountProps = {
  /** Where "Sign in" goes (with the way back), e.g. "/sign-in?next=/me/payout-account". */
  signInHref: string;
  /** My payouts in this app ("/me/payouts", "/vendor/payouts"). */
  payoutsHref: string;
  className?: string;
};

/**
 * My payout account (M07 §4.1), on kriraghor.com/me/payout-account and
 * vendor.kriraghor.com/vendor/payout-account: where Kriraghor sends my money. bKash or Nagad in my
 * NID name, confirmed with a code to my registered phone, then checked by the Kriraghor team.
 * Changing it pauses payouts for 48 hours, so a stolen login cannot redirect money quietly.
 */
export function MyPayoutAccount({ signInHref, payoutsHref, className }: MyPayoutAccountProps) {
  const t = useTranslations("payoutsMe");
  const locale = useLocale();
  const qc = useQueryClient();
  const { status } = useAuth();
  const q = useQuery({ queryKey: ["my-payout-accounts"], enabled: status === "signed_in", queryFn: listAccounts });
  const [editing, setEditing] = useState(false);
  const date = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });

  const items = q.data?.items ?? [];
  const active = items.find((a) => a.status === "active");
  const latest = items[0];

  return (
    <section className={cn("mx-auto max-w-xl px-5 pb-16 pt-8", className)}>
      <PageTitle title={t("accountTitle")} description={t("accountIntro")} />
      {status === "signed_out" ? (
        <Notice className="mt-6">
          {t("signedOut")}{" "}
          <Link href={signInHref} className="font-semibold underline">
            {t("signIn")}
          </Link>
        </Notice>
      ) : q.isPending ? (
        <div className="mt-6" role="status" aria-label={t("loading")}>
          <Skeleton className="h-28 rounded-card" />
        </div>
      ) : q.isError ? (
        <Notice tone="error" className="mt-6">
          {t("loadFailed")}
        </Notice>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {active ? (
            <Card data-testid="payout-account">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xl font-semibold">{active.masked}</span>
                <Badge tone={STATUS_TONE.active}>{t("accountStatus.active")}</Badge>
              </div>
              <p className="mt-1">{active.accountName}</p>
              {active.holdUntil && new Date(active.holdUntil) > new Date() ? <Notice className="mt-3">{t("holdBanner", { when: date.format(new Date(active.holdUntil)) })}</Notice> : null}
            </Card>
          ) : !latest ? (
            <EmptyState icon={<WalletIcon aria-hidden />} title={t("noAccount")} body={t("accountIntro")} />
          ) : null}
          {latest && latest.status !== "active" ? (
            <Card padded={false} className="p-4" data-testid="payout-account-latest">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono font-semibold">{latest.masked}</span>
                <Badge tone={STATUS_TONE[latest.status] ?? "neutral"}>{t(`accountStatus.${latest.status}`)}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted">{latest.status === "rejected" ? t("rejectedNote", { note: latest.reviewNote ?? "–" }) : t("pendingNote")}</p>
            </Card>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant={active || latest ? "secondary" : "primary"} icon={<WalletIcon size={18} aria-hidden />} onClick={() => setEditing(true)} data-testid="change-payout-account">
              {active || latest ? t("change") : t("add")}
            </Button>
            <ButtonLink href={payoutsHref} variant="link" iconEnd={<ArrowRight size={16} aria-hidden />}>
              {t("seePayouts")}
            </ButtonLink>
          </div>
          <AddDialog
            open={editing}
            onOpenChange={setEditing}
            onDone={async () => {
              setEditing(false);
              await qc.invalidateQueries({ queryKey: ["my-payout-accounts"] });
              await qc.invalidateQueries({ queryKey: ["my-payout-summary"] });
            }}
          />
        </div>
      )}
    </section>
  );
}

/** The add / change form in a dialog: wallet, number, name, declaration, then the SMS code. */
function AddDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => Promise<void> }) {
  const t = useTranslations("payoutsMe");
  const [type, setType] = useState<Wallet>("bkash");
  const [accountNo, setAccountNo] = useState("");
  const [accountName, setAccountName] = useState("");
  const [declared, setDeclared] = useState(false);
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const numberOk = isWalletNumber(accountNo);
  const reset = () => {
    setAccountNo("");
    setAccountName("");
    setDeclared(false);
    setCode("");
    setCodeSent(false);
    setProblem(null);
  };

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setProblem(null);
    try {
      await fn();
    } catch (err) {
      setProblem(problemOf(err) ?? { code: "UNKNOWN", title: t("failed"), status: 0 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      title={t("accountTitle")}
      description={t("accountIntro")}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="payout-account-form" busy={busy} disabled={!numberOk || !declared || (codeSent && code.length !== 6)} data-testid="payout-account-submit">
            {codeSent ? t("save") : t("sendCode")}
          </Button>
        </>
      }
    >
      <form
        id="payout-account-form"
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!codeSent)
            void run(async () => {
              await sendAccountCode();
              setCodeSent(true);
            });
          else
            void run(async () => {
              await addAccount({ type, accountNo, accountName: accountName.trim(), code });
              reset();
              await onDone();
            });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("wallet")}</span>
          {codeSent ? (
            <p className="font-semibold">{type === "bkash" ? "bKash" : "Nagad"}</p>
          ) : (
            <SegmentedControl<Wallet>
              label={t("wallet")}
              value={type}
              onChange={setType}
              options={[
                { value: "bkash", label: "bKash", testId: "wallet-bkash" },
                { value: "nagad", label: "Nagad", testId: "wallet-nagad" },
              ]}
            />
          )}
        </div>
        <Field
          id="payout-wallet-number"
          label={t("number")}
          value={accountNo}
          onChange={(e) => setAccountNo(e.target.value)}
          inputMode="tel"
          autoComplete="off"
          placeholder="01712345678"
          inputClassName="font-mono text-lg"
          error={accountNo.length > 0 && !numberOk ? t("numberInvalid") : undefined}
          hint={t("numberHelp")}
          disabled={codeSent}
          required
        />
        <Field
          id="payout-wallet-name"
          label={t("name")}
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          autoComplete="name"
          minLength={3}
          maxLength={120}
          hint={t("nameHelp")}
          disabled={codeSent}
          required
        />
        <Checkbox id="payout-declaration" label={t("declaration")} checked={declared} onChange={(e) => setDeclared(e.target.checked)} required disabled={codeSent} />
        {codeSent ? (
          <Field
            id="payout-code"
            label={t("code")}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            inputClassName="max-w-40 font-mono text-lg tracking-widest"
            hint={t("codeHelp")}
            autoFocus
            required
          />
        ) : null}
        {problem ? <Notice tone="error">{problem.title}</Notice> : null}
      </form>
    </Dialog>
  );
}

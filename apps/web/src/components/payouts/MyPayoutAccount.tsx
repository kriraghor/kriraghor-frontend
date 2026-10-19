"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { problemOf, type Problem } from "@kriraghor/api-client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { addAccount, isWalletNumber, listAccounts, sendAccountCode, type Wallet } from "@/lib/payouts";
import { Button, Notice } from "../ui";

const STATUS_CLS = { active: "border-brand text-brand", pending_verification: "border-line text-ink", rejected: "border-danger text-danger" } as const;

/**
 * /me/payout-account (M07 §4.1): where Kriraghor sends my money. bKash or Nagad in my NID name,
 * confirmed with a code to my registered phone, then checked by the Kriraghor team. Changing it
 * pauses payouts for 48 hours, so a stolen login cannot redirect money quietly.
 */
export function MyPayoutAccount() {
  const t = useTranslations("payouts");
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
    <section className="mx-auto max-w-xl px-5 pb-16 pt-8">
      <h1 className="text-3xl font-extrabold">{t("accountTitle")}</h1>
      <p className="mt-2 text-muted">{t("accountIntro")}</p>
      {status === "signed_out" ? (
        <div className="mt-6">
          <Notice>
            {t("signedOut")}{" "}
            <Link href="/sign-in?next=/me/payout-account" className="underline">
              {t("signIn")}
            </Link>
          </Notice>
        </div>
      ) : q.isPending ? (
        <div className="mt-6 h-28 animate-pulse bg-surface-2" role="status" aria-label={t("loading")} />
      ) : q.isError ? (
        <div className="mt-6">
          <Notice tone="error">{t("loadFailed")}</Notice>
        </div>
      ) : (
        <>
          {active ? (
            <div className="mt-6 glass-card p-5" data-testid="payout-account">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xl font-bold">{active.masked}</span>
                <span className={`border-2 px-2 py-0.5 text-xs font-bold ${STATUS_CLS.active}`}>{t("accountStatus.active")}</span>
              </div>
              <p className="mt-1">{active.accountName}</p>
              {active.holdUntil && new Date(active.holdUntil) > new Date() ? (
                <div className="mt-3">
                  <Notice>{t("holdBanner", { when: date.format(new Date(active.holdUntil)) })}</Notice>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-6 text-muted">{t("noAccount")}</p>
          )}
          {latest && latest.status !== "active" ? (
            <div className="mt-4 border-2 border-line p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono font-bold">{latest.masked}</span>
                <span className={`border-2 px-2 py-0.5 text-xs font-bold ${STATUS_CLS[latest.status as keyof typeof STATUS_CLS] ?? ""}`}>{t(`accountStatus.${latest.status}`)}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{latest.status === "rejected" ? t("rejectedNote", { note: latest.reviewNote ?? "–" }) : t("pendingNote")}</p>
            </div>
          ) : null}
          {editing ? (
            <AddForm
              onCancel={() => setEditing(false)}
              onDone={async () => {
                setEditing(false);
                await qc.invalidateQueries({ queryKey: ["my-payout-accounts"] });
              }}
            />
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="mt-6 min-h-12 border-2 border-ink px-5 font-bold" data-testid="change-payout-account">
              {active || latest ? t("change") : t("add")}
            </button>
          )}
          <Link href="/me/payouts" className="mt-6 block min-h-11 font-semibold underline">
            {t("seePayouts")}
          </Link>
        </>
      )}
    </section>
  );
}

function AddForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => Promise<void> }) {
  const t = useTranslations("payouts");
  const [type, setType] = useState<Wallet>("bkash");
  const [accountNo, setAccountNo] = useState("");
  const [accountName, setAccountName] = useState("");
  const [declared, setDeclared] = useState(false);
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const numberOk = isWalletNumber(accountNo);

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
    <form
      className="mt-6 space-y-4 border-2 border-line-strong p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!codeSent) void run(async () => { await sendAccountCode(); setCodeSent(true); });
        else void run(async () => { await addAccount({ type, accountNo, accountName: accountName.trim(), code }); await onDone(); });
      }}
    >
      <fieldset>
        <legend className="text-sm font-semibold text-muted">{t("wallet")}</legend>
        <div className="mt-2 flex gap-3">
          {(["bkash", "nagad"] as const).map((w) => (
            <label key={w} className={`flex min-h-12 cursor-pointer items-center gap-2 border-2 px-4 font-bold ${type === w ? "border-brand" : "border-line"}`}>
              <input type="radio" name="wallet" value={w} checked={type === w} onChange={() => setType(w)} disabled={codeSent} />
              {w === "bkash" ? "bKash" : "Nagad"}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="text-sm font-semibold text-muted">{t("number")}</span>
        <input
          value={accountNo}
          onChange={(e) => setAccountNo(e.target.value)}
          inputMode="tel"
          autoComplete="off"
          placeholder="01712345678"
          aria-invalid={accountNo.length > 0 && !numberOk}
          aria-describedby="wallet-help"
          disabled={codeSent}
          className="mt-1 min-h-12 w-full field px-3 font-mono text-lg"
          required
        />
        <span id="wallet-help" className={`text-xs ${accountNo.length > 0 && !numberOk ? "text-danger" : "text-muted"}`}>
          {accountNo.length > 0 && !numberOk ? t("numberInvalid") : t("numberHelp")}
        </span>
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-muted">{t("name")}</span>
        <input value={accountName} onChange={(e) => setAccountName(e.target.value)} autoComplete="name" minLength={3} maxLength={120} disabled={codeSent} className="mt-1 min-h-12 w-full field px-3 text-base" required />
        <span className="text-xs text-muted">{t("nameHelp")}</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} className="mt-1 h-5 w-5" required disabled={codeSent} />
        <span>{t("declaration")}</span>
      </label>
      {codeSent ? (
        <label className="block">
          <span className="text-sm font-semibold text-muted">{t("code")}</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="mt-1 min-h-12 w-40 field px-3 font-mono text-lg tracking-widest"
            required
          />
          <span className="block text-xs text-muted">{t("codeHelp")}</span>
        </label>
      ) : null}
      {problem ? <Notice tone="error">{problem.title}</Notice> : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" busy={busy} disabled={!numberOk || !declared || (codeSent && code.length !== 6)}>
          {codeSent ? t("save") : t("sendCode")}
        </Button>
        <button type="button" onClick={onCancel} className="min-h-12 border-2 border-line px-5 font-semibold" disabled={busy}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { problemOf } from "@/lib/api/client";
import { countdown, formatTaka, getPayment, outcomeOf, startAttempt, type Method } from "@/lib/payments";
import { Button, Notice } from "../ui";

const METHODS: Method[] = ["bkash", "nagad", "card"];

/** Ticks once a second (for the expiry countdown) without reading the clock during render. */
function useNow(active: boolean) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [active]);
  return now;
}

/** /pay/[paymentId] (M06 §4): method picker, amount, what it is for, time left, hand-off to the gateway. */
export function PayPage({ paymentId }: { paymentId: string }) {
  const t = useTranslations("payments");
  const locale = useLocale();
  const { status } = useAuth();
  const [method, setMethod] = useState<Method>("bkash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["payment", paymentId], enabled: status === "signed_in", queryFn: () => getPayment(paymentId), retry: false });
  const open = q.data ? outcomeOf(q.data.status) === "waiting" || q.data.status === "failed" : false;
  const now = useNow(open);

  if (status === "signed_out") {
    return (
      <Shell>
        <Notice>
          {t("signedOut")}{" "}
          <Link href={`/sign-in?next=/pay/${paymentId}`} className="underline">
            {t("signIn")}
          </Link>
        </Notice>
      </Shell>
    );
  }
  if (status === "loading" || q.isPending) {
    return (
      <Shell>
        <div className="h-40 animate-pulse bg-surface-2" role="status" aria-label={t("loading")} />
      </Shell>
    );
  }
  if (q.isError || !q.data) {
    return (
      <Shell>
        <Notice tone="error">{t("notFound")}</Notice>
        <Link href="/me/payments" className="mt-4 inline-block font-semibold underline">
          {t("myPayments")}
        </Link>
      </Shell>
    );
  }

  const p = q.data;
  const outcome = outcomeOf(p.status);
  const left = now === null ? null : countdown(p.expiresAt, now);
  const expired = now !== null && new Date(p.expiresAt).getTime() <= now;

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const a = await startAttempt(paymentId, method, crypto.randomUUID());
      window.location.assign(a.redirectUrl);
    } catch (e) {
      const code = problemOf(e)?.code;
      setError(code === "PAYMENT_EXPIRED" ? t("expired") : code === "PAYMENT_ALREADY_SUCCEEDED" ? t("alreadyPaid") : t("gatewayDown"));
      setBusy(false);
    }
  }

  return (
    <Shell>
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">{t("payFor")}</p>
      <h1 className="mt-1 text-2xl font-extrabold">{p.title}</h1>
      <p className="mt-4 text-5xl font-extrabold tabular-nums" data-testid="pay-amount">
        {formatTaka(p.amount, locale)}
      </p>
      <p className="mt-1 font-mono text-sm text-muted">{p.code}</p>

      {outcome === "paid" ? (
        <div className="mt-8">
          <Notice>{t("alreadyPaid")}</Notice>
          <Link href={`/pay/${paymentId}/result`} className="mt-4 inline-block font-semibold underline">
            {t("seeReceipt")}
          </Link>
        </div>
      ) : outcome === "expired" || expired ? (
        <div className="mt-8">
          <Notice tone="error">{t("expired")}</Notice>
        </div>
      ) : (
        <form
          className="mt-8"
          onSubmit={(e) => {
            e.preventDefault();
            void pay();
          }}
        >
          <fieldset>
            <legend className="text-sm font-semibold text-muted">{t("chooseMethod")}</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {METHODS.map((m) => (
                <label key={m} className={`flex min-h-14 cursor-pointer items-center gap-3 border-2 px-4 font-bold ${method === m ? "border-brand bg-surface-2" : "border-line"}`}>
                  <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="size-5 accent-brand" />
                  {t(`methods.${m}`)}
                </label>
              ))}
            </div>
          </fieldset>
          {p.status === "failed" ? (
            <div className="mt-4">
              <Notice tone="error">{t("lastFailed")}</Notice>
            </div>
          ) : null}
          {error ? (
            <div className="mt-4">
              <Notice tone="error">{error}</Notice>
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button type="submit" busy={busy} data-testid="pay-button">
              {t("payNow", { amount: formatTaka(p.amount, locale) })}
            </Button>
            {left ? (
              <span className="text-sm text-muted tabular-nums" aria-live="off">
                {t("timeLeft", { time: left })}
              </span>
            ) : null}
          </div>
          <p className="mt-4 text-sm text-muted">{t("gatewayNote")}</p>
        </form>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <section className="mx-auto max-w-xl px-5 pb-16 pt-10">{children}</section>;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "../auth";
import { cn } from "../cn";
import { Notice } from "../primitives";
import { formatTaka, getPayment, outcomeOf, POLL_LIMIT_MS, POLL_MS, verifyPayment, type PayBackLinkFor } from "./client";
import { PayLink as Link, PayShell as Shell } from "./PayLink";

export type PayResultProps = {
  paymentId: string;
  /** Where "Sign in" goes, with the way back (e.g. "/sign-in?next=/pay/<id>/result"). */
  signInHref: string;
  /** The site's next step for this payment's purpose (back to the booking, the pass...); null for none. */
  backLink?: PayBackLinkFor;
  /** "My payments" at the bottom (kriraghor.com's /me/payments, or /go/web/me/payments elsewhere); null or left out hides it. */
  paymentsHref?: string | null;
};

const TONE = { brand: "bg-brand text-on-brand", amber: "bg-accent text-on-accent" } as const;

/**
 * /pay/[paymentId]/result (M06 §4), on kriraghor.com and gym.kriraghor.com: asks the server to verify
 * once, then reads the status every 2 s for up to 60 s. Never trusts the redirect's query string.
 * "Still confirming" after a minute: the IPN, polling or reconciliation will settle it, and the payer
 * is notified.
 */
export function PayResult({ paymentId, signInHref, backLink, paymentsHref = null }: PayResultProps) {
  const t = useTranslations("payments");
  const locale = useLocale();
  const { status } = useAuth();
  const qc = useQueryClient();
  const [timedOut, setTimedOut] = useState(false);
  const verified = useRef(false);

  const q = useQuery({
    queryKey: ["payment", paymentId],
    enabled: status === "signed_in",
    queryFn: () => getPayment(paymentId),
    retry: false,
    refetchInterval: (query) => (!timedOut && query.state.data && outcomeOf(query.state.data.status) === "waiting" ? POLL_MS : false),
  });

  useEffect(() => {
    if (status !== "signed_in" || verified.current) return;
    verified.current = true;
    verifyPayment(paymentId)
      .then((p) => qc.setQueryData(["payment", paymentId], p))
      .catch(() => null);
    const stop = setTimeout(() => setTimedOut(true), POLL_LIMIT_MS);
    return () => clearTimeout(stop);
  }, [status, paymentId, qc]);

  if (status === "signed_out") {
    return (
      <Shell>
        <Notice>
          {t("signedOut")}{" "}
          <Link href={signInHref} className="underline">
            {t("signIn")}
          </Link>
        </Notice>
      </Shell>
    );
  }
  if (q.isError) {
    return (
      <Shell>
        <Notice tone="error">{t("notFound")}</Notice>
      </Shell>
    );
  }
  if (!q.data) {
    return (
      <Shell>
        <p className="text-lg font-semibold" role="status">
          {t("confirming")}
        </p>
      </Shell>
    );
  }

  const p = q.data;
  const outcome = outcomeOf(p.status);
  const back = backLink?.(p.purpose, p.purposeId) ?? null;
  return (
    <Shell>
      <div role="status" aria-live="polite" data-testid="pay-result" data-outcome={outcome}>
        {outcome === "paid" ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand">{t("result.paidLabel")}</p>
            <h1 className="mt-1 text-3xl font-extrabold">{t("result.paid", { amount: formatTaka(p.captured, locale) })}</h1>
            <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t-2 border-line-strong pt-4 text-sm">
              <dt className="text-muted">{t("for")}</dt>
              <dd>{p.title}</dd>
              <dt className="text-muted">{t("ref")}</dt>
              <dd className="font-mono">{p.code}</dd>
              <dt className="text-muted">{t("method")}</dt>
              <dd>{p.methodDisplay}</dd>
            </dl>
          </>
        ) : outcome === "waiting" ? (
          <>
            <h1 className="text-2xl font-extrabold">{timedOut ? t("result.slow") : t("confirming")}</h1>
            {timedOut ? <p className="mt-2 text-muted">{t("result.slowNote")}</p> : null}
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold">{outcome === "expired" ? t("expired") : t("result.failed")}</h1>
            {outcome === "failed" ? (
              <Link href={`/pay/${paymentId}`} className="mt-4 inline-flex min-h-12 items-center bg-brand px-5 font-bold text-on-brand">
                {t("tryAgain")}
              </Link>
            ) : null}
          </>
        )}
      </div>
      {back ? (
        <Link href={back.href} className={cn("mt-8 inline-flex min-h-12 items-center px-5 font-bold", TONE[back.tone ?? "brand"])} testId={back.testId}>
          {back.label}
        </Link>
      ) : null}
      {paymentsHref ? (
        <Link href={paymentsHref} className="mt-8 block font-semibold underline">
          {t("myPayments")}
        </Link>
      ) : null}
    </Shell>
  );
}

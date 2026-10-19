"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { publicEnv } from "@kriraghor/session/env";
import { formatTaka, getPayment, outcomeOf, POLL_LIMIT_MS, POLL_MS, verifyPayment } from "@/lib/payments";
import { Notice } from "../ui";

/**
 * /pay/[paymentId]/result (M06 §4): asks the server to verify once, then reads the status every 2 s for
 * up to 60 s. Never trusts the redirect's query string. "Still confirming" after a minute: the IPN,
 * polling or reconciliation will settle it, and the payer is notified.
 */
export function PayResult({ paymentId }: { paymentId: string }) {
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
          <Link href={`/sign-in?next=/pay/${paymentId}/result`} className="underline">
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
              <Link href={`/pay/${paymentId}`} className="mt-4 inline-flex min-h-12 items-center bg-brand px-5 font-bold text-white">
                {t("tryAgain")}
              </Link>
            ) : null}
          </>
        )}
      </div>
      {p.purpose === "esports_entry" ? (
        // Entry fees are paid here, then the player goes back to their matches on esports.kriraghor.com (M21).
        <a href={`${publicEnv().ESPORTS_URL}/me/matches`} className="mt-8 inline-flex min-h-12 items-center bg-amber-300 px-5 font-bold text-band" data-testid="back-to-esports">
          {t("backToEsports")}
        </a>
      ) : null}
      {p.purpose === "ground_booking" ? (
        // A ground booking (M10): back to the booking, with what is due at the venue.
        <Link href={`/me/bookings/${p.purposeId}`} className="mt-8 inline-flex min-h-12 items-center bg-brand px-5 font-bold text-white" data-testid="back-to-booking">
          {t("backToBooking")}
        </Link>
      ) : null}
      {p.purpose === "market_order" ? (
        // A shop order (M13): to my orders, where each shop's part shows its progress.
        <Link href="/me/orders" className="mt-8 inline-flex min-h-12 items-center bg-brand px-5 font-bold text-white" data-testid="back-to-order">
          {t("backToOrders")}
        </Link>
      ) : null}
      <Link href="/me/payments" className="mt-8 block font-semibold underline">
        {t("myPayments")}
      </Link>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <section className="mx-auto max-w-xl px-5 pb-16 pt-10">{children}</section>;
}

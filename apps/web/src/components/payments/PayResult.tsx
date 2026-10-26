"use client";

import { useTranslations } from "next-intl";
import { publicEnv } from "@kriraghor/session/env";
import { PayResult as SharedPayResult } from "@kriraghor/ui/payments";
import { PAYMENTS_HREF, webPayBack } from "@/lib/pay-links";

/** /pay/[paymentId]/result (M06 §4): the shared result page with kriraghor.com's next steps. */
export function PayResult({ paymentId }: { paymentId: string }) {
  const t = useTranslations("payments");
  return (
    <SharedPayResult
      paymentId={paymentId}
      signInHref={`/sign-in?next=/pay/${paymentId}/result`}
      paymentsHref={PAYMENTS_HREF}
      backLink={(purpose, purposeId) => {
        const b = webPayBack(purpose, purposeId, publicEnv().ESPORTS_URL);
        return b ? { href: b.href, label: t(b.labelKey), testId: b.testId, tone: b.tone } : null;
      }}
    />
  );
}

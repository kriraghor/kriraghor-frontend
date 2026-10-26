"use client";

import { useTranslations } from "next-intl";
import { PayResult as SharedPayResult } from "@kriraghor/ui/payments";
import { gymPayBack, PAYMENTS_HREF } from "@/lib/pay-links";

/** /pay/[paymentId]/result (M06 §4) on gym.kriraghor.com: the shared result page with the gym next steps. */
export function PayResult({ paymentId }: { paymentId: string }) {
  const t = useTranslations("payments");
  return (
    <SharedPayResult
      paymentId={paymentId}
      signInHref={`/sign-in?next=/pay/${paymentId}/result`}
      paymentsHref={PAYMENTS_HREF}
      backLink={(purpose, purposeId) => {
        const b = gymPayBack(purpose, purposeId);
        return b ? { href: b.href, label: t(b.labelKey), testId: b.testId } : null;
      }}
    />
  );
}

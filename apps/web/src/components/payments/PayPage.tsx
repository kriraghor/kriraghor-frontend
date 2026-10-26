"use client";

import { PayPage as SharedPayPage } from "@kriraghor/ui/payments";
import { PAYMENTS_HREF } from "@/lib/pay-links";

/** /pay/[paymentId] (M06 §4): the shared pay page with kriraghor.com's links. */
export function PayPage({ paymentId }: { paymentId: string }) {
  return <SharedPayPage paymentId={paymentId} signInHref={`/sign-in?next=/pay/${paymentId}`} paymentsHref={PAYMENTS_HREF} />;
}

"use client";

import { PayPage as SharedPayPage } from "@kriraghor/ui/payments";
import { PAYMENTS_HREF } from "@/lib/pay-links";

/** /pay/[paymentId] (M06 §4) on gym.kriraghor.com: the shared pay page with this site's links. */
export function PayPage({ paymentId }: { paymentId: string }) {
  return <SharedPayPage paymentId={paymentId} signInHref={`/sign-in?next=/pay/${paymentId}`} paymentsHref={PAYMENTS_HREF} />;
}

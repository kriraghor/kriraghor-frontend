import { MyPayouts as SharedPayouts } from "@kriraghor/ui/payouts";

/** /me/payouts (M07 §4.2): the shared payee view with kriraghor.com's links. */
export function MyPayouts() {
  return <SharedPayouts signInHref="/sign-in?next=/me/payouts" payoutAccountHref="/me/payout-account" />;
}

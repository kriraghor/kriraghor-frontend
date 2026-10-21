import { MyPayoutAccount as SharedPayoutAccount } from "@kriraghor/ui/payouts";

/** /me/payout-account (M07 §4.1): the shared payout account view with kriraghor.com's links. */
export function MyPayoutAccount() {
  return <SharedPayoutAccount signInHref="/sign-in?next=/me/payout-account" payoutsHref="/me/payouts" />;
}

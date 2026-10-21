import { setRequestLocale } from "next-intl/server";
import { MyPayoutAccount } from "@kriraghor/ui/payouts";

export const metadata = { title: "Payout account" };

/** /vendor/payout-account (M07 §4.1): the bKash or Nagad wallet the business is paid to. */
export default async function VendorPayoutAccountPage({ params }: PageProps<"/[locale]/vendor/payout-account">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MyPayoutAccount signInHref="/vendor/sign-in" payoutsHref="/vendor/payouts" className="py-8" />;
}

import { setRequestLocale } from "next-intl/server";
import { MyPayouts } from "@kriraghor/ui/payouts";

export const metadata = { title: "Payouts" };

/** /vendor/payouts (M07 §4.2): what Kriraghor has sent and will send to this business (the customer session). */
export default async function VendorPayoutsPage({ params }: PageProps<"/[locale]/vendor/payouts">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MyPayouts signInHref="/vendor/sign-in" payoutAccountHref="/vendor/payout-account" className="max-w-[1100px] py-8" />;
}

import { setRequestLocale } from "next-intl/server";
import { MyPayoutAccount } from "@/components/payouts/MyPayoutAccount";

export const metadata = { title: "Payout account" };

export default async function MyPayoutAccountPage({ params }: PageProps<"/[locale]/me/payout-account">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MyPayoutAccount />;
}

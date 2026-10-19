import { setRequestLocale } from "next-intl/server";
import { MyPayouts } from "@/components/payouts/MyPayouts";

export const metadata = { title: "My payouts" };

export default async function MyPayoutsPage({ params }: PageProps<"/[locale]/me/payouts">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MyPayouts />;
}

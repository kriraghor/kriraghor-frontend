import { setRequestLocale } from "next-intl/server";
import { MyPayments } from "@/components/payments/MyPayments";

export const metadata = { title: "My payments" };

export default async function MyPaymentsPage({ params }: PageProps<"/[locale]/me/payments">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MyPayments />;
}

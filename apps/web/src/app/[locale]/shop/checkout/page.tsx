import { setRequestLocale } from "next-intl/server";
import { CheckoutView } from "@/components/orders/CheckoutView";

export const metadata = { title: "Checkout" };

export default async function Page({ params }: PageProps<"/[locale]/shop/checkout">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CheckoutView />;
}

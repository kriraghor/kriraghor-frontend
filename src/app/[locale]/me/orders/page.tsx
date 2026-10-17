import { setRequestLocale } from "next-intl/server";
import { MyOrders } from "@/components/orders/MyOrders";

export const metadata = { title: "My orders" };

export default async function Page({ params }: PageProps<"/[locale]/me/orders">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MyOrders />;
}

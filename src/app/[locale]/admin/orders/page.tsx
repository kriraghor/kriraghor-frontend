import { setRequestLocale } from "next-intl/server";
import { OrdersAdmin } from "@/components/admin/orders/OrdersAdmin";

export const metadata = { title: "Orders" };

export default async function OrdersAdminPage({ params }: PageProps<"/[locale]/admin/orders">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OrdersAdmin />;
}

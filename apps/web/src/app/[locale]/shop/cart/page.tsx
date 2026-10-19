import { setRequestLocale } from "next-intl/server";
import { CartView } from "@/components/orders/CartView";

export const metadata = { title: "Cart" };

export default async function Page({ params }: PageProps<"/[locale]/shop/cart">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CartView />;
}

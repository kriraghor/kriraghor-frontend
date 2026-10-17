import { setRequestLocale } from "next-intl/server";
import { ShopDesk } from "@/components/vendor/market/ShopDesk";

export const metadata = { title: "My shop" };

export default async function ShopPage({ params }: PageProps<"/[locale]/vendor/shop">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ShopDesk />;
}

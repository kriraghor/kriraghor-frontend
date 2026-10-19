import { setRequestLocale } from "next-intl/server";
import { ProductsDesk } from "@/components/vendor/market/ProductsDesk";

export const metadata = { title: "My products" };

export default async function ProductsPage({ params }: PageProps<"/[locale]/vendor/products">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProductsDesk />;
}

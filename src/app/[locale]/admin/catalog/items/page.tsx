import { setRequestLocale } from "next-intl/server";
import { ItemsCatalog } from "@/components/admin/ItemsCatalog";

export const metadata = { title: "Item catalogue" };

export default async function ItemsCatalogPage({ params }: PageProps<"/[locale]/admin/catalog/items">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ItemsCatalog />;
}

import { setRequestLocale } from "next-intl/server";
import { PlacesCatalog } from "@/components/admin/PlacesCatalog";

export const metadata = { title: "Places and sports" };

export default async function PlacesCatalogPage({ params }: PageProps<"/[locale]/admin/catalog/places">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PlacesCatalog />;
}

import { setRequestLocale } from "next-intl/server";
import { EsportsCatalog } from "@/components/admin/EsportsCatalog";

export const metadata = { title: "Esports catalogue" };

export default async function EsportsCatalogPage({ params }: PageProps<"/[locale]/admin/catalog/esports">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <EsportsCatalog />;
}

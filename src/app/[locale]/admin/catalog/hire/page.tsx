import { setRequestLocale } from "next-intl/server";
import { HireCatalog } from "@/components/admin/hire/HireCatalog";

export const metadata = { title: "Hire taxonomy" };

export default async function HireCatalogPage({ params }: PageProps<"/[locale]/admin/catalog/hire">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HireCatalog />;
}

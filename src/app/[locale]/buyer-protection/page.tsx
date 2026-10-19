import { setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/LegalPage";
import { legalDoc } from "@/content/legal";

export const metadata = { title: "Buyer protection", alternates: { canonical: "/buyer-protection" } };

export default async function Page({ params }: PageProps<"/[locale]/buyer-protection">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage doc={legalDoc("protection", locale)} locale={locale} />;
}

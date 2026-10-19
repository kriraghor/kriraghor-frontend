import { setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/LegalPage";
import { legalDoc } from "@/content/legal";

export const metadata = { title: "Refund policy", alternates: { canonical: "/refund-policy" } };

export default async function Page({ params }: PageProps<"/[locale]/refund-policy">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage doc={legalDoc("refunds", locale)} locale={locale} />;
}

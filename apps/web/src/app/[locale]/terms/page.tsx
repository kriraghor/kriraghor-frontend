import { setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/LegalPage";
import { legalDoc } from "@/content/legal";

export const metadata = { title: "Terms of use", alternates: { canonical: "/terms" } };

export default async function Page({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage doc={legalDoc("terms", locale)} locale={locale} />;
}

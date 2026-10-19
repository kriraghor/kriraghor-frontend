import { setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/LegalPage";
import { legalDoc } from "@/content/legal";

export const metadata = { title: "Privacy policy", alternates: { canonical: "/privacy" } };

export default async function Page({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage doc={legalDoc("privacy", locale)} locale={locale} />;
}

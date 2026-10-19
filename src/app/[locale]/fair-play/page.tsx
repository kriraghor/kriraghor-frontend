import { setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/LegalPage";
import { legalDoc } from "@/content/legal";

export const metadata = { title: "Fair play rules", alternates: { canonical: "/fair-play" } };

export default async function Page({ params }: PageProps<"/[locale]/fair-play">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage doc={legalDoc("fairPlay", locale)} locale={locale} />;
}

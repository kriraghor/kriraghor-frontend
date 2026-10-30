import { setRequestLocale } from "next-intl/server";
import { EsportsLanding } from "@/components/account/SectionLanding";

export const metadata = { title: "Esports", robots: { index: false } };

/** The Esports section's landing on kriraghor.com: its pages live on esports.kriraghor.com. */
export default async function Page({ params }: PageProps<"/[locale]/me/esports">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <EsportsLanding />;
}

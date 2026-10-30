import { setRequestLocale } from "next-intl/server";
import { GymLanding } from "@/components/account/SectionLanding";

export const metadata = { title: "Gym", robots: { index: false } };

/** The Gym section's landing on kriraghor.com: its pages live on gym.kriraghor.com. */
export default async function Page({ params }: PageProps<"/[locale]/me/gym">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GymLanding />;
}

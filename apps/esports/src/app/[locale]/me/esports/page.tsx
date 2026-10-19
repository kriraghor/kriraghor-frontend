import { setRequestLocale } from "next-intl/server";
import { MyEsports } from "@/components/esports/MyEsports";
import { SignedIn } from "@/components/esports/SignedIn";

export const metadata = { title: "My UIDs and squads" };

export default async function Page({ params }: PageProps<"/[locale]/me/esports">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SignedIn><MyEsports /></SignedIn>;
}

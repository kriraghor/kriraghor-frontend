import { setRequestLocale } from "next-intl/server";
import { Winnings } from "@/components/esports/Winnings";
import { SignedIn } from "@/components/esports/SignedIn";

export const metadata = { title: "Winnings" };

export default async function Page({ params }: PageProps<"/[locale]/me/winnings">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SignedIn><Winnings /></SignedIn>;
}

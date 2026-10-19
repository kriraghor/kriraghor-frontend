import { setRequestLocale } from "next-intl/server";
import { MyMatches } from "@/components/esports/MyMatches";
import { SignedIn } from "@/components/esports/SignedIn";

export const metadata = { title: "My matches" };

export default async function Page({ params }: PageProps<"/[locale]/me/matches">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SignedIn><MyMatches /></SignedIn>;
}

import { setRequestLocale } from "next-intl/server";
import { GroundsDesk } from "@/components/vendor/GroundsDesk";

export const metadata = { title: "My grounds" };

export default async function GroundsPage({ params }: PageProps<"/[locale]/vendor/grounds">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GroundsDesk />;
}

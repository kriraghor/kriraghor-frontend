import { setRequestLocale } from "next-intl/server";
import { OwnerDisputes } from "@/components/vendor/OwnerTrust";

export const metadata = { title: "Disputes" };

export default async function OwnerDisputesPage({ params }: PageProps<"/[locale]/vendor/disputes">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OwnerDisputes />;
}

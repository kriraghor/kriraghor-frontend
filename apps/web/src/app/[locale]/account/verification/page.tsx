import { setRequestLocale } from "next-intl/server";
import { VerificationPage } from "@/components/kyc/VerificationPage";

export const metadata = { title: "Verify your identity" };

export default async function AccountVerificationPage({ params }: PageProps<"/[locale]/account/verification">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <VerificationPage />;
}

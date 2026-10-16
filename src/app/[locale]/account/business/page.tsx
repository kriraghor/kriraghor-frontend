import { setRequestLocale } from "next-intl/server";
import { BusinessPage } from "@/components/kyc/BusinessPage";

export const metadata = { title: "Ground owner documents" };

export default async function AccountBusinessPage({ params }: PageProps<"/[locale]/account/business">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BusinessPage />;
}

import { setRequestLocale } from "next-intl/server";
import { ProShell } from "@/components/hire/ProDesk";
import { ProEarnings } from "@/components/hire/ProEarnings";

export const metadata = { title: "Earnings" };

export default async function Page({ params }: PageProps<"/[locale]/pro/earnings">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <ProShell>
      <ProEarnings />
    </ProShell>
  );
}

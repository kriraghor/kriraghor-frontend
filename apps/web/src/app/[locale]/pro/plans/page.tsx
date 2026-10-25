import { setRequestLocale } from "next-intl/server";
import { ProShell } from "@/components/hire/ProDesk";
import { ProPlans } from "@/components/trainer/ProPlans";

export const metadata = { title: "Monthly plans" };

export default async function Page({ params }: PageProps<"/[locale]/pro/plans">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <ProShell>
      <ProPlans />
    </ProShell>
  );
}

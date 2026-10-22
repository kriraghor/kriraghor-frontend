import { setRequestLocale } from "next-intl/server";
import { ProShell } from "@/components/hire/ProDesk";
import { ProAvailability } from "@/components/hire/ProAvailability";

export const metadata = { title: "Availability" };

export default async function Page({ params }: PageProps<"/[locale]/pro/availability">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <ProShell>
      <ProAvailability />
    </ProShell>
  );
}

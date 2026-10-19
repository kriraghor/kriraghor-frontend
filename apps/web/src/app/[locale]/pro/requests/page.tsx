import { setRequestLocale } from "next-intl/server";
import { ProRequests, ProShell } from "@/components/hire/ProDesk";

export const metadata = { title: "Hire requests" };

export default async function Page({ params }: PageProps<"/[locale]/pro/requests">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <ProShell>
      <ProRequests />
    </ProShell>
  );
}

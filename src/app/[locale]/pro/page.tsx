import { setRequestLocale } from "next-intl/server";
import { ProProfiles, ProShell } from "@/components/hire/ProDesk";

export const metadata = { title: "Pro desk" };

export default async function Page({ params }: PageProps<"/[locale]/pro">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <ProShell>
      <ProProfiles />
    </ProShell>
  );
}

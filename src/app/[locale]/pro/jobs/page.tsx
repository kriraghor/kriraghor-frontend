import { setRequestLocale } from "next-intl/server";
import { ProJobs, ProShell } from "@/components/hire/ProDesk";

export const metadata = { title: "My jobs" };

export default async function Page({ params }: PageProps<"/[locale]/pro/jobs">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <ProShell>
      <ProJobs />
    </ProShell>
  );
}

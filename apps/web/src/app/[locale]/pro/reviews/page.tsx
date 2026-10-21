import { setRequestLocale } from "next-intl/server";
import { ProShell } from "@/components/hire/ProDesk";
import { ProReviews } from "@/components/hire/ProReviews";

export const metadata = { title: "Reviews" };

export default async function Page({ params }: PageProps<"/[locale]/pro/reviews">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <ProShell>
      <ProReviews />
    </ProShell>
  );
}

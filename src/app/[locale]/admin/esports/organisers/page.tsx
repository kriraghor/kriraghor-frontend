import { setRequestLocale } from "next-intl/server";
import { OrganisersDesk } from "@/components/admin/esports/OrganisersDesk";

export const metadata = { title: "Organisers" };

export default async function Page({ params }: PageProps<"/[locale]/admin/esports/organisers">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OrganisersDesk />;
}

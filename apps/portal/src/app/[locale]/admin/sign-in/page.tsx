import { setRequestLocale } from "next-intl/server";
import { AdminSignIn } from "@/components/AdminSignIn";

export const metadata = { title: "Staff sign-in" };

export default async function AdminSignInPage({ params }: PageProps<"/[locale]/admin/sign-in">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminSignIn />;
}

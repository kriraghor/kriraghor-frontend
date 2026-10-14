import { setRequestLocale } from "next-intl/server";
import { SignInForm } from "@/components/SignInForm";

export const metadata = { title: "Sign in" };

export default async function VendorSignIn({ params }: PageProps<"/[locale]/vendor/sign-in">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SignInForm next="/vendor" />;
}

import { setRequestLocale } from "next-intl/server";
import { SignInForm } from "@kriraghor/ui/sign-in-form";

export const metadata = { title: "Sign in" };

export default async function VendorSignIn({ params }: PageProps<"/[locale]/vendor/sign-in">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SignInForm next="/vendor" />;
}

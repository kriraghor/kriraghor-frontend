import { setRequestLocale } from "next-intl/server";
import { AuthLayout } from "@kriraghor/ui/auth-layout";
import { SignInForm } from "@kriraghor/ui/sign-in-form";

export const metadata = { title: "Sign in" };

/** Owners sign up on kriraghor.com (where the business roles are), so no sign-up link here. */
export default async function VendorSignIn({ params }: PageProps<"/[locale]/vendor/sign-in">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <AuthLayout brand="vendor">
      <SignInForm next="/vendor" signUpHref={null} />
    </AuthLayout>
  );
}

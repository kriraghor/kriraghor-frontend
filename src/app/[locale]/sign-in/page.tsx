import { setRequestLocale } from "next-intl/server";
import { SignInForm } from "@/components/SignInForm";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ params }: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SignInForm next="/me" />;
}

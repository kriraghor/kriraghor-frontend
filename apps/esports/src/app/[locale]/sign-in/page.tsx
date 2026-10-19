import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { SignInForm } from "@kriraghor/ui/sign-in-form";
import { SignInNext } from "@/components/esports/SignInNext";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ params }: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<SignInForm next="/me" />}>
      <SignInNext />
    </Suspense>
  );
}

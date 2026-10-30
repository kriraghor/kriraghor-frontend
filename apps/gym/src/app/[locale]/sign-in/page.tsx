import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { AuthLayout } from "@kriraghor/ui/auth-layout";
import { SignInFallback, SignInNext } from "@/components/SignInNext";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ params }: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <AuthLayout brand="gym" image="/images/gym-training.jpg">
      <Suspense fallback={<SignInFallback />}>
        <SignInNext />
      </Suspense>
    </AuthLayout>
  );
}

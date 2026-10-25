import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { AuthLayout } from "@kriraghor/ui/auth-layout";
import { SignUp } from "@/components/SignUp";

export const metadata = { title: "Create your account" };

export default async function SignUpPage({ params }: PageProps<"/[locale]/signup">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <AuthLayout brand="gym" image="/images/gym-training.jpg">
      <Suspense fallback={null}>
        <SignUp />
      </Suspense>
    </AuthLayout>
  );
}

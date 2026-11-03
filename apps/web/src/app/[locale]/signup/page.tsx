import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { AuthLayout } from "@kriraghor/ui/auth-layout";
import { SignUp } from "@/components/SignUp";
import { PHOTOS } from "@/lib/photos";
import { safeNext } from "@/lib/safe-next";

export const metadata = { title: "Create your account" };

// ?next= is request data (cacheComponents): read it inside Suspense. Only same-site paths are kept.
async function Content({ searchParams }: { searchParams: PageProps<"/[locale]/signup">["searchParams"] }) {
  const { next } = await searchParams;
  return <SignUp next={safeNext(next)} />;
}

export default async function SignUpPage({ params, searchParams }: PageProps<"/[locale]/signup">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <AuthLayout brand="web" image={PHOTOS.esports}>
      <Suspense fallback={<SignUp next="/me" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </AuthLayout>
  );
}

import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { AuthLayout } from "@kriraghor/ui/auth-layout";
import { SignInForm } from "@kriraghor/ui/sign-in-form";
import { PHOTOS } from "@/lib/photos";
import { safeNext } from "@/lib/safe-next";

export const metadata = { title: "Sign in" };

// ?next= is request data (cacheComponents): read it inside Suspense. Only same-site paths are kept.
async function Content({ searchParams }: { searchParams: PageProps<"/[locale]/sign-in">["searchParams"] }) {
  const { next } = await searchParams;
  return <SignInForm next={safeNext(next)} passwordReset />;
}

export default async function SignInPage({ params, searchParams }: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <AuthLayout brand="web" image={PHOTOS.groundsFloodlit}>
      <Suspense fallback={<SignInForm next="/me" passwordReset />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </AuthLayout>
  );
}

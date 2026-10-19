import { Suspense } from "react";
import { AuthShell } from "@/components/AuthShell";
import { setRequestLocale } from "next-intl/server";
import { SignInForm } from "@kriraghor/ui/sign-in-form";
import { safeNext } from "@/lib/teams";

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
    <AuthShell photo="cricket">
      <Suspense fallback={<SignInForm next="/me" passwordReset />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

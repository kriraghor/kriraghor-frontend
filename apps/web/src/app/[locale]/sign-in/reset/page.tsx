import { Suspense } from "react";
import { AuthLayout } from "@kriraghor/ui/auth-layout";
import { PHOTOS } from "@/lib/photos";
import { setRequestLocale } from "next-intl/server";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { safeNext } from "@/lib/teams";

export const metadata = { title: "Reset your password", robots: { index: false } };

// ?next= is request data (cacheComponents): read it inside Suspense. Only same-site paths are kept.
async function Content({ searchParams }: { searchParams: PageProps<"/[locale]/sign-in/reset">["searchParams"] }) {
  const { next } = await searchParams;
  return <ResetPasswordForm next={safeNext(next)} />;
}

export default async function ResetPage({ params, searchParams }: PageProps<"/[locale]/sign-in/reset">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <AuthLayout brand="web" image={PHOTOS.badminton}>
      <Suspense fallback={<ResetPasswordForm />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </AuthLayout>
  );
}

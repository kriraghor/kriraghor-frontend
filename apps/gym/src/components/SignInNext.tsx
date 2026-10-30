"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SignInForm } from "@kriraghor/ui/sign-in-form";
import { safeNext } from "@/lib/links";

/** The sign-in form with the gym's own line, returning to ?next= (read on the client, so the page still prerenders). */
export function SignInNext() {
  const t = useTranslations("signIn");
  return <SignInForm next={safeNext(useSearchParams().get("next"))} subtitle={t("subtitle")} />;
}

/** The same form before ?next= is known (the Suspense fallback). */
export function SignInFallback() {
  const t = useTranslations("signIn");
  return <SignInForm next="/me/passes" subtitle={t("subtitle")} />;
}

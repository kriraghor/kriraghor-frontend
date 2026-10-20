"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SignUpWizard } from "@kriraghor/ui/sign-up";
import { safeNext } from "@/lib/esports";
import { webHref } from "@/lib/links";

/** esports.kriraghor.com sign-up: no role step (business roles live on kriraghor.com); game ID next. */
export function SignUp() {
  const t = useTranslations("auth.nextSteps");
  const next = safeNext(useSearchParams().get("next"));
  return (
    <SignUpWizard
      next={next}
      termsHref={webHref("/terms")}
      privacyHref={webHref("/privacy")}
      nextSteps={() => [
        { href: "/me/esports", label: t("gameId") },
        { href: "/events", label: t("events") },
      ]}
    />
  );
}

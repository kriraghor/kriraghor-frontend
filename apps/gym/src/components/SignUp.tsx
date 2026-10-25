"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SignUpWizard } from "@kriraghor/ui/sign-up";
import { safeNext, webHref } from "@/lib/links";

/** gym.kriraghor.com sign-up: no role step (the gym owner application is on /start); gyms or a pass next. */
export function SignUp() {
  const t = useTranslations("auth.nextSteps");
  const next = safeNext(useSearchParams().get("next"));
  return (
    <SignUpWizard
      next={next}
      termsHref={webHref("/terms")}
      privacyHref={webHref("/privacy")}
      nextSteps={() => [
        { href: "/gyms", label: t("gyms") },
        { href: "/start", label: t("runGym") },
      ]}
    />
  );
}

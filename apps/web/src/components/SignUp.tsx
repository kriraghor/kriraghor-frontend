"use client";

import { useTranslations } from "next-intl";
import { SignUpWizard, type NextStep } from "@kriraghor/ui/sign-up";
import type { SignupRole } from "@kriraghor/ui/auth-flow";
import { esportsHref } from "@/lib/links";

/** kriraghor.com sign-up: every self-service role, next steps on this site and esports. */
export function SignUp({ next }: { next: string }) {
  const t = useTranslations("auth.nextSteps");
  const nextSteps = (role: SignupRole): NextStep[] => {
    const nid = { href: "/account/verification", label: t("nid") };
    switch (role) {
      case "none":
        return [{ href: esportsHref("/me"), label: t("gameId") }, { href: "/venues", label: t("venues") }, { href: esportsHref(), label: t("events") }];
      case "player":
      case "pro":
        return [{ href: `/account/business?as=${role}`, label: t("hireProfile") }, nid];
      case "ground_owner":
        return [nid, { href: "/account/business", label: t("business") }];
      case "shop_owner":
        return [nid, { href: "/account/business?as=shop", label: t("business") }];
      case "gym_owner":
        return [nid, { href: "/account/business?as=gym", label: t("business") }];
      case "organiser":
        return [nid, { href: "/account/business?as=organiser", label: t("business") }];
    }
  };
  return <SignUpWizard next={next} roles={["none", "player", "pro", "ground_owner", "shop_owner", "gym_owner", "organiser"]} nextSteps={nextSteps} />;
}

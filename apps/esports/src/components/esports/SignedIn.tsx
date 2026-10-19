"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@kriraghor/ui/auth";
import { usePathname } from "@kriraghor/ui/i18n/navigation";
import { LinkButton } from "./bits";

/** Player pages: show a sign-in prompt (back to this page) instead of the content when signed out. */
export function SignedIn({ children }: { children: ReactNode }) {
  const t = useTranslations("esports");
  const { status } = useAuth();
  const pathname = usePathname();
  if (status === "loading") return <div className="mx-auto mt-10 h-40 max-w-3xl animate-pulse bg-surface-2" />;
  if (status === "signed_out")
    return (
      <section className="mx-auto max-w-xl px-5 py-16 text-center">
        <h1 className="text-2xl font-extrabold">{t("signInFirst")}</h1>
        <div className="mt-6">
          <LinkButton href={`/sign-in?next=${encodeURIComponent(pathname)}`}>{t("signIn")}</LinkButton>
        </div>
      </section>
    );
  return <>{children}</>;
}

"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { api } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";

/**
 * The signed-in user from GET /me. Opening this page on kriraghor.com after signing in on
 * esports.kriraghor.com (or the reverse) shows the same account: the SSO proof for 0B.
 */
export function MePanel({ children, signInHref = "/sign-in" }: { children?: ReactNode; signInHref?: string }) {
  const t = useTranslations();
  const { status } = useAuth();
  const me = useQuery({
    queryKey: ["me"],
    enabled: status === "signed_in",
    queryFn: async () => {
      const { data, error } = await api().GET("/me");
      if (error) throw error;
      return data;
    },
  });

  if (status === "loading" || (me.isPending && status === "signed_in")) {
    return <p className="px-5 py-12 text-muted" role="status">{t("me.loading")}</p>;
  }
  if (status === "signed_out" || !me.data) {
    return (
      <section className="mx-auto max-w-xl px-5 py-12">
        <p data-testid="signed-out">{t("me.signedOut")}</p>
        <Link href={signInHref} className="mt-4 inline-flex min-h-11 items-center bg-brand px-4 font-bold text-on-brand">
          {t("nav.signIn")}
        </Link>
      </section>
    );
  }

  const u = me.data;
  return (
    <section className="mx-auto max-w-xl px-5 py-12">
      <h1 className="text-3xl font-extrabold" data-testid="me-name">
        {u.displayName}
      </h1>
      <p className="mt-2 text-muted">{t("me.ssoNote")}</p>
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t-2 border-line-strong pt-4">
        <dt className="text-muted">{t("me.id")}</dt>
        <dd data-testid="me-id" className="font-mono text-sm">{u.id}</dd>
        <dt className="text-muted">{t("me.phone")}</dt>
        <dd>{u.phone ?? "–"}</dd>
        <dt className="text-muted">{t("me.email")}</dt>
        <dd>{u.email ?? "–"}</dd>
        <dt className="text-muted">{t("me.roles")}</dt>
        <dd>{u.roles.map((r) => `${r.role} (${r.status})`).join(", ")}</dd>
      </dl>
      {children}
    </section>
  );
}

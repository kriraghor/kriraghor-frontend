"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "@kriraghor/ui/i18n/navigation";
import { api } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { LiveStatus } from "@kriraghor/ui/live-status";
import { PlatformOverview } from "./admin/PlatformOverview";

/**
 * Admin desk home. Only an admin session (staff, TOTP passed) gets here; anyone else is sent to the
 * staff sign-in. Masters and view_analytics staff see the platform overview (M19); everyone sees
 * "Needs your action".
 */
export function AdminHome() {
  const t = useTranslations();
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "signed_out") router.replace("/admin/sign-in");
  }, [status, router]);

  const me = useQuery({
    queryKey: ["admin-me"],
    enabled: status === "signed_in",
    queryFn: async () => {
      const { data, error } = await api("admin").GET("/admin/me");
      if (error) throw error;
      return data;
    },
  });

  if (status !== "signed_in" || !me.data) {
    return (
      <p className="px-5 py-12 text-muted" role="status">
        {t("me.loading")}
      </p>
    );
  }

  const u = me.data;
  return (
    <section className="mx-auto max-w-[1200px] px-5 py-12">
      <h1 className="text-3xl font-extrabold">{t("admin.home")}</h1>
      <p className="mt-2" data-testid="admin-welcome">
        {t("admin.welcome", { name: u.displayName })}
        {u.isMaster ? <span className="ml-2 rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand-text">{t("admin.master")}</span> : null}
      </p>
      <h2 className="mt-8 text-lg font-bold">{t("admin.permissions")}</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {u.permissions.map((p) => (
          <li key={p} className="rounded-full border border-line px-3 py-1 text-sm">
            {p}
          </li>
        ))}
      </ul>
      <LiveStatus />
      <PlatformOverview canSee={u.isMaster || u.permissions.includes("view_analytics" as never)} />
    </section>
  );
}

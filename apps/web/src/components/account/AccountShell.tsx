"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { SectionShell } from "@kriraghor/ui/section-shell";
import { useAuth } from "@kriraghor/ui/auth";
import { listNotifications } from "@kriraghor/api-client/notifications";
import { ShellUser, useMe } from "@kriraghor/ui/account";
import { memberSections } from "@/lib/member-sections";

/**
 * The kriraghor.com account area (/me, /account, /pro), organised by core feature (31 Oct 2026):
 * a rail of sections (Esports, Sports events, Venues, Gym, Shop, Hire, Work, Money, Help, Account)
 * and each section's pages as tabs at the top. Signed out, pages show their own sign-in prompt
 * with no rail. The test ids on the tabs are the ones the old sidebar had (e2e).
 */
export function AccountShell({ children }: { children: ReactNode }) {
  const t = useTranslations("account");
  const { status, audience } = useAuth();
  const { me } = useMe();
  // The bell's own query (same key), so the badge and the bell agree without a second request.
  const bell = useQuery({ queryKey: ["bell", audience, "all"], enabled: status === "signed_in", queryFn: () => listNotifications(audience, { limit: 20, unread: false }) });

  if (status === "signed_out") return <>{children}</>;

  const u = me.data;
  return (
    <SectionShell sections={memberSections((k) => t(k), u, bell.data?.unreadCount)} title={t("menu")} user={(collapsed) => <ShellUser collapsed={collapsed} user={u} />}>
      {children}
    </SectionShell>
  );
}

"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowSquareOut, Barbell, Bell, Repeat } from "@phosphor-icons/react";
import { AppShell, type ShellGroup } from "@kriraghor/ui/app-shell";
import { useAuth } from "@kriraghor/ui/auth";
import { ShellUser, useMe } from "@kriraghor/ui/account";
import { listNotifications } from "@kriraghor/api-client/notifications";
import { webHref } from "@/lib/links";

/**
 * The gym account area (/me): passes, trainer plans and updates. The rest of the account (profile,
 * payments, payouts, verification) lives on kriraghor.com, one link away (the same account, SSO).
 */
export function AccountShell({ children }: { children: ReactNode }) {
  const t = useTranslations("account");
  const { status, audience } = useAuth();
  const { me } = useMe();
  const bell = useQuery({ queryKey: ["bell", audience, "all"], enabled: status === "signed_in", queryFn: () => listNotifications(audience, { limit: 20, unread: false }) });
  if (status === "signed_out") return <>{children}</>;

  const groups: ShellGroup[] = [
    {
      items: [
        { href: "/me/passes", label: t("items.passes"), icon: Barbell, testId: "me-passes" },
        { href: "/me/subscriptions", label: t("items.subscriptions"), icon: Repeat, testId: "me-subscriptions" },
        { href: "/me/notifications", label: t("items.notifications"), icon: Bell, badge: bell.data?.unreadCount },
      ],
    },
    { label: t("groups.settings"), items: [{ href: webHref("/me"), label: "kriraghor.com", icon: ArrowSquareOut, testId: "me-web" }] },
  ];
  return (
    <AppShell groups={groups} title={t("menu")} top={(collapsed) => <ShellUser collapsed={collapsed} user={me.data} />}>
      {children}
    </AppShell>
  );
}

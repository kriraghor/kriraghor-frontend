"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowSquareOut, Bell, GameController, House, Sword, Wallet } from "@phosphor-icons/react";
import { AppShell, type ShellGroup } from "@kriraghor/ui/app-shell";
import { useAuth } from "@kriraghor/ui/auth";
import { ShellUser, useMe } from "@kriraghor/ui/account";
import { listNotifications } from "@kriraghor/api-client/notifications";
import { webHref } from "@/lib/links";

/** The esports account area (/me): matches, game IDs, winnings, notifications; the rest lives on kriraghor.com. */
export function AccountShell({ children }: { children: ReactNode }) {
  const t = useTranslations("account");
  const { status, audience } = useAuth();
  const { me } = useMe();
  const bell = useQuery({ queryKey: ["bell", audience, "all"], enabled: status === "signed_in", queryFn: () => listNotifications(audience, { limit: 20, unread: false }) });
  if (status === "signed_out") return <>{children}</>;

  const groups: ShellGroup[] = [
    {
      items: [
        { href: "/me", label: t("items.overview"), icon: House, match: "exact" },
        { href: "/me/matches", label: t("items.matches"), icon: Sword },
        { href: "/me/esports", label: t("items.gameIds"), icon: GameController },
        { href: "/me/winnings", label: t("items.winnings"), icon: Wallet },
        { href: "/me/notifications", label: t("items.notifications"), icon: Bell, badge: bell.data?.unreadCount },
      ],
    },
    { label: t("groups.settings"), items: [{ href: webHref("/me"), label: "kriraghor.com", icon: ArrowSquareOut }] },
  ];
  return (
    <AppShell groups={groups} title={t("menu")} top={(collapsed) => <ShellUser collapsed={collapsed} user={me.data} />}>
      {children}
    </AppShell>
  );
}

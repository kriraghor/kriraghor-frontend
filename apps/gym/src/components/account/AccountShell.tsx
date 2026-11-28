"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowSquareOut, Bell, ClipboardText, Footprints, House, QrCode, Receipt, Repeat, Ticket, Tray, Wallet } from "@phosphor-icons/react";
import { AppShell, type ShellGroup } from "@kriraghor/ui/app-shell";
import { useAuth } from "@kriraghor/ui/auth";
import { ShellUser, useMe } from "@kriraghor/ui/account";
import { listNotifications } from "@kriraghor/api-client/notifications";
import { webHref } from "@/lib/links";
import { gymMe } from "@/lib/gym-manage";
import { useMyDues } from "@/components/gym-member/MyDues";

/**
 * The gym account area (/me): my gyms (home, requests, trial visits, plans, dues, receipts, the check-in QR; M24),
 * passes, trainer plans and updates. The rest of the account (profile,
 * payments, payouts, verification) lives on kriraghor.com, one link away (the same account, SSO).
 */
export function AccountShell({ children }: { children: ReactNode }) {
  const t = useTranslations("account");
  const tg = useTranslations("gm");
  const tv = useTranslations("gv");
  const { status, audience } = useAuth();
  const { me } = useMe();
  const bell = useQuery({ queryKey: ["bell", audience, "all"], enabled: status === "signed_in", queryFn: () => listNotifications(audience, { limit: 20, unread: false }) });
  const requests = useQuery({ queryKey: ["my-gym-requests"], enabled: status === "signed_in", queryFn: () => gymMe.requests() });
  // Waiting for my answer: gym invites (my own join requests wait for the gym).
  const pending = (requests.data?.items ?? []).filter((r) => r.status === "pending" && r.direction === "gym_invite").length;
  const dues = useMyDues();
  if (status === "signed_out") return <>{children}</>;

  const groups: ShellGroup[] = [
    {
      items: [
        // Not exact: a membership's page (/me/memberships/[id]) belongs under My gyms.
        { href: "/me", label: tg("me.nav.home"), icon: House, testId: "me-home-link" },
        { href: "/me/requests", label: tg("me.nav.requests"), icon: Tray, badge: pending, testId: "me-requests-link" },
        { href: "/me/visits", label: tv("nav"), icon: Footprints, testId: "me-visits-link" },
        { href: "/me/plans", label: tg("me.nav.plans"), icon: ClipboardText, testId: "me-plans-link" },
        { href: "/me/dues", label: tg("me.nav.dues"), icon: Wallet, badge: dues.data?.items.length || undefined, testId: "me-dues" },
        { href: "/me/receipts", label: tg("me.nav.receipts"), icon: Receipt, testId: "me-receipts" },
        { href: "/me/checkin", label: tg("me.nav.checkin"), icon: QrCode, testId: "me-checkin-link" },
        { href: "/me/passes", label: t("items.passes"), icon: Ticket, testId: "me-passes" },
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

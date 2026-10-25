"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Bank,
  Barbell,
  Bell,
  Briefcase,
  CalendarCheck,
  Flag,
  GameController,
  GearSix,
  HandCoins,
  Handshake,
  Heart,
  House,
  IdentificationCard,
  Package,
  Receipt,
  Repeat,
  Scales,
  ShieldCheck,
  Star,
  Storefront,
  Trophy,
  UserGear,
  UsersThree,
} from "@phosphor-icons/react";
import { AppShell, type ShellGroup } from "@kriraghor/ui/app-shell";
import { useAuth } from "@kriraghor/ui/auth";
import { listNotifications } from "@kriraghor/api-client/notifications";
import { ShellUser, useMe } from "@kriraghor/ui/account";
import { esportsHref, gymHref } from "@/lib/links";

const WORK_ROLES = ["player", "pro"];
const OPEN = ["applied", "documents_pending", "in_review", "changes_requested", "active"];

/**
 * The kriraghor.com account area (/me, /account, /pro): the grouped sidebar from the design plan
 * Part D. Signed out, pages show their own sign-in prompt with no sidebar. The test ids on the
 * items are the ones the old /me link row had (e2e).
 */
export function AccountShell({ children }: { children: ReactNode }) {
  const t = useTranslations("account");
  const { status, audience } = useAuth();
  const { me } = useMe();
  // The bell's own query (same key), so the badge and the bell agree without a second request.
  const bell = useQuery({ queryKey: ["bell", audience, "all"], enabled: status === "signed_in", queryFn: () => listNotifications(audience, { limit: 20, unread: false }) });

  if (status === "signed_out") return <>{children}</>;

  const u = me.data;
  const works = (u?.roles ?? []).some((r) => WORK_ROLES.includes(r.role) && OPEN.includes(r.status));
  const groups: ShellGroup[] = [
    { items: [{ href: "/me", label: t("items.overview"), icon: House, match: "exact" }] },
    {
      label: t("groups.play"),
      items: [
        { href: "/me/events", label: t("items.events"), icon: Trophy, testId: "me-tournaments" },
        { href: esportsHref("/me/matches"), label: t("items.esports"), icon: GameController, testId: "me-esports" },
        { href: "/me/teams", label: t("items.teams"), icon: UsersThree, testId: "me-teams" },
        { href: "/me/player", label: t("items.player"), icon: IdentificationCard, testId: "me-player" },
        { href: "/me/eligibility", label: u && !u.phoneVerified ? t("items.addPhone") : t("items.ready"), icon: ShieldCheck, testId: "me-eligibility" },
        { href: "/me/hire", label: t("items.hires"), icon: Handshake, testId: "me-hire" },
      ],
    },
    {
      label: t("groups.bookings"),
      items: [
        { href: "/me/bookings", label: t("items.bookings"), icon: CalendarCheck, testId: "me-bookings" },
        // Gym passes and trainer plans live on gym.kriraghor.com since 25 Oct 2026 (through /go/gym).
        { href: gymHref("/me/passes"), label: t("items.passes"), icon: Barbell, testId: "me-passes" },
        { href: gymHref("/me/subscriptions"), label: t("items.subscriptions"), icon: Repeat, testId: "me-subscriptions" },
      ],
    },
    {
      label: t("groups.shopping"),
      items: [
        { href: "/me/orders", label: t("items.orders"), icon: Package, testId: "me-orders" },
        { href: "/shop/saved", label: t("items.saved"), icon: Heart, testId: "me-saved" },
      ],
    },
    {
      label: t("groups.money"),
      items: [
        { href: "/me/payments", label: t("items.payments"), icon: Receipt },
        { href: "/me/payouts", label: t("items.payouts"), icon: HandCoins },
        { href: "/me/payout-account", label: t("items.payoutAccount"), icon: Bank },
      ],
    },
    ...(works ? [{ label: t("groups.work"), items: [{ href: "/pro", label: t("items.proDesk"), icon: Briefcase, testId: "me-pro" }] }] : []),
    {
      label: t("groups.help"),
      items: [
        { href: "/me/disputes", label: t("items.disputes"), icon: Scales, testId: "me-disputes" },
        { href: "/me/reports", label: t("items.reports"), icon: Flag },
        { href: "/me/reviews", label: t("items.reviews"), icon: Star },
      ],
    },
    {
      label: t("groups.settings"),
      items: [
        { href: "/account/settings", label: t("items.settings"), icon: GearSix, testId: "me-settings" },
        { href: "/me/notifications", label: t("items.notifications"), icon: Bell, badge: bell.data?.unreadCount },
        { href: "/account/verification", label: u?.kycStatus === "verified" ? t("items.verified") : t("items.verify"), icon: IdentificationCard, testId: "me-verification" },
        { href: "/account/roles", label: t("items.roles"), icon: UserGear },
        { href: "/account/business", label: t("items.business"), icon: Storefront, testId: "me-open-shop" },
      ],
    },
  ];

  return (
    <AppShell groups={groups} title={t("menu")} top={(collapsed) => <ShellUser collapsed={collapsed} user={u} />}>
      {children}
    </AppShell>
  );
}


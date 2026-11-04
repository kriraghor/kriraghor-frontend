/**
 * The kriraghor.com member area by core feature (31 Oct 2026): the sections on the left rail and
 * each section's pages as tabs. Pure, so the list can be tested without rendering. The test ids
 * are the ones the old sidebar and the /me link row had (e2e), on the same destinations.
 */
import {
  Bank,
  Barbell,
  Bell,
  Briefcase,
  CalendarCheck,
  CalendarDots,
  ChartLineUp,
  ChatCircleText,
  Flag,
  GameController,
  GearSix,
  HandCoins,
  Handshake,
  Heart,
  House,
  IdentificationCard,
  Lifebuoy,
  ListChecks,
  MapPin,
  Package,
  Receipt,
  Repeat,
  Scales,
  ShieldCheck,
  ShoppingBag,
  Star,
  Storefront,
  Trophy,
  Tray,
  UserCircle,
  UserGear,
  UsersThree,
  Wallet,
} from "@phosphor-icons/react";
import type { ShellSection } from "@kriraghor/ui/sections";

/** Only the player and pro roles, while applying or active, get the Work section (the pro desk). */
export const WORK_ROLES = ["player", "pro"];
export const OPEN_WORK = ["applied", "documents_pending", "in_review", "changes_requested", "active"];

export type MemberFacts = {
  roles?: { role: string; status: string }[];
  phoneVerified?: boolean;
  kycStatus?: string | null;
};

export const canWork = (roles: MemberFacts["roles"] = []) => roles.some((r) => WORK_ROLES.includes(r.role) && OPEN_WORK.includes(r.status));

/**
 * The sections in rail order, Account last (pinned at the bottom). `t` reads the "account"
 * messages; `me` is undefined while the profile loads (labels then assume nothing is missing).
 */
export function memberSections(t: (key: string) => string, me: MemberFacts | undefined, unread = 0): ShellSection[] {
  const sections: (ShellSection | false)[] = [
    { key: "home", label: t("sections.home"), icon: House, href: "/me", match: "exact", items: [] },
    {
      key: "esports",
      label: t("sections.esports"),
      icon: GameController,
      href: "/me/esports",
      // The landing's cards are the way in (SectionLanding), so no tabs repeat them.
      items: [],
    },
    {
      key: "events",
      label: t("sections.events"),
      icon: Trophy,
      href: "/me/events",
      items: [
        { href: "/me/events", label: t("items.events"), icon: Trophy, testId: "me-tournaments" },
        { href: "/me/teams", label: t("items.teams"), icon: UsersThree, testId: "me-teams" },
        { href: "/me/player", label: t("items.player"), icon: IdentificationCard, testId: "me-player" },
        { href: "/me/eligibility", label: me && !me.phoneVerified ? t("items.addPhone") : t("items.ready"), icon: ShieldCheck, testId: "me-eligibility" },
      ],
    },
    {
      key: "venues",
      label: t("sections.venues"),
      icon: MapPin,
      href: "/me/bookings",
      items: [{ href: "/me/bookings", label: t("items.bookings"), icon: CalendarCheck, testId: "me-bookings" }],
    },
    {
      key: "gym",
      label: t("sections.gym"),
      icon: Barbell,
      href: "/me/gym",
      // Gym passes and trainer plans live on gym.kriraghor.com since 25 Oct 2026; the landing's cards lead there.
      items: [],
    },
    {
      key: "shop",
      label: t("sections.shop"),
      icon: ShoppingBag,
      href: "/me/orders",
      items: [
        { href: "/me/orders", label: t("items.orders"), icon: Package, testId: "me-orders" },
        { href: "/shop/saved", label: t("items.saved"), icon: Heart, testId: "me-saved" },
      ],
    },
    {
      key: "hire",
      label: t("sections.hire"),
      icon: Handshake,
      href: "/me/hire",
      items: [{ href: "/me/hire", label: t("items.hires"), icon: Handshake, testId: "me-hire" }],
    },
    canWork(me?.roles) && {
      key: "work",
      label: t("sections.work"),
      icon: Briefcase,
      href: "/pro",
      // The pro desk's own tab row moved here (one row, not two).
      items: [
        { href: "/pro", label: t("tabs.overview"), icon: Briefcase, testId: "me-pro" },
        { href: "/pro/requests", label: t("tabs.requests"), icon: Tray },
        { href: "/pro/jobs", label: t("tabs.jobs"), icon: ListChecks },
        { href: "/pro/availability", label: t("tabs.availability"), icon: CalendarDots },
        { href: "/pro/earnings", label: t("tabs.earnings"), icon: ChartLineUp },
        { href: "/pro/plans", label: t("tabs.proPlans"), icon: Repeat },
        { href: "/pro/reviews", label: t("tabs.reviews"), icon: ChatCircleText },
      ],
    },
    {
      key: "money",
      label: t("sections.money"),
      icon: Wallet,
      href: "/me/payments",
      items: [
        { href: "/me/payments", label: t("items.payments"), icon: Receipt },
        { href: "/me/payouts", label: t("items.payouts"), icon: HandCoins },
        { href: "/me/payout-account", label: t("items.payoutAccount"), icon: Bank },
      ],
    },
    {
      key: "help",
      label: t("sections.help"),
      icon: Lifebuoy,
      href: "/me/disputes",
      items: [
        { href: "/me/disputes", label: t("items.disputes"), icon: Scales, testId: "me-disputes" },
        { href: "/me/reports", label: t("items.reports"), icon: Flag },
        { href: "/me/reviews", label: t("items.reviews"), icon: Star },
      ],
    },
    {
      key: "account",
      label: t("sections.account"),
      icon: UserCircle,
      href: "/account/settings",
      pin: "bottom",
      items: [
        { href: "/account/settings", label: t("tabs.settings"), icon: GearSix, testId: "me-settings" },
        { href: "/me/notifications", label: t("items.notifications"), icon: Bell, badge: unread },
        { href: "/account/verification", label: me?.kycStatus === "verified" ? t("items.verified") : t("items.verify"), icon: IdentificationCard, testId: "me-verification" },
        { href: "/account/roles", label: t("items.roles"), icon: UserGear },
        { href: "/account/business", label: t("items.business"), icon: Storefront, testId: "me-open-shop" },
      ],
    },
  ];
  return sections.filter((s): s is ShellSection => s !== false);
}

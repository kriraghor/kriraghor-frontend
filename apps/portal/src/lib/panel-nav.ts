import type { Icon } from "@phosphor-icons/react";
import {
  Barbell,
  CalendarCheck,
  ChartLineUp,
  ClipboardText,
  CurrencyCircleDollar,
  Flag,
  GameController,
  Gavel,
  Handshake,
  House,
  Key,
  Lightning,
  ListChecks,
  MapPin,
  Megaphone,
  Package,
  Pulse,
  Receipt,
  ShieldWarning,
  ShoppingBag,
  SlidersHorizontal,
  SoccerBall,
  Sparkle,
  Star,
  Storefront,
  Tag,
  Trophy,
  UsersThree,
  Warehouse,
} from "@phosphor-icons/react";

/**
 * The portal sidebars (Claude Design "Panels"). Admin items list the permissions that open their
 * desk (any of them, as the API guards it; "master" for master-only desks); vendor groups list the
 * business role they belong to. This only shapes the menu: the API enforces every rule (ADR-004).
 */
export type Permission =
  | "approve_listings"
  | "approve_documents"
  | "resolve_reports"
  | "refund_small"
  | "view_payouts"
  | "release_payouts"
  | "manage_users"
  | "manage_catalog"
  | "manage_esports"
  | "enter_results"
  | "manage_organisers"
  | "view_analytics"
  | "edit_fees"
  | "manage_staff";

export type NavEntry = { href: string; key: string; icon: Icon; match?: "exact" | "prefix" };
type AdminEntry = NavEntry & { any?: Permission[]; master?: boolean };
export type NavSection<E> = { key: string; items: E[] };

export const ADMIN_SECTIONS: NavSection<AdminEntry>[] = [
  {
    key: "operations",
    items: [
      { href: "/admin", key: "desk", icon: House, match: "exact" },
      { href: "/admin/bookings", key: "bookingsAdmin", icon: CalendarCheck, any: ["manage_users", "view_payouts"] },
      { href: "/admin/orders", key: "ordersAdmin", icon: Receipt, any: ["manage_users", "refund_small", "view_payouts"] },
      { href: "/admin/hire", key: "hireAdmin", icon: Handshake, any: ["manage_users", "approve_listings", "refund_small", "view_payouts"] },
      { href: "/admin/gym", key: "gymAdmin", icon: Barbell, any: ["manage_users", "approve_listings", "refund_small", "view_payouts"] },
      { href: "/admin/teams", key: "teamsAdmin", icon: UsersThree, any: ["manage_users"] },
    ],
  },
  {
    key: "esports",
    items: [
      { href: "/admin/esports", key: "esportsDesk", icon: GameController, any: ["manage_esports", "enter_results"] },
      { href: "/admin/esports/showcases", key: "bigEvents", icon: Sparkle, any: ["manage_esports"] },
      { href: "/admin/esports/organisers", key: "organisersAdmin", icon: Megaphone, any: ["manage_organisers", "approve_listings", "manage_esports"] },
      { href: "/admin/catalog/esports", key: "esportsCatalog", icon: ListChecks, any: ["manage_esports", "manage_catalog"] },
    ],
  },
  {
    key: "venues",
    items: [
      { href: "/admin/venues", key: "groundsAdmin", icon: SoccerBall, any: ["approve_listings", "manage_users"] },
      { href: "/admin/sports-events", key: "tournamentsAdmin", icon: Trophy },
      { href: "/admin/catalog/places", key: "places", icon: MapPin, any: ["manage_esports", "manage_catalog"] },
    ],
  },
  {
    key: "market",
    items: [
      { href: "/admin/market", key: "market", icon: Storefront, any: ["approve_listings", "manage_users"] },
      { href: "/admin/catalog/items", key: "items", icon: Tag, any: ["manage_esports", "manage_catalog"] },
      { href: "/admin/catalog/hire", key: "hireCatalog", icon: ClipboardText, any: ["manage_esports", "manage_catalog"] },
    ],
  },
  {
    key: "money",
    items: [
      { href: "/admin/finance", key: "finance", icon: CurrencyCircleDollar, any: ["view_payouts", "release_payouts"] },
      { href: "/admin/fees", key: "fees", icon: SlidersHorizontal, any: ["manage_catalog"] },
    ],
  },
  {
    key: "trust",
    items: [
      { href: "/admin/moderation", key: "moderation", icon: ShieldWarning, any: ["approve_documents", "approve_listings"] },
      { href: "/admin/disputes", key: "disputes", icon: Gavel, any: ["resolve_reports", "manage_esports"] },
      { href: "/admin/reports", key: "reports", icon: Flag, any: ["resolve_reports"] },
      { href: "/admin/reviews", key: "reviews", icon: Star, any: ["resolve_reports"] },
      { href: "/admin/risk", key: "risk", icon: Lightning, any: ["manage_users"] },
    ],
  },
  {
    key: "system",
    items: [
      { href: "/admin/audit", key: "audit", icon: Key, master: true },
      { href: "/admin/events", key: "events", icon: Pulse, master: true },
    ],
  },
];

/** The admin items this staff member can open; a master sees every desk. */
export function adminSections(me: { isMaster: boolean; permissions: readonly string[] } | undefined): NavSection<AdminEntry>[] {
  const can = (e: AdminEntry) => Boolean(me) && (me!.isMaster || (!e.master && (!e.any || e.any.some((p) => me!.permissions.includes(p)))));
  return ADMIN_SECTIONS.map((s) => ({ ...s, items: s.items.filter(can) })).filter((s) => s.items.length);
}

export type BusinessRole = "ground_owner" | "shop_owner" | "gym_owner" | "organiser";
export const BUSINESS_ROLES: BusinessRole[] = ["ground_owner", "shop_owner", "gym_owner", "organiser"];

export const VENDOR_SECTIONS: (NavSection<NavEntry> & { role?: BusinessRole })[] = [
  { key: "overview", items: [{ href: "/vendor", key: "home", icon: House, match: "exact" }] },
  {
    key: "grounds",
    role: "ground_owner",
    items: [
      { href: "/vendor/venues", key: "grounds", icon: SoccerBall },
      { href: "/vendor/bookings", key: "bookings", icon: CalendarCheck },
    ],
  },
  {
    key: "shop",
    role: "shop_owner",
    items: [
      { href: "/vendor/shop", key: "shop", icon: Storefront },
      { href: "/vendor/products", key: "products", icon: ShoppingBag },
      { href: "/vendor/inventory", key: "inventory", icon: Warehouse },
      { href: "/vendor/orders", key: "orders", icon: Package },
    ],
  },
  { key: "gym", role: "gym_owner", items: [{ href: "/vendor/gyms", key: "gyms", icon: Barbell }] },
  {
    key: "events",
    role: "organiser",
    items: [
      { href: "/vendor/esports", key: "esportsConsole", icon: GameController },
      { href: "/vendor/events", key: "sportsConsole", icon: Trophy },
    ],
  },
  {
    key: "business",
    items: [
      { href: "/vendor/analytics", key: "analytics", icon: ChartLineUp },
      { href: "/vendor/disputes", key: "vendorDisputes", icon: Gavel },
      { href: "/vendor/reviews", key: "vendorReviews", icon: Star },
    ],
  },
];

/**
 * The vendor items for the roles held: "all" shows every business the person runs, a role shows
 * only that business. Someone with no business role yet sees the overview (the steps to get one).
 */
export function vendorSections(active: BusinessRole[], view: BusinessRole | "all"): NavSection<NavEntry>[] {
  if (!active.length) return VENDOR_SECTIONS.filter((s) => s.key === "overview");
  const shown = view === "all" || !active.includes(view) ? active : [view];
  return VENDOR_SECTIONS.filter((s) => !s.role || shown.includes(s.role));
}

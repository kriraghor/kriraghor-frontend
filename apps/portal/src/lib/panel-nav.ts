import type { Icon } from "@phosphor-icons/react";
import { BUSINESS_ROLES, type BusinessRole } from "@kriraghor/ui/desk/access";
import { gymHref } from "./links";
import {
  Article,
  Barbell,
  CalendarCheck,
  ChartLineUp,
  ClipboardText,
  CreditCard,
  CurrencyCircleDollar,
  Flag,
  GameController,
  Gavel,
  Handshake,
  House,
  IdentificationBadge,
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
  UserList,
  UsersThree,
  Wallet,
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
  | "manage_gyms"
  | "view_analytics"
  | "edit_fees"
  | "manage_staff";

export type NavEntry = { href: string; key: string; icon: Icon; match?: "exact" | "prefix" };
/** A vendor item shared by some businesses only (shown when one of them is in view). */
type VendorEntry = NavEntry & { roles?: BusinessRole[] };
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
      // M24 §4.4: the gym system's owners, plans, invoices and fee overrides (masters write).
      { href: "/admin/gym-manage", key: "gymManageAdmin", icon: CreditCard, any: ["manage_gyms", "view_payouts"] },
      { href: "/admin/users", key: "usersAdmin", icon: UserList, any: ["manage_users"] },
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
      // M26: the feed of tournaments people post; staff remove and restore them.
      { href: "/admin/tournament-posts", key: "tournamentPosts", icon: Article, any: ["approve_listings"] },
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
      { href: "/admin/staff", key: "staffAdmin", icon: IdentificationBadge, master: true },
    ],
  },
];

/** The admin items this staff member can open; a master sees every desk. */
export function adminSections(me: { isMaster: boolean; permissions: readonly string[] } | undefined): NavSection<AdminEntry>[] {
  const can = (e: AdminEntry) => Boolean(me) && (me!.isMaster || (!e.master && (!e.any || e.any.some((p) => me!.permissions.includes(p)))));
  return ADMIN_SECTIONS.map((s) => ({ ...s, items: s.items.filter(can) })).filter((s) => s.items.length);
}

// The business roles are shared with gym.kriraghor.com/manage (@kriraghor/ui/desk).
export { BUSINESS_ROLES, type BusinessRole };

/** Gyms (owners and their staff) are managed on gym.kriraghor.com/manage, reached through /go/gym. */
export const GYMS_HREF = gymHref("/manage");

/**
 * The business sidebar. Analytics covers every business since Round B2 (venue, shop and gym, one page
 * with a business switcher), so it is one shared link with the business tools rather than a copy in
 * each section. Reviews cover venues and shops (M17 FR-34; a gym's are on gym.kriraghor.com/manage
 * since 3 Nov 2026), so they sit with the shared business tools for those owners. Since 25 Oct 2026
 * gyms are managed on gym.kriraghor.com (M24 §4.3): gym owners get a "Gyms" link there (through
 * /go/gym) with the shared business tools instead of a gym section. Nobody organises tournaments on
 * Kriraghor since 3 Nov 2026 (ADR-008), so there is no organiser section.
 */
export const VENDOR_SECTIONS: (NavSection<VendorEntry> & { role?: BusinessRole })[] = [
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
      { href: "/vendor/settlement", key: "settlement", icon: Wallet },
    ],
  },
  {
    key: "business",
    items: [
      { href: "/vendor/analytics", key: "analytics", icon: ChartLineUp },
      { href: "/vendor/payouts", key: "vendorPayouts", icon: CurrencyCircleDollar },
      { href: "/vendor/disputes", key: "vendorDisputes", icon: Gavel },
      { href: "/vendor/reviews", key: "vendorReviews", icon: Star, roles: ["ground_owner", "shop_owner"] },
      // Round B3: venue, gym and shop owners add staff.
      { href: "/vendor/team", key: "team", icon: UsersThree, roles: ["ground_owner", "shop_owner", "gym_owner"] },
      { href: GYMS_HREF, key: "gyms", icon: Barbell, roles: ["gym_owner"] },
    ],
  },
];

/** What /me says about a place the person works at as staff (Round B3): its type, id and permissions. */
export type WorkplaceNav = { businessType: "venue" | "gym" | "shop"; businessId: string; permissions: readonly string[] };

/**
 * Round B3: the desks a staff member may use, one section per kind of business, by the permissions
 * held at any workplace of that kind. Owner-only pages (listing, pricing, products, settlement,
 * analytics, payouts, team, disputes) never appear here; reviews only with reviews.reply. Gym staff
 * get one "Gyms" link to gym.kriraghor.com/manage, which shows only their gyms and desks there.
 */
export function staffSections(workplaces: readonly WorkplaceNav[] | undefined): NavSection<NavEntry>[] {
  const list = workplaces ?? [];
  const holds = (type: WorkplaceNav["businessType"], ...any: string[]) => list.some((w) => w.businessType === type && w.permissions.some((p) => any.includes(p)));
  const sections: NavSection<NavEntry>[] = [
    {
      key: "workVenue",
      items: [
        ...(holds("venue", "bookings.view") ? [{ href: "/vendor/bookings", key: "bookings", icon: CalendarCheck }] : []),
        ...(holds("venue", "reviews.reply") ? [{ href: "/vendor/reviews", key: "vendorReviews", icon: Star }] : []),
      ],
    },
    // M24 §3.3: any gym desk on gym.kriraghor.com/manage (front desk, members, fees, passes).
    { key: "workGym", items: holds("gym", "desk.admit", "desk.admissions", "passes.view", "attendance.mark", "members.view", "members.trainer", "fees.collect") ? [{ href: GYMS_HREF, key: "gyms", icon: Barbell }] : [] },
    {
      key: "workShop",
      items: [
        ...(holds("shop", "orders.view") ? [{ href: "/vendor/orders", key: "orders", icon: Package }] : []),
        ...(holds("shop", "stock.view") ? [{ href: "/vendor/inventory", key: "inventory", icon: Warehouse }] : []),
      ],
    },
  ];
  return sections.filter((s) => s.items.length);
}

/**
 * The businesses a person runs (active roles, in sidebar order) and the one the switcher shows:
 * `lastPanelRole` when it is one of them, otherwise "all" (saved as "member": every business).
 */
export function businessView(me: { roles: readonly { role: string; status: string }[]; lastPanelRole?: string | null } | undefined): { active: BusinessRole[]; view: BusinessRole | "all"; shown: BusinessRole[] } {
  const active = BUSINESS_ROLES.filter((r) => me?.roles.some((x) => x.role === r && x.status === "active"));
  const last = me?.lastPanelRole as BusinessRole | null | undefined;
  const view: BusinessRole | "all" = last && active.includes(last) ? last : "all";
  return { active, view, shown: view === "all" ? active : [view] };
}

/**
 * The vendor items for the roles held: "all" shows every business the person runs, a role shows
 * only that business. Someone with no business role yet sees the overview (the steps to get one).
 * Round B3: the desks of the places the person works at as staff follow, whatever the switcher
 * shows; a desk the owner sections already link to is not repeated.
 */
export function vendorSections(active: BusinessRole[], view: BusinessRole | "all", workplaces: readonly WorkplaceNav[] = []): NavSection<NavEntry>[] {
  const owner: NavSection<NavEntry>[] = !active.length
    ? VENDOR_SECTIONS.filter((s) => s.key === "overview")
    : (() => {
        const shown = view === "all" || !active.includes(view) ? active : [view];
        return VENDOR_SECTIONS.filter((s) => !s.role || shown.includes(s.role))
          .map((s) => ({ ...s, items: s.items.filter((e) => !e.roles || e.roles.some((r) => shown.includes(r))) }))
          .filter((s) => s.items.length);
      })();
  const linked = new Set(owner.flatMap((s) => s.items.map((i) => i.href)));
  const staff = staffSections(workplaces)
    .map((s) => ({ ...s, items: s.items.filter((i) => !linked.has(i.href)) }))
    .filter((s) => s.items.length);
  return [...owner, ...staff];
}

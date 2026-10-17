"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

export const ADMIN_NAV = [
  { href: "/admin", key: "desk" },
  { href: "/admin/fees", key: "fees" },
  { href: "/admin/catalog/esports", key: "esportsCatalog" },
  { href: "/admin/esports", key: "esportsDesk" },
  { href: "/admin/grounds", key: "groundsAdmin" },
  { href: "/admin/bookings", key: "bookingsAdmin" },
  { href: "/admin/catalog/places", key: "places" },
  { href: "/admin/catalog/items", key: "items" },
  { href: "/admin/market", key: "market" },
  { href: "/admin/finance", key: "finance" },
  { href: "/admin/moderation", key: "moderation" },
  { href: "/admin/disputes", key: "disputes" },
  { href: "/admin/reports", key: "reports" },
  { href: "/admin/reviews", key: "reviews" },
  { href: "/admin/risk", key: "risk" },
  { href: "/admin/audit", key: "audit" },
  { href: "/admin/events", key: "events" },
] as const;

/** Desk navigation for small screens (the header shows the same links from md up). */
export function AdminSubnav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav aria-label="Admin desks" className="border-b border-line md:hidden">
      <ul className="mx-auto flex max-w-[1320px] gap-1 overflow-x-auto px-5">
        {ADMIN_NAV.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className="inline-flex min-h-11 items-center whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-semibold aria-[current=page]:border-brand"
            >
              {t(item.key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

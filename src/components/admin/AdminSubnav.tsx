"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

export const ADMIN_NAV = [
  { href: "/admin", key: "desk" },
  { href: "/admin/fees", key: "fees" },
  { href: "/admin/catalog/esports", key: "esportsCatalog" },
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

import type { Icon } from "@phosphor-icons/react";
import { isExternal } from "@kriraghor/session/links";
import type { ShellItem } from "./shell-parts";

/**
 * One section of a member area (Esports, Venues, Gym…): a rail item that opens `href`, and the
 * pages shown as tabs at the top of the main column.
 */
export type ShellSection = {
  key: string;
  label: string;
  icon: Icon;
  href: string;
  items: ShellItem[];
  /** Shown on the rail; when absent, the items' badges add up. */
  badge?: number;
  /** "exact" for an overview (Home at /me) whose children belong to other sections. */
  match?: "exact" | "prefix";
  /** "bottom" pins the section under the others, beside the person's card (Account). */
  pin?: "bottom";
  testId?: string;
};

export type ActiveSection = { section: ShellSection; item: ShellItem | null };

/** True when `pathname` is `href` or (for "prefix") a page under it. */
export const onPath = (href: string, pathname: string, match: "exact" | "prefix" = "prefix") =>
  match === "exact" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

/**
 * The section and tab for this path. The most specific match wins across every section's own link
 * and its tabs (/me/notifications/settings is Account's Notifications tab; /me/bookings/42 is
 * Venues' Bookings tab). Links to another site never match: they are never the page you are on.
 */
export function activeSection(sections: ShellSection[], pathname: string): ActiveSection | null {
  let best: ActiveSection | null = null;
  let len = -1;
  for (const s of sections) {
    for (const it of s.items) {
      if (isExternal(it.href) || !onPath(it.href, pathname, it.match) || it.href.length <= len) continue;
      best = { section: s, item: it };
      len = it.href.length;
    }
    if (!isExternal(s.href) && onPath(s.href, pathname, s.match) && s.href.length > len) {
      best = { section: s, item: s.items.find((it) => it.href === s.href && !isExternal(it.href)) ?? null };
      len = s.href.length;
    }
  }
  return best;
}

/** The count on a section's rail item: its own badge, or the sum of its tabs' badges (0 hides it). */
export const sectionBadge = (s: ShellSection) => s.badge ?? s.items.reduce((n, it) => n + (it.badge && it.badge > 0 ? it.badge : 0), 0);

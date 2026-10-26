"use client";

import { Suspense, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowSquareOut, Barbell, CashRegister, ChartBar, CreditCard, Gear, Package, PencilSimple, QrCode, Receipt, Ticket, Tray, UploadSimple, UsersThree } from "@phosphor-icons/react";
import { publicEnv } from "@kriraghor/session/env";
import { AppShell, type ShellGroup } from "@kriraghor/ui/app-shell";
import { useAuth } from "@kriraghor/ui/auth";
import { SignedOutCard } from "@kriraghor/ui/account";
import { usePathname } from "@kriraghor/ui/i18n/navigation";
import { useWorkplaces } from "@kriraghor/ui/desk";
import { useManageGyms } from "@/components/gym-manage/common";
import { manageGroups, workplaceGyms, type ManageItem } from "@/lib/manage-nav";

const ICON: Record<ManageItem["key"], typeof Barbell> = {
  gyms: Barbell,
  billing: CreditCard,
  dashboard: ChartBar,
  desk: QrCode,
  members: UsersThree,
  requests: Tray,
  fees: CashRegister,
  closing: Receipt,
  packages: Package,
  import: UploadSimple,
  settings: Gear,
  edit: PencilSimple,
  passes: Ticket,
};
const EXACT = new Set<ManageItem["key"]>(["gyms", "dashboard", "fees"]);

/**
 * /manage (M24 §4.1): a sidebar with one group per gym from GET /manage/gyms (owned gyms first, then the
 * gyms worked at), each page shown by role and permission (lib/manage-nav), plus Billing for owners.
 * The business tools shared with venues and shops (team, reviews, payouts, analytics) stay on the
 * business panel, one link away. Signed out, the sign-in prompt comes back here after signing in.
 */
export function ManageShell({ children }: { children: ReactNode }) {
  const t = useTranslations("manage");
  const { status } = useAuth();
  const wp = useWorkplaces();
  const gyms = useManageGyms(status === "signed_in");

  if (status === "signed_out")
    return (
      <Suspense fallback={<SignedOutCard signInHref="/sign-in?next=/manage" />}>
        <SignInHere />
      </Suspense>
    );

  const names = new Map(wp.named.map((w) => [w.businessId, w.business.name] as const));
  const refs = gyms.data ? gyms.data.items.map((g) => ({ id: g.id, name: g.name, role: g.role, permissions: g.permissions })) : workplaceGyms(wp.refs, names);
  const groups: ShellGroup[] = manageGroups({ gyms: refs }).map((g) => ({
    label: g.key === "overview" ? undefined : (g.name ?? t("gym")),
    items: g.items.map((it) => ({ href: it.href, label: t(`nav.${it.key}`), icon: ICON[it.key], match: EXACT.has(it.key) ? ("exact" as const) : undefined, testId: `manage-${it.key}${g.gymId ? `-${g.gymId}` : ""}` })),
  }));
  if (refs.some((g) => g.role === "owner")) {
    const vendor = publicEnv().VENDOR_URL.replace(/\/+$/, "");
    groups.push({
      label: t("business"),
      items: [
        { href: `${vendor}/vendor/team`, label: t("nav.team"), icon: ArrowSquareOut, testId: "manage-team" },
        { href: `${vendor}/vendor/reviews`, label: t("nav.reviews"), icon: ArrowSquareOut, testId: "manage-reviews" },
        { href: `${vendor}/vendor/payouts`, label: t("nav.payouts"), icon: ArrowSquareOut, testId: "manage-payouts" },
        { href: `${vendor}/vendor/analytics?business=gym`, label: t("nav.analytics"), icon: ArrowSquareOut, testId: "manage-analytics" },
      ],
    });
  }
  return (
    <AppShell groups={groups} title={t("menu")}>
      {children}
    </AppShell>
  );
}

/** Signed out: the sign-in prompt, coming back to this page (the pathname is request data, so it streams in). */
function SignInHere() {
  const pathname = usePathname();
  return <SignedOutCard signInHref={`/sign-in?next=${encodeURIComponent(pathname)}`} />;
}

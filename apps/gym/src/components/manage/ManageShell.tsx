"use client";

import { Suspense, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowSquareOut, BellRinging, Barbell, CashRegister, ChartBar, ChartLineUp, ClipboardText, CreditCard, DoorOpen, Gear, Package, PencilSimple, PresentationChart, QrCode, Receipt, Star, Ticket, Tray, UploadSimple, UsersThree, Wallet } from "@phosphor-icons/react";
import { publicEnv } from "@kriraghor/session/env";
import { AppShell, type ShellGroup } from "@kriraghor/ui/app-shell";
import { useAuth } from "@kriraghor/ui/auth";
import { SignedOutCard } from "@kriraghor/ui/account";
import { usePathname } from "@kriraghor/ui/i18n/navigation";
import { useWorkplaces } from "@kriraghor/ui/desk";
import { useManageGyms } from "@/components/gym-manage/common";
import { currentGym, gymFromPath, gymSections, manageGroups, workplaceGyms, type ManageGroup, type ManageGymRef, type ManageItem } from "@/lib/manage-nav";
import { GymSwitcher } from "./GymSwitcher";

const ICON: Record<ManageItem["key"], typeof Barbell> = {
  gyms: Barbell,
  billing: CreditCard,
  payouts: Wallet,
  allReports: PresentationChart,
  dashboard: ChartBar,
  desk: QrCode,
  entrance: DoorOpen,
  members: UsersThree,
  requests: Tray,
  plans: ClipboardText,
  fees: CashRegister,
  closing: Receipt,
  reports: ChartLineUp,
  reminders: BellRinging,
  packages: Package,
  import: UploadSimple,
  settings: Gear,
  edit: PencilSimple,
  passes: Ticket,
  reviews: Star,
};
const EXACT = new Set<ManageItem["key"]>(["gyms", "dashboard", "fees"]);

// The last gym used, for the pages with no gym in the URL. Only a convenience: it can be empty or blocked.
const LAST_GYM = "kg.gym.current";
const readLastGym = () => {
  try {
    return window.localStorage.getItem(LAST_GYM);
  } catch {
    return null;
  }
};
const onStorage = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

/**
 * /manage (M24 §4.1): one gym at a time (2 Nov 2026). A switcher over the gyms from GET /manage/gyms (owned
 * gyms first, then the gyms worked at), that gym's pages by section, shown by role and permission
 * (lib/manage-nav), then My gyms, Billing, Payouts and All-gyms reports. The team, shared with venues and
 * shops, stays on the business panel, one link away. Signed out, the sign-in prompt comes back here after signing in.
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
  const refs: ManageGymRef[] = gyms.data ? gyms.data.items.map((g) => ({ id: g.id, name: g.name, role: g.role, permissions: g.permissions, listingStatus: g.listingStatus })) : workplaceGyms(wp.refs, names);
  const overview = manageGroups({ gyms: refs })[0];
  // The path is request data (Cache Components): until it streams in, the menu shows the all-gyms pages.
  return (
    <Suspense
      fallback={
        <AppShell groups={[{ items: overview.items.map((it) => ({ href: it.href, label: t(`nav.${it.key}`), icon: ICON[it.key], testId: `manage-${it.key}` })) }]} title={t("menu")}>
          {children}
        </AppShell>
      }
    >
      <OneGymShell refs={refs}>{children}</OneGymShell>
    </Suspense>
  );
}

function OneGymShell({ refs, children }: { refs: ManageGymRef[]; children: ReactNode }) {
  const t = useTranslations("manage");
  const pathname = usePathname();
  const last = useSyncExternalStore(onStorage, readLastGym, () => null);
  const [overview, ...gyms] = manageGroups({ gyms: refs });
  const current = currentGym(gyms, pathname, last);
  const inUrl = gyms.some((g) => g.gymId === gymFromPath(pathname)) ? gymFromPath(pathname) : null;

  useEffect(() => {
    if (!inUrl) return;
    try {
      window.localStorage.setItem(LAST_GYM, inUrl);
    } catch {
      // Blocked storage only means the menu starts at the first gym.
    }
  }, [inUrl]);

  const toItems = (g: ManageGroup, items: ManageItem[]) => items.map((it) => ({ href: it.href, label: t(`nav.${it.key}`), icon: ICON[it.key], match: EXACT.has(it.key) ? ("exact" as const) : undefined, testId: `manage-${it.key}${g.gymId ? `-${g.gymId}` : ""}` }));
  const groups: ShellGroup[] = [
    ...(current ? gymSections(current.items).map((s) => ({ label: t(`section.${s.key}`), items: toItems(current, s.items), collapsible: true, defaultOpen: s.key === "today" })) : []),
    { label: current ? t("section.allGyms") : undefined, items: toItems(overview, overview.items), collapsible: Boolean(current) },
  ];
  if (refs.some((g) => g.role === "owner")) {
    const vendor = publicEnv().VENDOR_URL.replace(/\/+$/, "");
    groups.push({
      label: t("business"),
      collapsible: true,
      items: [{ href: `${vendor}/vendor/team`, label: t("nav.team"), icon: ArrowSquareOut, testId: "manage-team" }],
    });
  }
  return (
    <AppShell groups={groups} title={t("menu")} context={current?.name} top={current ? (collapsed) => <GymSwitcher gyms={gyms} current={current} pathname={pathname} collapsed={collapsed} /> : undefined}>
      {children}
    </AppShell>
  );
}

/** Signed out: the sign-in prompt, coming back to this page (the pathname is request data, so it streams in). */
function SignInHere() {
  const pathname = usePathname();
  return <SignedOutCard signInHref={`/sign-in?next=${encodeURIComponent(pathname)}`} />;
}

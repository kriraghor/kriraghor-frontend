"use client";

import { Suspense, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Archive, CalendarBlank, ClockUser, IdentificationBadge, Money, Wrench, ChatCircleText, CloudSlash, Gift, Megaphone, ArrowSquareOut, BellRinging, LockKey, Barbell, CashRegister, ChartBar, ChartLineUp, ChartPieSlice, ClipboardText, CreditCard, DoorOpen, Gear, Lockers, Package, PencilSimple, PresentationChart, QrCode, Receipt, ShoppingCart, Star, Ticket, Tray, UploadSimple, UsersThree, Vault, Wallet, WhatsappLogo } from "@phosphor-icons/react";
import { publicEnv } from "@kriraghor/session/env";
import { AppShell, type ShellGroup } from "@kriraghor/ui/app-shell";
import { useAuth } from "@kriraghor/ui/auth";
import { SignedOutCard } from "@kriraghor/ui/account";
import { usePathname, useRouter } from "@kriraghor/ui/i18n/navigation";
import { useWorkplaces } from "@kriraghor/ui/desk";
import { useManageGyms } from "@/components/gym-manage/common";
import { currentGym, gymFromPath, gymSections, manageGroups, workplaceGyms, type ManageGroup, type ManageGymRef, type ManageItem } from "@/lib/manage-nav";
import { GymSwitcher } from "./GymSwitcher";
import { DeskBar, DeskPhoneLock } from "./desk/DeskBar";
import { DeskLock } from "./desk/DeskLock";
import { useDeskKeepAlive, useDeskPageMark, useDeskState } from "./desk/useDesk";
import { backOnline, bindDesk, localVersion, offlineView, subscribe as subscribeDeskLocal, type EffectiveDesk } from "./desk/deskLocal";
import { OfflineBanner } from "./offline/OfflineDesk";
import { DeskContext, useOffline } from "./offline/useOffline";

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
  expenses: Wallet,
  cash: Vault,
  pnl: ChartPieSlice,
  sell: ShoppingCart,
  stock: Archive,
  lockers: Lockers,
  classes: CalendarBlank,
  rewards: Gift,
  notices: Megaphone,
  whatsapp: WhatsappLogo,
  leads: ChatCircleText,
  staff: IdentificationBadge,
  payroll: Money,
  equipment: Wrench,
  mywork: ClockUser,
  deskmode: LockKey,
  offline: CloudSlash,
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
 * Desk mode (M24 §21): while this device is in desk mode and locked, the lock screen is the whole page; unlocked,
 * the menu is the desk gym's pages without the owner-only ones, and the person at the desk shows in the foot.
 */
export function ManageShell({ children }: { children: ReactNode }) {
  const t = useTranslations("manage");
  const { status } = useAuth();
  const wp = useWorkplaces();
  const deskQ = useDeskState(status === "signed_in");
  const serverDesk = deskQ.data?.open ? deskQ.data : null;
  // M24 §22: without a connection the desk keeps working from what this device knows (deskLocal).
  const offline = useOffline();
  useSyncExternalStore(subscribeDeskLocal, localVersion, localVersion);
  const deskId = serverDesk?.deskId ?? null;
  useEffect(() => bindDesk(deskId), [deskId]);
  useEffect(() => {
    if (!offline) backOnline();
  }, [offline]);
  // The clock is read only offline (never while the page is prerendered on the server).
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!offline || !deskId) return;
    const tick = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(tick);
  }, [offline, deskId]);
  const deskOn: EffectiveDesk | null = serverDesk ? (offline ? offlineView(serverDesk, now || undefined) : { ...serverDesk, offline: false, pinOnDevice: false }) : null;
  const gyms = useManageGyms(status === "signed_in" && !(deskOn && !deskOn.unlocked));
  useDeskPageMark(Boolean(deskOn));
  useDeskKeepAlive(deskOn?.unlocked ?? null, deskOn?.idleMinutes ?? 0);

  if (status === "signed_out")
    return (
      <Suspense fallback={<SignedOutCard signInHref="/sign-in?next=/manage" />}>
        <SignInHere />
      </Suspense>
    );

  if (deskOn && !deskOn.unlocked) return <DeskLock state={deskOn} />;

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
      <DeskContext.Provider value={deskOn}>
        <OneGymShell refs={refs} desk={deskOn}>
          {children}
        </OneGymShell>
      </DeskContext.Provider>
    </Suspense>
  );
}

function OneGymShell({ refs, desk, children }: { refs: ManageGymRef[]; desk: EffectiveDesk | null; children: ReactNode }) {
  const t = useTranslations("manage");
  const pathname = usePathname();
  const router = useRouter();
  const last = useSyncExternalStore(onStorage, readLastGym, () => null);
  const [overview, ...gyms] = manageGroups({ gyms: refs, deskGymId: desk?.gym.id ?? null });
  const current = currentGym(gyms, pathname, last);
  const inUrl = gyms.some((g) => g.gymId === gymFromPath(pathname)) ? gymFromPath(pathname) : null;

  // At a desk (M24 §21): the desk gym's pages only, and never Desk mode itself (it is for your own sign-in);
  // anywhere else opens the front desk.
  const deskGym = desk?.gym.id ?? null;
  const astray = Boolean(deskGym) && (gymFromPath(pathname) !== deskGym || pathname.endsWith("/desk-mode"));
  useEffect(() => {
    if (astray && deskGym) router.replace(`/manage/${deskGym}/desk`);
  }, [astray, deskGym, router]);

  useEffect(() => {
    if (!inUrl) return;
    try {
      window.localStorage.setItem(LAST_GYM, inUrl);
    } catch {
      // Blocked storage only means the menu starts at the first gym.
    }
  }, [inUrl]);

  // M24 §22: what waits on this device for the gym on screen, sent as this person.
  const here = refs.find((g) => g.id === current?.gymId);
  const perms = here ? (here.role === "owner" ? null : (here.permissions ?? [])) : [];
  const toItems = (g: ManageGroup, items: ManageItem[]) => items.map((it) => ({ href: it.href, label: t(`nav.${it.key}`), icon: ICON[it.key], match: EXACT.has(it.key) ? ("exact" as const) : undefined, testId: `manage-${it.key}${g.gymId ? `-${g.gymId}` : ""}` }));
  const groups: ShellGroup[] = [
    ...(current ? gymSections(current.items).map((s) => ({ label: t(`section.${s.key}`), items: toItems(current, s.items), collapsible: true, defaultOpen: s.key === "today" })) : []),
    // A desk device stays in its gym: no "All gyms" pages there.
    ...(desk ? [] : [{ label: current ? t("section.allGyms") : undefined, items: toItems(overview, overview.items), collapsible: Boolean(current) }]),
  ];
  if (!desk && refs.some((g) => g.role === "owner")) {
    const vendor = publicEnv().VENDOR_URL.replace(/\/+$/, "");
    groups.push({
      label: t("business"),
      collapsible: true,
      items: [{ href: `${vendor}/vendor/team`, label: t("nav.team"), icon: ArrowSquareOut, testId: "manage-team" }],
    });
  }
  return (
    <>
      <AppShell groups={groups} title={t("menu")} context={current?.name} top={desk ? (collapsed) => <DeskBar state={desk} collapsed={collapsed} /> : current ? (collapsed) => <GymSwitcher gyms={gyms} current={current} pathname={pathname} collapsed={collapsed} /> : undefined}>
      {current?.gymId ? <OfflineBanner gymId={current.gymId} perms={perms} /> : null}
      {children}
    </AppShell>
      {desk ? <DeskPhoneLock state={desk} /> : null}
    </>
  );
}

/** Signed out: the sign-in prompt, coming back to this page (the pathname is request data, so it streams in). */
function SignInHere() {
  const pathname = usePathname();
  return <SignedOutCard signInHref={`/sign-in?next=${encodeURIComponent(pathname)}`} />;
}

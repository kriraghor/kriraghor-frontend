"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Barbell } from "@phosphor-icons/react";
import { Dropdown, Menu } from "@kriraghor/ui/kit";
import { Chip as StatusChip, STATUS_TONE } from "@kriraghor/ui/desk";
import { useRouter } from "@kriraghor/ui/i18n/navigation";
import { switchGymHref, type ManageGroup } from "@/lib/manage-nav";

/**
 * The gym the sidebar shows (2 Nov 2026): a dropdown with several gyms, just the name with one, each with its
 * listing status. Choosing another gym keeps the page you are on when you may open it there. On the 76 px
 * rail it is an icon.
 */
export function GymSwitcher({ gyms, current, pathname, collapsed }: { gyms: readonly ManageGroup[]; current: ManageGroup; pathname: string; collapsed: boolean }) {
  const t = useTranslations("manage");
  const tv = useTranslations("vendorGym.status");
  const router = useRouter();
  // The sidebar and the phone menu each render one.
  const id = useId();
  const nameOf = (g: ManageGroup) => g.name ?? t("gym");
  const labelOf = (g: ManageGroup) => (g.staff ? t("switcher.staff", { name: nameOf(g) }) : nameOf(g));
  const statusOf = (g: ManageGroup) => (g.listingStatus && tv.has(g.listingStatus) ? tv(g.listingStatus) : null);
  const withStatus = (g: ManageGroup) => [labelOf(g), statusOf(g)].filter(Boolean).join(" · ");
  const chip = statusOf(current) ? (
    <span data-testid="gym-switcher-status">
      <StatusChip tone={STATUS_TONE[current.listingStatus as string] ?? "muted"}>{statusOf(current)}</StatusChip>
    </span>
  ) : null;
  const go = (id: string) => {
    const to = gyms.find((g) => g.gymId === id);
    if (to && to.gymId !== current.gymId) router.push(switchGymHref(pathname, current, to));
  };

  if (collapsed) {
    const icon = (
      <button type="button" title={withStatus(current)} className="mx-auto flex size-11 items-center justify-center rounded-control bg-brand-soft text-brand-text" aria-label={gyms.length > 1 ? `${t("switcher.change")}: ${nameOf(current)}` : nameOf(current)} data-testid="gym-switcher-rail">
        <Barbell size={22} aria-hidden />
      </button>
    );
    return gyms.length > 1 ? <div className="flex justify-center"><Menu align="start" trigger={icon} items={gyms.map((g) => ({ label: withStatus(g), onSelect: () => go(g.gymId as string) }))} /></div> : icon;
  }
  if (gyms.length === 1) {
    return (
      <div className="px-3" data-testid="gym-switcher-one">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t("switcher.label")}</p>
          {chip}
        </div>
        <p className="mt-0.5 font-display text-lg font-bold leading-snug">{nameOf(current)}</p>
      </div>
    );
  }
  return (
    <div className="px-1">
      <Dropdown
        id={id}
        label={
          <span className="flex items-center justify-between gap-2">
            {t("switcher.label")}
            {chip}
          </span>
        }
        value={current.gymId as string}
        onChange={go}
        options={gyms.map((g) => ({ value: g.gymId as string, label: labelOf(g), hint: statusOf(g) ?? undefined }))}
        testId="gym-switcher"
      />
    </div>
  );
}

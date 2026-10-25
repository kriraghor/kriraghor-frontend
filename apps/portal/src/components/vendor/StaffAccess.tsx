"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useAuth } from "@kriraghor/ui/auth";
import { Select } from "@kriraghor/ui/kit";
import { DeskAccessNotice, useDeskErrorText, useWorkplaces } from "@kriraghor/ui/desk";
import { shopDesk } from "@/lib/vendor/market";
import { deskChoices, staffPermissionsAt, type DeskChoice } from "@/lib/vendor/team";

// The workplace hook and the access answers are shared with gym.kriraghor.com/manage (@kriraghor/ui/desk).
export { DeskAccessNotice, useDeskErrorText, useWorkplaces };

/**
 * The shop a shop desk (orders, inventory) shows (Round B3): the owner's own shop first, then the
 * shops the person works at with the permission. `picked` is the ?shopId= of the URL. `shopId` is
 * what the API is asked for: left out for the owner's own shop (today's request, unchanged), the
 * shop's id for a workplace. `perms` is null for the owner.
 */
export function useShopChoice(permission: string, picked: string) {
  const { status } = useAuth();
  const wp = useWorkplaces();
  const ownsShop = wp.active.includes("shop_owner");
  const shop = useQuery({ queryKey: ["vendor-shop"], queryFn: () => shopDesk.profile(), retry: false, enabled: status === "signed_in" && ownsShop });
  const own = shop.data ? [{ id: shop.data.id, name: shop.data.name }] : [];
  const choices = deskChoices("shop", permission, own, wp.named);
  const current = choices.find((c) => c.value === picked) ?? choices[0];
  return {
    choices,
    current,
    shopId: current?.staff ? current.value : undefined,
    perms: current?.staff ? staffPermissionsAt(wp.refs, "shop", current.value) : null,
    ownsShop,
    ready: status !== "signed_in" || (!wp.pending && !(ownsShop && shop.isPending)),
  };
}

/** The shop switcher of a shop desk, shown when there is more than one shop to work on. */
export function ShopSwitch({ choices, value, onChange }: { choices: DeskChoice[]; value: string | undefined; onChange: (v: string) => void }) {
  const t = useTranslations("team.work");
  if (choices.length < 2) return null;
  return (
    <Select id="shop-switch" label={t("shop")} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="w-full sm:max-w-xs" data-testid="shop-switch">
      {choices.map((c) => (
        <option key={c.value} value={c.value}>
          {c.staff && c.owner ? t("atOwner", { name: c.label, owner: c.owner }) : c.label}
        </option>
      ))}
    </Select>
  );
}

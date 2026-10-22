"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { problemOf } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { publicEnv } from "@kriraghor/session/env";
import { ButtonLink, Notice, Select } from "@kriraghor/ui/kit";
import { businessView } from "@/lib/panel-nav";
import { vendor } from "@/lib/vendor/grounds";
import { shopDesk } from "@/lib/vendor/market";
import { deskAccessKey, deskChoices, staffPermissionsAt, team, type DeskChoice } from "@/lib/vendor/team";

/**
 * Round B3: where the signed-in person works as staff. `refs` (from /me, the same query as the
 * sidebar) carry the permissions every desk follows; `named` (GET /me/workplaces) adds the business
 * and owner names for the switchers, only fetched when there is a workplace.
 */
export function useWorkplaces() {
  const { status } = useAuth();
  const signedIn = status === "signed_in";
  const me = useQuery({ queryKey: ["vendor-me"], enabled: signedIn, queryFn: () => vendor.me() });
  const refs = me.data?.workplaces ?? [];
  const named = useQuery({ queryKey: ["my-workplaces"], enabled: signedIn && refs.length > 0, queryFn: () => team.workplaces() });
  return {
    me,
    refs,
    named: named.data?.items ?? [],
    /** Still finding out where the person works (the desks wait, so they never flash a gate). */
    pending: signedIn && (me.isPending || (refs.length > 0 && named.isPending)),
    active: businessView(me.data).active,
    phoneVerified: me.data?.phoneVerified ?? true,
  };
}

/**
 * A desk's access answer in plain words (B3): the owner has not given this permission, verify your
 * phone, or choose a business. Anything else returns null, so the desk shows its own error.
 */
export function DeskAccessNotice({ error, code, className }: { error?: unknown; code?: string; className?: string }) {
  const t = useTranslations("team.access");
  const key = deskAccessKey(code ?? problemOf(error)?.code);
  if (!key) return null;
  return (
    <Notice
      tone={key === "BUSINESS_REQUIRED" ? "info" : "warning"}
      title={t(`${key}.title`)}
      className={className}
      action={
        key === "PHONE_REQUIRED" ? (
          <ButtonLink href={`${publicEnv().WEB_URL}/account/settings`} size="sm" variant="secondary">
            {t("PHONE_REQUIRED.action")}
          </ButtonLink>
        ) : undefined
      }
    >
      {t(`${key}.body`)}
    </Notice>
  );
}

/** The text of a desk error: the access answers in plain words, otherwise the problem's own title. */
export function useDeskErrorText() {
  const t = useTranslations("team.access");
  return (error: unknown, fallback: string) => {
    if (!error) return null;
    const p = problemOf(error);
    const key = deskAccessKey(p?.code);
    return key ? t(`${key}.body`) : (p?.title ?? fallback);
  };
}

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

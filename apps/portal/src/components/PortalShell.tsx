"use client";

import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Briefcase, ShieldStar, SignOut } from "@phosphor-icons/react";
import { api } from "@kriraghor/api-client";
import { AppShell, type ShellGroup } from "@kriraghor/ui/app-shell";
import { useAuth } from "@kriraghor/ui/auth";
import { Dropdown, Tooltip } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { vendor } from "@/lib/vendor/grounds";
import { adminSections, businessView, vendorSections, type NavEntry, type NavSection } from "@/lib/panel-nav";
import type { Area } from "@/lib/area";

/**
 * The portal's desk layout (Claude Design "Panels"): a dark sidebar that collapses to icons in one
 * click, the panel being viewed at the top and the signed-in person at the bottom. Signed out (the
 * sign-in pages), the page shows on its own. Admin items follow the staff member's permissions;
 * vendor items follow the business roles held, and the switcher narrows them to one business
 * (saved on the account as `lastPanelRole`, so it follows the person between devices).
 */
export function PortalShell({ area, children }: { area: Area; children: ReactNode }) {
  const { status } = useAuth();
  if (status === "signed_out") return <>{children}</>;
  return area === "admin" ? <AdminShell signedIn={status === "signed_in"}>{children}</AdminShell> : <VendorShell signedIn={status === "signed_in"}>{children}</VendorShell>;
}

function useGroups(sections: NavSection<NavEntry>[]): ShellGroup[] {
  const t = useTranslations();
  return sections.map((s) => ({
    label: t(`panel.sections.${s.key}`),
    items: s.items.map((it) => ({ href: it.href, label: t(`nav.${it.key}`), icon: it.icon, match: it.match, testId: `side-${it.key}` })),
  }));
}

function AdminShell({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  const t = useTranslations("panel");
  // The same query the desks use (useAdminMe), so the sidebar costs no extra request.
  const me = useQuery({
    queryKey: ["admin-me"],
    enabled: signedIn,
    queryFn: async () => {
      const { data, error } = await api("admin").GET("/admin/me");
      if (error) throw error;
      return data;
    },
  });
  const groups = useGroups(adminSections(me.data));
  const role = me.data?.isMaster ? t("master") : t("staff");
  return (
    <AppShell
      variant="dark"
      title={t("title")}
      groups={groups}
      top={(rail) => <PanelCard rail={rail} icon={<ShieldStar size={22} weight="fill" aria-hidden />} label={t("adminDesk")} />}
      foot={(rail) => (me.data ? <PersonCard rail={rail} name={me.data.displayName} role={role} /> : null)}
    >
      {children}
    </AppShell>
  );
}

function VendorShell({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  const t = useTranslations("panel");
  const qc = useQueryClient();
  // Same key as the vendor home, which reads the same /me.
  const me = useQuery({ queryKey: ["vendor-me"], enabled: signedIn, queryFn: () => vendor.me() });
  // The vendor home follows the same view (businessView), so the menu and the home always agree.
  const { active, view } = businessView(me.data);
  const save = useMutation({
    mutationFn: async (role: string) => {
      const { error } = await api().PATCH("/me", { body: { lastPanelRole: role as never } });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor-me"] }),
  });
  const groups = useGroups(vendorSections(active, view));
  const roleLabel = view === "all" ? (active.length ? active.map((r) => t(`roles.${r}`)).join(" · ") : t("member")) : t(`roles.${view}`);

  return (
    <AppShell
      variant="dark"
      title={t("title")}
      groups={groups}
      top={(rail) =>
        active.length > 1 && !rail ? (
          <div className="px-1 [&_button]:border-band-line [&_button]:bg-band-2 [&_button]:text-band-text [&_label]:text-band-muted" data-testid="panel-switch">
            <Dropdown
              id="panel"
              label={t("viewing")}
              value={view === "all" ? "" : view}
              anyLabel={t("all")}
              // "member" is held by everyone: saved, it means "all my businesses".
              onChange={(v) => save.mutate(v || "member")}
              options={active.map((r) => ({ value: r, label: t(`roles.${r}`) }))}
            />
          </div>
        ) : (
          <PanelCard rail={rail} icon={<Briefcase size={22} weight="fill" aria-hidden />} label={view === "all" ? t("business") : t(`roles.${view}`)} />
        )
      }
      foot={(rail) => (me.data ? <PersonCard rail={rail} name={me.data.displayName} role={roleLabel} /> : null)}
    >
      {children}
    </AppShell>
  );
}

/** "Viewing panel · Admin desk" at the top of the sidebar; the icon alone in the rail. */
function PanelCard({ rail, icon, label }: { rail: boolean; icon: ReactNode; label: string }) {
  const t = useTranslations("panel");
  return (
    <Tooltip content={label} side="right" disabled={!rail}>
      <div className={cn("flex items-center gap-3 rounded-control bg-band-text/8 px-3 py-2.5", rail && "justify-center px-0")} data-testid="panel-card">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-prize text-prize-ink">{icon}</span>
        <span className={cn("min-w-0 leading-tight", rail && "sr-only")}>
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-band-muted">{t("viewing")}</span>
          <span className="block truncate font-display font-bold">{label}</span>
        </span>
      </div>
    </Tooltip>
  );
}

/** The signed-in person: initial, name and role, and sign out. */
function PersonCard({ rail, name, role }: { rail: boolean; name: string; role: string }) {
  const t = useTranslations("panel");
  const { signOut } = useAuth();
  const initial = name.trim().charAt(0).toUpperCase() || "K";
  return (
    <div className={cn("flex items-center gap-3 rounded-control px-2 py-2", rail && "flex-col gap-2 px-0")} data-testid="person-card">
      <Tooltip content={`${name} · ${role}`} side="right" disabled={!rail}>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand font-display font-bold text-on-brand" aria-hidden={!rail} tabIndex={rail ? 0 : undefined}>
          {initial}
        </span>
      </Tooltip>
      <span className={cn("min-w-0 flex-1 leading-tight", rail && "sr-only")}>
        <span className="block truncate font-semibold">{name}</span>
        <span className="block truncate text-xs text-band-muted">{role}</span>
      </span>
      <Tooltip content={t("signOut")} side="right">
        <button type="button" onClick={() => void signOut()} aria-label={t("signOut")} className="inline-flex size-10 shrink-0 items-center justify-center rounded-control text-band-muted hover:bg-band-text/10 hover:text-band-text" data-testid="side-sign-out">
          <SignOut size={20} aria-hidden />
        </button>
      </Tooltip>
    </div>
  );
}

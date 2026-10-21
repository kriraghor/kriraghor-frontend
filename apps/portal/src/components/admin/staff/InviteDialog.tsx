"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CheckCircle, MagnifyingGlass } from "@phosphor-icons/react";
import { Button, Checkbox, Dialog, Field, controlClass, cn } from "@kriraghor/ui/kit";
import { stepUp } from "@/lib/admin/stepUp";
import { EMPLOYEE_ID_MAX, PERMISSIONS, TEAM_MAX, inviteProblem, staffAdmin, type Permission } from "@/lib/admin/staff";
import { SEARCH_MIN, searchQuery, usersAdmin, type AdminUser } from "@/lib/admin/users";
import { CodeDialog } from "../CodeDialog";
import { usePlainProblem } from "../users/ActionDialog";

const SEARCH_WAIT_MS = 400;

/** Why a found member can't be invited (already staff, or the account isn't active), or null. */
function blockedReason(u: AdminUser): "alreadyStaff" | "notActive" | null {
  if (u.roles.some((r) => (r.role === "staff" || r.role === "master_admin") && r.status === "active")) return "alreadyStaff";
  if (u.status !== "active") return "notActive";
  return null;
}

/**
 * Invite a member as staff: find them with the users search (2+ characters, after a pause, since
 * every search is audited), pick one, give an employee id, a team and starting permissions, then
 * confirm with an authenticator code (step-up staff.write). They set up two-factor at next sign-in.
 */
export function InviteDialog({ grantable, onClose, onDone }: { grantable: Set<Permission>; onClose: () => void; onDone: (message: string, userId: string) => Promise<void> }) {
  const t = useTranslations("staffDesk");
  const tc = useTranslations("common");
  const plain = usePlainProblem();
  const [stage, setStage] = useState<"form" | "code">("form");
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState<string | undefined>(undefined);
  const [picked, setPicked] = useState<AdminUser | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [team, setTeam] = useState("");
  const [perms, setPerms] = useState<Set<Permission>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Search only once typing pauses and only with 2+ characters (each search is audited).
  useEffect(() => {
    const timer = setTimeout(() => setQ(searchQuery(draft)), SEARCH_WAIT_MS);
    return () => clearTimeout(timer);
  }, [draft]);
  const found = useQuery({ queryKey: ["staff-invite-search", q], enabled: Boolean(q), queryFn: () => usersAdmin.list({ q }) });
  const results = (found.data?.items ?? []).slice(0, 8);

  const next = () => {
    const bad = inviteProblem({ userId: picked?.id ?? null, employeeId, team });
    if (bad) return setError(t(`invite.problem.${bad}`));
    setError(null);
    setStage("code");
  };

  if (stage === "code" && picked)
    return (
      <CodeDialog
        title={t("invite.confirmTitle", { name: picked.displayName })}
        help={t("invite.confirmHelp")}
        confirmLabel={t("invite.send")}
        onClose={() => setStage("form")}
        onConfirm={async (code) => {
          try {
            const token = await stepUp(code, "staff.write");
            await staffAdmin.invite({ userId: picked.id, employeeId: employeeId.trim(), ...(team.trim() ? { team: team.trim() } : {}), permissions: PERMISSIONS.filter((p) => perms.has(p)) }, token);
            await onDone(t("done.invited", { name: picked.displayName }), picked.id);
          } catch (err) {
            throw plain(err);
          }
        }}
      >
        <p className="text-sm">{t("invite.summary", { employeeId: employeeId.trim(), n: perms.size })}</p>
      </CodeDialog>
    );

  return (
    <Dialog
      open
      onOpenChange={(o) => (o ? undefined : onClose())}
      title={t("invite.title")}
      description={t("invite.help")}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="button" onClick={next} data-testid="staff-invite-next">
            {t("invite.next")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2" data-testid="staff-invite">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("invite.find")}
          <span className="relative">
            <MagnifyingGlass size={18} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setQ(searchQuery(draft));
                }
              }}
              placeholder={t("invite.findPlaceholder")}
              className={cn(controlClass, "pl-10 font-normal")}
              data-testid="staff-invite-search"
              autoFocus
            />
          </span>
        </label>
        {draft.trim() && !searchQuery(draft) ? <p className="text-sm text-muted">{t("invite.searchMin", { n: SEARCH_MIN })}</p> : null}
        {q ? (
          found.isPending ? (
            <p className="text-sm text-muted" role="status">
              {t("invite.searching")}
            </p>
          ) : found.isError ? (
            <p className="text-sm text-danger" role="alert">
              {t("invite.searchFailed")}
            </p>
          ) : !results.length ? (
            <p className="text-sm text-muted">{t("invite.noResults")}</p>
          ) : (
            <ul className="grid gap-1.5" role="listbox" aria-label={t("invite.results")}>
              {results.map((u) => {
                const blocked = blockedReason(u);
                const chosen = picked?.id === u.id;
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={chosen}
                      disabled={Boolean(blocked)}
                      onClick={() => {
                        setPicked(u);
                        setError(null);
                      }}
                      className={cn(
                        "flex min-h-11 w-full items-center justify-between gap-3 rounded-control border px-3 py-2 text-left text-sm",
                        chosen ? "border-brand bg-brand-soft" : "border-line hover:bg-surface-2",
                        blocked && "cursor-not-allowed opacity-60 hover:bg-transparent",
                      )}
                      data-testid="staff-invite-result"
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold">{u.displayName}</span>
                        <span className="block truncate text-xs text-muted">{[u.phone, u.email].filter(Boolean).join(" · ")}</span>
                      </span>
                      {blocked ? <span className="shrink-0 text-xs text-muted">{t(`invite.${blocked}`)}</span> : chosen ? <CheckCircle size={20} weight="fill" className="shrink-0 text-brand-text" aria-hidden /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}
        {picked ? <p className="text-sm">{t("invite.picked", { name: picked.displayName })}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="invite-employee-id" label={t("invite.employeeId")} hint={t("invite.employeeIdHint")} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} maxLength={EMPLOYEE_ID_MAX} />
          <Field id="invite-team" label={t("invite.team")} optional={t("optional")} value={team} onChange={(e) => setTeam(e.target.value)} maxLength={TEAM_MAX} />
        </div>
        <fieldset>
          <legend className="text-sm font-semibold">{t("invite.permissions")}</legend>
          <ul className="mt-1 grid gap-0.5">
            {PERMISSIONS.filter((p) => grantable.has(p)).map((p) => (
              <li key={p}>
                <Checkbox
                  id={`invite-perm-${p}`}
                  checked={perms.has(p)}
                  onChange={(e) =>
                    setPerms((s) => {
                      const n = new Set(s);
                      if (e.target.checked) n.add(p);
                      else n.delete(p);
                      return n;
                    })
                  }
                  label={
                    <span className="block py-1">
                      <span className="font-semibold">{t(`perm.${p}.label`)}</span>
                      <span className="block text-sm text-muted">{t(`perm.${p}.desc`)}</span>
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        </fieldset>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

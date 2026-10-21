"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowCounterClockwise, GenderIntersex, Gavel, LockOpen, PauseCircle, PencilSimple, SignOut } from "@phosphor-icons/react";
import { Badge, Button, ErrorState, Notice, Skeleton } from "@kriraghor/ui/kit";
import { isCurrentStaff, nextRoleStatuses, roleStatusTone, sanctionState, userActions, userStatusTone, usersAdmin, type AdminUser, type RoleName, type RoleStatus, type Viewer } from "@/lib/admin/users";
import { EntityHistory } from "../EntityHistory";
import { formatDhaka } from "../useAdminMe";
import { BanDialog, GenderDialog, RestoreDialog, RoleStatusDialog, SignOutDialog, SuspendDialog, UnbanDialog } from "./UserDialogs";

type Open = { kind: "suspend" | "restore" | "signOut" | "gender" | "ban" | "unban" } | { kind: "role"; role: RoleName; status: RoleStatus };

/** One account on the users desk: facts, actions the viewer may take, roles, sanctions and history. */
export function UserPanel({ id, viewer }: { id: string; viewer: Viewer | null }) {
  const t = useTranslations("usersDesk");
  const locale = useLocale();
  const qc = useQueryClient();
  const [open, setOpen] = useState<Open | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const detail = useQuery({ queryKey: ["admin-user", id], queryFn: () => usersAdmin.get(id) });

  if (detail.isPending) return <Skeleton className="h-64" />;
  if (detail.isError || !detail.data) return <ErrorState onRetry={() => void detail.refetch()} />;
  const u: AdminUser = detail.data;
  const can = userActions(u, viewer);
  const self = viewer?.id === u.id;

  const done = async (message: string) => {
    setOpen(null);
    setMsg(message);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin-user", id] }),
      qc.invalidateQueries({ queryKey: ["admin-users"] }),
      qc.invalidateQueries({ queryKey: ["entity-history", "user", id] }),
    ]);
  };
  const act = (kind: Exclude<Open["kind"], "role">) => {
    setMsg(null);
    setOpen({ kind });
  };

  const facts: [string, React.ReactNode][] = [
    [t("facts.phone"), u.phone ?? t("none")],
    [t("facts.email"), u.email ?? t("none")],
    [t("facts.kyc"), <>{t.has(`kyc.${u.kycStatus}`) ? t(`kyc.${u.kycStatus}`) : u.kycStatus}{u.nidLast4 ? <span className="block text-xs text-muted">{t("nidLast4", { last4: u.nidLast4 })}</span> : null}</>],
    [
      t("facts.gender"),
      <>
        {u.gender ? t(`gender.${u.gender}`) : t("notSet")}
        {u.genderSource ? <span className="block text-xs text-muted">{t(`genderSource.${u.genderSource}`)}</span> : null}
      </>,
    ],
    [t("facts.language"), u.locale === "bn" ? "বাংলা" : "English"],
    [t("facts.lastLogin"), u.lastLoginAt ? formatDhaka(u.lastLoginAt, locale) : t("never")],
    [t("facts.joined"), formatDhaka(u.createdAt, locale)],
  ];

  const anyAction = can.suspend || can.restore || can.signOut || can.gender || can.ban || can.unban;

  return (
    <div data-testid="admin-user">
      <p className="text-lg font-bold">{u.displayName}</p>
      {u.username ? <p className="text-sm text-muted">@{u.username}</p> : null}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge tone={userStatusTone(u.status)}>{t(`status.${u.status}`)}</Badge>
        {isCurrentStaff(u) ? <Badge tone="info">{u.staff?.isMaster ? t("masterBadge") : t("staffBadge")}</Badge> : null}
      </div>

      <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>

      {msg ? (
        <Notice tone="success" className="mt-4">
          {msg}
        </Notice>
      ) : null}
      {self ? (
        <Notice tone="info" className="mt-4">
          {t("selfNote")}
        </Notice>
      ) : isCurrentStaff(u) && !viewer?.isMaster ? (
        <Notice tone="info" className="mt-4">
          {t("staffNote")}
        </Notice>
      ) : null}

      {anyAction ? (
        <div className="mt-4 flex flex-wrap gap-2" data-testid="user-actions">
          {can.suspend ? (
            <Button type="button" variant="secondary" size="sm" icon={<PauseCircle size={18} aria-hidden />} onClick={() => act("suspend")} data-testid="user-suspend-open">
              {t("actions.suspend")}
            </Button>
          ) : null}
          {can.restore ? (
            <Button type="button" variant="secondary" size="sm" icon={<ArrowCounterClockwise size={18} aria-hidden />} onClick={() => act("restore")} data-testid="user-restore-open">
              {t("actions.restore")}
            </Button>
          ) : null}
          {can.signOut ? (
            <Button type="button" variant="secondary" size="sm" icon={<SignOut size={18} aria-hidden />} onClick={() => act("signOut")} data-testid="user-sign-out-open">
              {t("actions.signOut")}
            </Button>
          ) : null}
          {can.gender ? (
            <Button type="button" variant="secondary" size="sm" icon={<GenderIntersex size={18} aria-hidden />} onClick={() => act("gender")} data-testid="user-gender-open">
              {t("actions.gender")}
            </Button>
          ) : null}
          {can.ban ? (
            <Button type="button" variant="danger" size="sm" icon={<Gavel size={18} aria-hidden />} onClick={() => act("ban")} data-testid="user-ban-open">
              {t("actions.ban")}
            </Button>
          ) : null}
          {can.unban ? (
            <Button type="button" variant="secondary" size="sm" icon={<LockOpen size={18} aria-hidden />} onClick={() => act("unban")} data-testid="user-unban-open">
              {t("actions.unban")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {u.status === "banned" && !viewer?.isMaster && !self ? <p className="mt-3 text-sm text-muted">{t("banMasterOnly")}</p> : null}

      <h3 className="mt-6 text-base font-bold">{t("rolesTitle")}</h3>
      <ul className="mt-2 divide-y divide-line text-sm" data-testid="user-roles">
        {u.roles.map((r) => {
          const next = can.roles ? nextRoleStatuses(r.role, r.status) : [];
          return (
            <li key={r.role} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0">
                <span className="font-semibold">{t(`role.${r.role}`)}</span>
                {r.reasonCode ? <span className="block text-xs text-muted">{t.has(`reasons.${r.reasonCode}`) ? t(`reasons.${r.reasonCode}`) : r.reasonCode}</span> : null}
              </span>
              <span className="flex items-center gap-2">
                <Badge tone={roleStatusTone(r.status)}>{t(`roleStatus.${r.status}`)}</Badge>
                {next.length ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={<PencilSimple size={16} aria-hidden />}
                    onClick={() => {
                      setMsg(null);
                      setOpen({ kind: "role", role: r.role, status: r.status });
                    }}
                    aria-label={t("changeRoleStatusFor", { role: t(`role.${r.role}`) })}
                    data-testid={`role-change-${r.role}`}
                  >
                    {t("changeStatus")}
                  </Button>
                ) : null}
              </span>
            </li>
          );
        })}
        {!u.roles.length ? <li className="py-2 text-muted">{t("noRoles")}</li> : null}
      </ul>

      <h3 className="mt-6 text-base font-bold">{t("sanctionsTitle")}</h3>
      <ul className="mt-2 grid gap-2 text-sm" data-testid="user-sanctions">
        {u.sanctions.map((s) => {
          const state = sanctionState(s, now);
          return (
            <li key={s.id} className="border-l-4 border-line pl-3">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {t.has(`sanctionKind.${s.kind}`) ? t(`sanctionKind.${s.kind}`) : s.kind}
                {s.role ? <span className="font-normal text-muted">{t.has(`role.${s.role}`) ? t(`role.${s.role}`) : s.role}</span> : null}
                <Badge tone={state === "active" ? "danger" : "neutral"}>{t(`sanctionState.${state}`)}</Badge>
              </p>
              <p className="text-muted">
                {t.has(`reasons.${s.reasonCode}`) ? t(`reasons.${s.reasonCode}`) : s.reasonCode} · {formatDhaka(s.startsAt, locale)}
                {s.endsAt ? ` – ${formatDhaka(s.endsAt, locale)}` : ""}
              </p>
              {s.note ? <p className="mt-0.5 break-words">{s.note}</p> : null}
              {s.liftedAt ? <p className="text-xs text-muted">{t("liftedAt", { when: formatDhaka(s.liftedAt, locale) })}</p> : null}
            </li>
          );
        })}
        {!u.sanctions.length ? <li className="text-muted">{t("noSanctions")}</li> : null}
      </ul>

      <EntityHistory entityType="user" entityId={u.id} />

      {open?.kind === "suspend" ? <SuspendDialog user={u} onClose={() => setOpen(null)} onDone={done} /> : null}
      {open?.kind === "restore" ? <RestoreDialog user={u} onClose={() => setOpen(null)} onDone={done} /> : null}
      {open?.kind === "signOut" ? <SignOutDialog user={u} onClose={() => setOpen(null)} onDone={done} /> : null}
      {open?.kind === "gender" ? <GenderDialog user={u} onClose={() => setOpen(null)} onDone={done} /> : null}
      {open?.kind === "ban" ? <BanDialog user={u} onClose={() => setOpen(null)} onDone={done} /> : null}
      {open?.kind === "unban" ? <UnbanDialog user={u} onClose={() => setOpen(null)} onDone={done} /> : null}
      {open?.kind === "role" ? <RoleStatusDialog user={u} role={open.role} status={open.status} onClose={() => setOpen(null)} onDone={done} /> : null}
    </div>
  );
}

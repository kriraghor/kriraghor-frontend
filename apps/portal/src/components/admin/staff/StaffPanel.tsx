"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Crown, FloppyDisk, Key, UserMinus } from "@phosphor-icons/react";
import { Badge, Button, Checkbox, Field, Notice } from "@kriraghor/ui/kit";
import { stepUp } from "@/lib/admin/stepUp";
import { PERMISSIONS, REASON_MAX, REASON_MIN, permissionDiff, staffActions, staffAdmin, staffStatusTone, type Permission, type StaffRow } from "@/lib/admin/staff";
import { CodeDialog } from "../CodeDialog";
import { EntityHistory } from "../EntityHistory";
import { formProblem, usePlainProblem } from "../users/ActionDialog";

type Open = "save" | "offboard" | "reset2fa" | "promote" | null;

/**
 * One staff member: their permissions as a checklist (grantable ones editable, master-only ones
 * shown locked), saved in one change with a reason and an authenticator code; offboard, reset
 * two-factor and promote to master, each behind a fresh code.
 */
export function StaffPanel({ row, grantable, viewerId, masters, onChanged }: { row: StaffRow; grantable: Set<Permission>; viewerId: string | null; masters: number; onChanged: () => Promise<void> }) {
  const t = useTranslations("staffDesk");
  const plain = usePlainProblem();
  const can = staffActions(row, viewerId, masters);
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(row.permissions));
  const [open, setOpen] = useState<Open>(null);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  // A saved change (or another master's) refreshes the row: start again from what is saved.
  const savedKey = row.permissions.join(",");
  const [seen, setSeen] = useState(savedKey);
  if (seen !== savedKey) {
    setSeen(savedKey);
    setTicked(new Set(row.permissions));
  }
  const diff = permissionDiff(row.permissions, ticked, grantable);
  const dirty = diff.grant.length + diff.revoke.length > 0;

  const toggle = (p: Permission, on: boolean) => {
    setMsg(null);
    setTicked((s) => {
      const next = new Set(s);
      if (on) next.add(p);
      else next.delete(p);
      return next;
    });
  };
  const finish = async (message: string) => {
    setOpen(null);
    setReason("");
    setMsg(message);
    await onChanged();
  };
  const close = () => {
    setOpen(null);
    setReason("");
  };

  return (
    <div data-testid="staff-member">
      <p className="text-lg font-bold">{row.displayName}</p>
      <p className="font-mono text-xs text-muted">{row.employeeId}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge tone={staffStatusTone(row.status)}>{t(`status.${row.status}`)}</Badge>
        {row.isMaster ? <Badge tone="prize">{t("master")}</Badge> : null}
        <Badge tone={row.twoFactorEnabled ? "brand" : "warning"}>{row.twoFactorEnabled ? t("twoFactorOn") : t("twoFactorOff")}</Badge>
      </div>
      <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">{t("facts.team")}</dt>
        <dd>{row.team ?? t("noTeam")}</dd>
        <dt className="text-muted">{t("facts.phone")}</dt>
        <dd className="font-mono text-xs">{row.phone ?? t("none")}</dd>
        <dt className="text-muted">{t("facts.email")}</dt>
        <dd className="break-all">{row.email ?? t("none")}</dd>
      </dl>

      {msg ? (
        <Notice tone="success" className="mt-4">
          {msg}
        </Notice>
      ) : null}

      <h3 className="mt-6 text-base font-bold">{t("permissionsTitle")}</h3>
      {row.isMaster ? <p className="mt-1 text-sm text-muted">{t("masterHoldsAll")}</p> : row.status === "offboarded" ? <p className="mt-1 text-sm text-muted">{t("offboardedNoPermissions")}</p> : null}
      <ul className="mt-2 grid gap-1" data-testid="staff-permissions">
        {PERMISSIONS.map((p) => {
          const editable = can.editPermissions && grantable.has(p);
          return (
            <li key={p}>
              <Checkbox
                id={`perm-${row.userId}-${p}`}
                checked={row.isMaster || (can.editPermissions ? ticked.has(p) : row.permissions.includes(p))}
                disabled={!editable}
                onChange={(e) => toggle(p, e.target.checked)}
                label={
                  <span className="block py-1">
                    <span className="font-semibold">{t(`perm.${p}.label`)}</span>
                    {!grantable.has(p) ? <span className="ml-2 text-xs text-muted">{t("mastersOnly")}</span> : null}
                    <span className="block text-sm text-muted">{t(`perm.${p}.desc`)}</span>
                  </span>
                }
              />
            </li>
          );
        })}
      </ul>
      {can.editPermissions ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" icon={<FloppyDisk size={18} aria-hidden />} disabled={!dirty} onClick={() => setOpen("save")} data-testid="staff-permissions-save">
            {t("savePermissions")}
          </Button>
          {dirty ? (
            <Button type="button" variant="ghost" onClick={() => setTicked(new Set(row.permissions))}>
              {t("undoChanges")}
            </Button>
          ) : null}
          {dirty ? <span className="text-sm text-muted">{t("pendingChanges", { grant: diff.grant.length, revoke: diff.revoke.length })}</span> : null}
        </div>
      ) : null}

      {can.offboard || can.reset2fa || can.promote ? (
        <>
          <h3 className="mt-6 text-base font-bold">{t("accountTitle")}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {can.promote ? (
              <Button type="button" variant="secondary" size="sm" icon={<Crown size={18} aria-hidden />} onClick={() => setOpen("promote")} data-testid="staff-promote-open">
                {t("promote")}
              </Button>
            ) : null}
            {can.reset2fa ? (
              <Button type="button" variant="secondary" size="sm" icon={<Key size={18} aria-hidden />} onClick={() => setOpen("reset2fa")} data-testid="staff-reset2fa-open">
                {t("reset2fa")}
              </Button>
            ) : null}
            {can.offboard ? (
              <Button type="button" variant="danger" size="sm" icon={<UserMinus size={18} aria-hidden />} onClick={() => setOpen("offboard")} data-testid="staff-offboard-open">
                {t("offboard")}
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
      {row.userId === viewerId ? <p className="mt-3 text-sm text-muted">{t("selfNote")}</p> : null}
      {row.isMaster && row.status === "active" && masters <= 1 ? <p className="mt-3 text-sm text-muted">{t("lastMasterNote")}</p> : null}

      <EntityHistory entityType="user" entityId={row.userId} />

      {open === "save" ? (
        <CodeDialog
          title={t("saveTitle", { name: row.displayName })}
          help={t("saveHelp")}
          confirmLabel={t("savePermissions")}
          onClose={close}
          onConfirm={async (code) => {
            if (reason.trim().length < REASON_MIN) throw formProblem(t("form.reasonShort", { n: REASON_MIN }));
            try {
              const token = await stepUp(code, "staff.write");
              const res = await staffAdmin.setPermissions([{ userId: row.userId, ...diff }], reason.trim(), token);
              await finish(t("done.saved", { n: res.applied }));
            } catch (err) {
              throw plain(err);
            }
          }}
        >
          <ul className="mb-3 grid gap-1 text-sm">
            {diff.grant.map((p) => (
              <li key={`g-${p}`}>{t("willGrant", { permission: t(`perm.${p}.label`) })}</li>
            ))}
            {diff.revoke.map((p) => (
              <li key={`r-${p}`}>{t("willRevoke", { permission: t(`perm.${p}.label`) })}</li>
            ))}
          </ul>
          <Field id="staff-perm-reason" label={t("reason")} hint={t("reasonHint", { n: REASON_MIN })} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={REASON_MAX} />
        </CodeDialog>
      ) : null}

      {open === "offboard" ? (
        <CodeDialog
          title={t("offboardTitle", { name: row.displayName })}
          help={t("offboardHelp")}
          confirmLabel={t("offboard")}
          onClose={close}
          onConfirm={async (code) => {
            if (reason.trim().length < REASON_MIN) throw formProblem(t("form.reasonShort", { n: REASON_MIN }));
            try {
              const token = await stepUp(code, "staff.write");
              await staffAdmin.offboard(row.userId, reason.trim(), token);
              await finish(t("done.offboarded"));
            } catch (err) {
              throw plain(err);
            }
          }}
        >
          <Field id="staff-offboard-reason" label={t("reason")} hint={t("reasonHint", { n: REASON_MIN })} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} />
        </CodeDialog>
      ) : null}

      {open === "reset2fa" ? (
        <CodeDialog
          title={t("reset2faTitle", { name: row.displayName })}
          help={t("reset2faHelp")}
          confirmLabel={t("reset2fa")}
          onClose={close}
          onConfirm={async (code) => {
            try {
              const token = await stepUp(code, "twofa.reset");
              await staffAdmin.reset2fa(row.userId, token);
              await finish(t("done.reset2fa"));
            } catch (err) {
              throw plain(err);
            }
          }}
        />
      ) : null}

      {open === "promote" ? (
        <CodeDialog
          title={t("promoteTitle", { name: row.displayName })}
          help={t("promoteHelp")}
          confirmLabel={t("promote")}
          onClose={close}
          onConfirm={async (code) => {
            try {
              const token = await stepUp(code, "staff.write");
              await staffAdmin.promote(row.userId, token);
              await finish(t("done.promoted"));
            } catch (err) {
              throw plain(err);
            }
          }}
        />
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Select, Textarea, Field } from "@kriraghor/ui/kit";
import { stepUp } from "@/lib/admin/stepUp";
import { dhakaDate } from "@/lib/admin/finance";
import {
  GENDERS,
  MAX_SUSPENSION_DAYS,
  REASON_CODES,
  nextRoleStatuses,
  roleStatusNeedsReason,
  untilIso,
  untilProblem,
  usersAdmin,
  type AdminUser,
  type Gender,
  type ReasonCode,
  type RoleName,
  type RoleStatus,
  type SettableRoleStatus,
} from "@/lib/admin/users";
import { CodeDialog } from "../CodeDialog";
import { ActionDialog, formProblem, usePlainProblem } from "./ActionDialog";

const NOTE_MIN = 5;
const NOTE_MAX = 2000;

type Done = (message: string) => Promise<void> | void;

function ReasonSelect({ id, value, onChange, optional }: { id: string; value: string; onChange: (v: string) => void; optional?: boolean }) {
  const t = useTranslations("usersDesk");
  return (
    <Select id={id} label={t("reasonCode")} value={value} onChange={(e) => onChange(e.target.value)} optional={optional ? t("optional") : undefined}>
      <option value="">{t("pickReason")}</option>
      {REASON_CODES.map((r) => (
        <option key={r} value={r}>
          {t(`reasons.${r}`)}
        </option>
      ))}
    </Select>
  );
}

/** Suspend: a reason code, a note (5–2000) and an optional end date (at most a year away). */
export function SuspendDialog({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: Done }) {
  const t = useTranslations("usersDesk");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [until, setUntil] = useState("");
  const [{ today, last }] = useState(() => {
    const now = Date.now();
    return { today: dhakaDate(now), last: dhakaDate(now + (MAX_SUSPENSION_DAYS - 1) * 24 * 3600 * 1000) };
  });
  return (
    <ActionDialog
      testId="user-suspend"
      title={t("suspendTitle", { name: user.displayName })}
      description={t("suspendHelp")}
      confirmLabel={t("actions.suspend")}
      danger
      onClose={onClose}
      onConfirm={async () => {
        if (!reason) return t("form.reasonNeeded");
        if (note.trim().length < NOTE_MIN) return t("form.noteShort", { n: NOTE_MIN });
        const bad = untilProblem(until, Date.now());
        if (bad) return t(`form.until.${bad}`);
        const res = await usersAdmin.suspend(user.id, { reasonCode: reason as ReasonCode, note: note.trim(), ...(until ? { until: untilIso(until) } : {}) });
        await onDone(t("done.suspended", { n: res.sessionsRevoked }));
      }}
    >
      <ReasonSelect id="suspend-reason" value={reason} onChange={setReason} />
      <Textarea id="suspend-note" label={t("note")} hint={t("noteHint", { n: NOTE_MIN })} value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX} />
      <Field id="suspend-until" type="date" label={t("until")} hint={t("untilHint")} optional={t("optional")} value={until} min={today} max={last} onChange={(e) => setUntil(e.target.value)} />
    </ActionDialog>
  );
}

/** Lift a suspension (never a ban): an optional note. */
export function RestoreDialog({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: Done }) {
  const t = useTranslations("usersDesk");
  const [note, setNote] = useState("");
  return (
    <ActionDialog
      testId="user-restore"
      title={t("restoreTitle", { name: user.displayName })}
      description={t("restoreHelp")}
      confirmLabel={t("actions.restore")}
      onClose={onClose}
      onConfirm={async () => {
        await usersAdmin.restore(user.id, note.trim() || undefined);
        await onDone(t("done.restored"));
      }}
    >
      <Textarea id="restore-note" label={t("note")} optional={t("optional")} value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX} />
    </ActionDialog>
  );
}

/** Sign out everywhere: a confirmation. */
export function SignOutDialog({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: Done }) {
  const t = useTranslations("usersDesk");
  return (
    <ActionDialog
      testId="user-sign-out"
      title={t("signOutTitle", { name: user.displayName })}
      description={t("signOutHelp")}
      confirmLabel={t("actions.signOut")}
      danger
      onClose={onClose}
      onConfirm={async () => {
        const res = await usersAdmin.signOut(user.id);
        await onDone(t("done.signedOut", { n: res.sessionsRevoked }));
      }}
    />
  );
}

/** Correct the member's gender (M16): the new value and a reason (5–255). */
export function GenderDialog({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: Done }) {
  const t = useTranslations("usersDesk");
  const [gender, setGender] = useState<string>(user.gender ?? "");
  const [reason, setReason] = useState("");
  return (
    <ActionDialog
      testId="user-gender"
      title={t("genderTitle", { name: user.displayName })}
      description={t("genderHelp")}
      confirmLabel={t("save")}
      onClose={onClose}
      onConfirm={async () => {
        if (!gender) return t("form.genderNeeded");
        if (reason.trim().length < 5) return t("form.noteShort", { n: 5 });
        await usersAdmin.gender(user.id, gender as Gender, reason.trim());
        await onDone(t("done.gender"));
      }}
    >
      <Select id="gender-value" label={t("facts.gender")} value={gender} onChange={(e) => setGender(e.target.value)}>
        <option value="">{t("pickGender")}</option>
        {GENDERS.map((g) => (
          <option key={g} value={g}>
            {t(`gender.${g}`)}
          </option>
        ))}
      </Select>
      <Field id="gender-reason" label={t("reason")} hint={t("noteHint", { n: 5 })} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} />
    </ActionDialog>
  );
}

/** Move a role to a status its current one allows; suspending, rejecting or asking for changes needs a reason. */
export function RoleStatusDialog({ user, role, status, onClose, onDone }: { user: AdminUser; role: RoleName; status: RoleStatus; onClose: () => void; onDone: Done }) {
  const t = useTranslations("usersDesk");
  const options = nextRoleStatuses(role, status);
  const [next, setNext] = useState<string>(options[0] ?? "");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const needsReason = Boolean(next) && roleStatusNeedsReason(next as SettableRoleStatus);
  return (
    <ActionDialog
      testId="user-role-status"
      title={t("roleTitle", { role: t(`role.${role}`) })}
      description={t("roleHelp", { status: t(`roleStatus.${status}`) })}
      confirmLabel={t("save")}
      onClose={onClose}
      onConfirm={async () => {
        if (!next) return t("form.statusNeeded");
        if (needsReason && !reason) return t("form.reasonNeeded");
        await usersAdmin.setRoleStatus(user.id, role, { status: next as SettableRoleStatus, ...(reason ? { reasonCode: reason } : {}), ...(note.trim() ? { note: note.trim() } : {}) });
        await onDone(t("done.role", { role: t(`role.${role}`), status: t(`roleStatus.${next}`) }));
      }}
    >
      <Select id="role-next" label={t("newStatus")} value={next} onChange={(e) => setNext(e.target.value)}>
        {options.map((s) => (
          <option key={s} value={s}>
            {t(`roleStatus.${s}`)}
          </option>
        ))}
      </Select>
      <ReasonSelect id="role-reason" value={reason} onChange={setReason} optional={!needsReason} />
      <Textarea id="role-note" label={t("note")} optional={t("optional")} value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX} />
    </ActionDialog>
  );
}

/** Ban (master): a reason code and note, then a fresh authenticator code (step-up user.ban). */
export function BanDialog({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: Done }) {
  const t = useTranslations("usersDesk");
  const plain = usePlainProblem();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  return (
    <CodeDialog
      title={t("banTitle", { name: user.displayName })}
      help={t("banHelp")}
      confirmLabel={t("actions.ban")}
      onClose={onClose}
      onConfirm={async (code) => {
        if (!reason) throw formProblem(t("form.reasonNeeded"));
        if (note.trim().length < NOTE_MIN) throw formProblem(t("form.noteShort", { n: NOTE_MIN }));
        try {
          const token = await stepUp(code, "user.ban");
          const res = await usersAdmin.ban(user.id, { reasonCode: reason as ReasonCode, note: note.trim() }, token);
          await onDone(t("done.banned", { n: res.sessionsRevoked }));
        } catch (err) {
          throw plain(err);
        }
      }}
    >
      <div className="flex flex-col gap-4">
        <ReasonSelect id="ban-reason" value={reason} onChange={setReason} />
        <Textarea id="ban-note" label={t("note")} hint={t("noteHint", { n: NOTE_MIN })} value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX} />
      </div>
    </CodeDialog>
  );
}

/** Lift a ban (master): a note (5–2000), then a fresh authenticator code (step-up user.ban). */
export function UnbanDialog({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: Done }) {
  const t = useTranslations("usersDesk");
  const plain = usePlainProblem();
  const [note, setNote] = useState("");
  return (
    <CodeDialog
      title={t("unbanTitle", { name: user.displayName })}
      help={t("unbanHelp")}
      confirmLabel={t("actions.unban")}
      onClose={onClose}
      onConfirm={async (code) => {
        if (note.trim().length < NOTE_MIN) throw formProblem(t("form.noteShort", { n: NOTE_MIN }));
        try {
          const token = await stepUp(code, "user.ban");
          await usersAdmin.unban(user.id, note.trim(), token);
          await onDone(t("done.unbanned"));
        } catch (err) {
          throw plain(err);
        }
      }}
    >
      <Textarea id="unban-note" label={t("note")} hint={t("noteHint", { n: NOTE_MIN })} value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX} />
    </CodeDialog>
  );
}

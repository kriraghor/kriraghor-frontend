"use client";

import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowArcLeft, ArrowCounterClockwise, Barbell, CalendarBlank, Eye, LinkSimple, NotePencil, PencilSimple, Snowflake, UserMinus } from "@phosphor-icons/react";
import { newKey } from "@kriraghor/ui/format";
import { Avatar, Badge, Button, Card, Checkbox, Dialog, Field, Notice, PhoneField, ReasonDialog, Select, Skeleton, Textarea, useToast } from "@kriraghor/ui/kit";
import { birthRange, memberProblems } from "@/lib/validate";
import { cn } from "@kriraghor/ui/cn";
import { gymBody } from "@/lib/gym-progress";
import { BodyProgressView } from "@/components/gym-member/BodyProgress";
import {
  addDays,
  dhakaToday,
  dueActions,
  featureLocked,
  gymManage,
  LEFT_REASONS,
  membershipActions,
  monthOf,
  reversible,
  takaToPoisha,
  type Due,
  type FeePayment,
  type LeftReason,
  type Membership,
  type Payment,
  type Profile,
} from "@/lib/gym-manage";
import { MonthCalendar } from "./MonthCalendar";
import { MemberPlans } from "./MemberPlans";
import { useTrainers } from "./Members";
import { GymPage, MemberStatus, Row, useFmt, useGymError, useDeskPackages, type GymCtx } from "./common";
import { emptyPayment, PayDialog, PaymentFields, paymentBody, ReceiptLink, WaiveDialog } from "./money";
import { OnlineCharge, PaymentLinkDialog, RefundDialog } from "./online";
import { DatePicker } from "@kriraghor/ui/date";
import { MemberWhatsappCard } from "./Whatsapp";
import { WaReceiptButton, useWaSending } from "./wa-parts";

/**
 * /manage/[gymId]/members/[memberId] (M24 §4.1): the member's profile. The person and the link to
 * their Kriraghor account (invite, unlink), memberships (assign, renew, freeze, unfreeze, change,
 * cancel), WhatsApp choices (M24-FR-159), the trainer (feature trainers, FR-21), the plans (feature plans, FR-64 to FR-66), dues with their payments (collect, waive, reverse, receipt), the check-in calendar, notes,
 * and mark left, re-join or remove. Each action follows the profile's `can` and the permissions; the
 * API decides (M24-FR-12 to FR-36).
 */
export function MemberProfile({ gymId, memberId }: { gymId: string; memberId: string }) {
  const t = useTranslations("gm");
  return (
    <GymPage gymId={gymId} page="members" title={t("profile.title")} back={{ href: `/manage/${gymId}/members`, label: t("members.title") }} testId="gm-member">
      {(ctx) => <Body ctx={ctx} memberId={memberId} />}
    </GymPage>
  );
}

/** Run one action: busy state, the friendly error, then refresh the member and the lists. */
function useAct(gymId: string, memberId: string) {
  const qc = useQueryClient();
  const err = useGymError();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const refresh = async () => {
    await Promise.all(
      [["gm-member", gymId, memberId], ["gm-members", gymId], ["gm-overview", gymId], ["gm-dues", gymId], ["gm-attendance", gymId, memberId], ["gm-notes", gymId, memberId]].map((k) => qc.invalidateQueries({ queryKey: k })),
    );
  };
  const run = async <T,>(fn: () => Promise<T>, done?: string): Promise<T | null> => {
    setBusy(true);
    setProblem(null);
    try {
      const r = await fn();
      await refresh();
      if (done) toast.show(done);
      return r;
    } catch (e) {
      setProblem(err(e));
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { busy, problem, setProblem, run, refresh };
}

function Body({ ctx, memberId }: { ctx: GymCtx; memberId: string }) {
  const err = useGymError();
  const { gymId } = ctx;
  const q = useQuery({ queryKey: ["gm-member", gymId, memberId], queryFn: () => gymManage.member(gymId, memberId) });
  if (q.isPending) return <Skeleton className="h-96 rounded-card" />;
  if (q.isError) return <Notice tone="error">{err(q.error)}</Notice>;
  const p = q.data;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Person ctx={ctx} p={p} />
        {/* M24-FR-159: the member's WhatsApp choices; changed only by staff who edit members, with the member's word. */}
        <MemberWhatsappCard ctx={ctx} memberId={memberId} name={p.member.displayName} canEdit={p.can.edit && ctx.can("members.edit") && p.member.status !== "removed"} />
        <Memberships ctx={ctx} p={p} />
        <Trainer ctx={ctx} p={p} />
        <MemberPlans ctx={ctx} p={p} />
        <Progress ctx={ctx} memberId={memberId} />
      </div>
      <div className="flex flex-col gap-4">
        <Dues ctx={ctx} p={p} />
        <CheckinCalendar gymId={gymId} memberId={memberId} />
        <Notes gymId={gymId} memberId={memberId} />
        <Lifecycle ctx={ctx} p={p} />
      </div>
    </div>
  );
}

/**
 * Body progress on the profile (M24-FR-131): for the owner and staff who write plans, on a plan that has
 * it. A trainer who only sees their own members gets nothing for anyone else (the API answers 404).
 */
function Progress({ ctx, memberId }: { ctx: GymCtx; memberId: string }) {
  const qc = useQueryClient();
  const on = (ctx.owner || ctx.can("plans.manage")) && !featureLocked(ctx.gym.features, "progress");
  const key = ["gm-body", ctx.gymId, memberId];
  const q = useQuery({ queryKey: key, queryFn: () => gymBody.forMember(ctx.gymId, memberId), enabled: on, retry: false });
  if (!on || !q.data) return null;
  const saved = async (fresh: Awaited<ReturnType<typeof gymBody.forMember>>) => {
    qc.setQueryData(key, fresh);
    await qc.invalidateQueries({ queryKey: ["gm-member", ctx.gymId, memberId] });
  };
  return (
    <BodyProgressView
      data={q.data}
      forStaff
      testId="profile-body"
      onAdd={async (body, idem) => saved(await gymBody.addFor(ctx.gymId, memberId, body, idem))}
      onRemove={async (entryId) => saved(await gymBody.voidFor(ctx.gymId, memberId, entryId))}
      canRemove={() => true}
    />
  );
}

function Section({ title, actions, children, testId }: { title: ReactNode; actions?: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <Card padded={false} className="p-4" data-testid={testId}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </Card>
  );
}

// ---------------------------------------------------------------- the trainer

/**
 * The member's trainer (M24-FR-21, feature trainers): staff with members.edit choose one of the gym's
 * trainers or none. The API checks the trainer and audits the change; a trainer sees only their members.
 */
function Trainer({ ctx, p }: { ctx: GymCtx; p: Profile }) {
  const t = useTranslations("gm");
  const m = p.member;
  const act = useAct(ctx.gymId, m.id);
  const canEdit = ctx.can("members.edit") && m.status !== "removed";
  const trainers = useTrainers(ctx, canEdit);
  const [choice, setChoice] = useState<string | null>(null);
  if (featureLocked(ctx.gym.features, "trainers") || (!m.trainer && !canEdit)) return null;
  const current = m.trainer?.businessMemberId ?? "";
  const value = choice ?? current;
  const save = async () => {
    if (await act.run(() => gymManage.setTrainer(ctx.gymId, m.id, value || null), value ? t("profile.trainerSet") : t("profile.trainerCleared"))) setChoice(null);
  };
  return (
    <Section title={t("profile.trainer")} testId="profile-trainer" actions={<Barbell size={20} aria-hidden className="text-muted" />}>
      {!canEdit ? (
        <p>{m.trainer?.displayName ?? t("members.trainerNoName")}</p>
      ) : !trainers.length && !m.trainer ? (
        <p className="text-sm text-muted">{t("profile.noTrainers")}</p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <Select id="member-trainer" label={t("profile.trainerPick")} value={value} onChange={(e) => setChoice(e.target.value)} className="min-w-56" data-testid="member-trainer">
            <option value="">{t("profile.noTrainer")}</option>
            {m.trainer && !trainers.some((tr) => tr.businessMemberId === current) ? <option value={current}>{m.trainer.displayName ?? t("members.trainerNoName")}</option> : null}
            {trainers.map((tr) => (
              <option key={tr.businessMemberId} value={tr.businessMemberId}>
                {tr.displayName ?? t("members.trainerNoName")} · {t("profile.trainerCount", { n: tr.assignedMembers })}
              </option>
            ))}
          </Select>
          <Button type="button" size="sm" busy={act.busy} disabled={value === current} onClick={() => void save()} confirm="save" data-testid="member-trainer-save">
            {t("save")}
          </Button>
        </div>
      )}
      {act.problem ? <p role="alert" className="mt-2 text-sm text-danger">{act.problem}</p> : null}
    </Section>
  );
}

// ---------------------------------------------------------------- the person and the account link

function Person({ ctx, p }: { ctx: GymCtx; p: Profile }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const m = p.member;
  const act = useAct(ctx.gymId, m.id);
  const [phone, setPhone] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const reveal = async () => {
    const r = await act.run(() => gymManage.revealPhone(ctx.gymId, m.id));
    if (r) setPhone(r.phone);
  };
  return (
    <Section title={t("profile.person")} testId="profile-person" actions={p.can.edit && m.status !== "removed" ? <Button type="button" size="sm" variant="secondary" icon={<PencilSimple size={16} aria-hidden />} onClick={() => setEditing(true)}>{t("edit")}</Button> : null}>
      <div className="flex items-start gap-3">
        <Avatar name={m.displayName} size={56} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-extrabold" data-testid="profile-name">
            {m.displayName}
          </p>
          <p className="text-sm text-muted tabular-nums">
            {m.memberCode} · {t("profile.joined", { date: f.date(m.joinedOn) })}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            <MemberStatus status={m.status} />
            <Badge>{t(`source.${m.source}`)}</Badge>
          </div>
        </div>
      </div>
      <div className="mt-3 divide-y divide-line">
        <Row label={t("member.phone")}>
          <span className="inline-flex items-center gap-2">
            <span data-testid="profile-phone">{phone ?? `•••• ${m.phoneLast4}`}</span>
            {!phone && p.can.revealPhone ? (
              <Button type="button" size="sm" variant="ghost" icon={<Eye size={16} aria-hidden />} onClick={reveal} busy={act.busy} data-testid="reveal-phone">
                {t("profile.reveal")}
              </Button>
            ) : null}
          </span>
        </Row>
        {m.gender ? <Row label={t("member.gender")}>{t(`gender.${m.gender}`)}</Row> : null}
        {m.birthDate ? <Row label={t("member.birthDate")}>{f.date(m.birthDate)}</Row> : null}
        {m.email ? <Row label={t("member.email")}>{m.email}</Row> : null}
        {m.emergencyContact ? <Row label={t("member.emergency")}>{`${m.emergencyContact.name} · ${m.emergencyContact.phone}`}</Row> : null}
        {m.healthNote ? <Row label={t("member.healthNote")}>{m.healthNote}</Row> : null}
        {m.bloodGroup ? <Row label={t("health.bloodGroup")}>{m.bloodGroup}</Row> : null}
        {m.heightCm || m.weightKg ? (
          <Row label={t("health.body")}>
            {[m.heightCm ? t("health.cm", { n: f.n(m.heightCm) }) : null, m.weightKg ? t("health.kg", { n: f.n(m.weightKg) }) : null].filter(Boolean).join(" · ")}
            {m.bmi ? <span className="ml-2 text-xs font-normal text-muted">{t("health.bmiShort", { value: f.n(m.bmi.value), band: t(`health.band.${m.bmi.band}`) })}</span> : null}
          </Row>
        ) : null}
        {m.medical ? <Row label={t("health.medical")}>{m.medical}</Row> : null}
        <Row label={t("profile.account")}>
          {p.link.linked ? (
            <Badge tone="brand">{t("profile.linked")}</Badge>
          ) : p.link.pendingInvite ? (
            <Badge tone="warning">{t("profile.invitePending", { date: f.short(p.link.pendingInvite.expiresAt) })}</Badge>
          ) : (
            <Badge>{t("profile.notLinked")}</Badge>
          )}
        </Row>
      </div>
      {act.problem ? <p role="alert" className="mt-2 text-sm text-danger">{act.problem}</p> : null}
      {p.can.edit && m.status !== "removed" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {!p.link.linked && !p.link.pendingInvite ? (
            <Button type="button" size="sm" icon={<LinkSimple size={16} aria-hidden />} onClick={() => setInviting(true)} data-testid="invite-open">
              {t("profile.invite")}
            </Button>
          ) : null}
          {p.link.linked ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => setUnlinking(true)}>
              {t("profile.unlink")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {editing ? <EditDialog ctx={ctx} p={p} onClose={() => setEditing(false)} /> : null}
      {inviting ? <InviteDialog ctx={ctx} memberId={m.id} onClose={() => setInviting(false)} /> : null}
      <Confirm
        open={unlinking}
        onOpenChange={setUnlinking}
        title={t("profile.unlinkTitle")}
        body={t("profile.unlinkBody")}
        confirm={t("profile.unlink")}
        busy={act.busy}
        onConfirm={async () => {
          if (await act.run(() => gymManage.unlink(ctx.gymId, m.id), t("profile.unlinked"))) setUnlinking(false);
        }}
      />
    </Section>
  );
}

function EditDialog({ ctx, p, onClose }: { ctx: GymCtx; p: Profile; onClose: () => void }) {
  const t = useTranslations("gm");
  const m = p.member;
  const act = useAct(ctx.gymId, m.id);
  const [d, setD] = useState({ displayName: m.displayName, phone: "", gender: m.gender ?? "", birthDate: m.birthDate ?? "", email: m.email ?? "", ecName: m.emergencyContact?.name ?? "", ecPhone: m.emergencyContact?.phone ?? "", bloodGroup: m.bloodGroup ?? "", heightCm: m.heightCm == null ? "" : String(m.heightCm), weightKg: m.weightKg == null ? "" : String(m.weightKg), medical: m.medical ?? "" });
  // M27-FR-30: the blood group with members.edit; height, weight and conditions only when the API shows them (owner, plans.manage).
  const showBody = m.heightCm !== undefined;
  // Checked before sending (19 Nov 2026): the same rules as Add member; a new phone is optional here.
  const [tried, setTried] = useState(false);
  const today = dhakaToday();
  const problems = memberProblems({ ...d, email: m.email !== undefined ? d.email : "", ecName: m.emergencyContact !== undefined ? d.ecName : "", ecPhone: m.emergencyContact !== undefined ? d.ecPhone : "" }, today, null, { phoneRequired: false });
  const shown = (k: string) => (tried && problems[k] ? t(`check.${problems[k]}`) : undefined);
  const save = async () => {
    setTried(true);
    if (Object.keys(problems).length) return act.setProblem(t("check.fix"));
    const body: Parameters<typeof gymManage.updateMember>[2] = { version: m.version };
    if (d.displayName.trim() !== m.displayName) body.displayName = d.displayName.trim();
    if (d.phone.trim()) body.phone = d.phone.trim();
    if ((d.gender || null) !== (m.gender ?? null)) body.gender = (d.gender || null) as typeof body.gender;
    if ((d.birthDate || null) !== (m.birthDate ?? null)) body.birthDate = d.birthDate || null;
    if (m.email !== undefined && (d.email.trim() || null) !== (m.email ?? null)) body.email = d.email.trim() || null;
    const ec = d.ecName.trim() && d.ecPhone.trim() ? { name: d.ecName.trim(), phone: d.ecPhone.trim() } : null;
    if (m.emergencyContact !== undefined && JSON.stringify(ec) !== JSON.stringify(m.emergencyContact ?? null)) body.emergencyContact = ec;
    if (m.bloodGroup !== undefined && (d.bloodGroup || null) !== (m.bloodGroup ?? null)) body.bloodGroup = (d.bloodGroup || null) as typeof body.bloodGroup;
    if (showBody) {
      const h = d.heightCm.trim() ? Number(d.heightCm) : null;
      const w = d.weightKg.trim() ? Number(d.weightKg) : null;
      if ((h !== null && !(Number.isInteger(h) && h >= 50 && h <= 250)) || (w !== null && !(w >= 10 && w <= 400))) return act.setProblem(t("health.bodyBad"));
      if (h !== (m.heightCm ?? null)) body.heightCm = h;
      if (w !== (m.weightKg ?? null)) body.weightKg = w === null ? null : Math.round(w * 10) / 10;
      if ((d.medical.trim() || null) !== (m.medical ?? null)) body.medical = d.medical.trim() || null;
    }
    if (Object.keys(body).length === 1) return onClose();
    if (await act.run(() => gymManage.updateMember(ctx.gymId, m.id, body), t("saved"))) onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("profile.editTitle")}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={save} busy={act.busy} confirm={Object.keys(problems).length ? undefined : "save"}>
            {t("save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field id="e-name" label={t("member.name")} value={d.displayName} onChange={(e) => setD({ ...d, displayName: e.target.value })} maxLength={80} error={shown("displayName")} />
        <PhoneField id="e-phone" label={t("profile.newPhone")} optional={t("optional")} hint={t("profile.newPhoneHint")} value={d.phone} onChange={(v) => setD({ ...d, phone: v })} error={shown("phone")} />
        <Select id="e-gender" label={t("member.gender")} value={d.gender} onChange={(e) => setD({ ...d, gender: e.target.value as typeof d.gender })}>
          <option value="">–</option>
          {(["male", "female", "other"] as const).map((g) => (
            <option key={g} value={g}>
              {t(`gender.${g}`)}
            </option>
          ))}
        </Select>
        <DatePicker id="e-birth" label={t("member.birthDate")} value={d.birthDate} min={birthRange(today).min} max={birthRange(today).max} error={shown("birthDate")} onChange={(v) => setD({ ...d, birthDate: v })} />
        {m.email !== undefined ? <Field id="e-email" type="email" label={t("member.email")} value={d.email} maxLength={120} error={shown("email")} onChange={(e) => setD({ ...d, email: e.target.value })} /> : null}
        {m.emergencyContact !== undefined ? (
          <>
            <Field id="e-ec-name" label={t("member.ecName")} value={d.ecName} maxLength={80} error={shown("ecName")} onChange={(e) => setD({ ...d, ecName: e.target.value })} />
            <PhoneField id="e-ec-phone" label={t("member.ecPhone")} value={d.ecPhone} error={shown("ecPhone")} onChange={(v) => setD({ ...d, ecPhone: v })} />
          </>
        ) : null}
        {m.bloodGroup !== undefined ? (
          <Select id="e-blood" label={t("health.bloodGroup")} value={d.bloodGroup} onChange={(e) => setD({ ...d, bloodGroup: e.target.value })}>
            <option value="">–</option>
            {BLOOD_GROUPS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        ) : null}
        {showBody ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field id="e-height" label={t("health.height")} inputMode="numeric" value={d.heightCm} onChange={(e) => setD({ ...d, heightCm: e.target.value.replace(/\D/g, "") })} />
              <Field id="e-weight" label={t("health.weight")} inputMode="decimal" value={d.weightKg} onChange={(e) => setD({ ...d, weightKg: e.target.value.replace(/[^\d.]/g, "") })} />
            </div>
            <Textarea id="e-medical" label={t("health.medical")} optional={t("optional")} hint={t("health.medicalHint")} value={d.medical} maxLength={500} onChange={(e) => setD({ ...d, medical: e.target.value })} />
          </>
        ) : null}
        {act.problem ? <p role="alert" className="text-sm text-danger">{act.problem}</p> : null}
      </div>
    </Dialog>
  );
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

function InviteDialog({ ctx, memberId, onClose }: { ctx: GymCtx; memberId: string; onClose: () => void }) {
  const t = useTranslations("gm");
  const act = useAct(ctx.gymId, memberId);
  const [by, setBy] = useState<"own" | "phone" | "username">("own");
  const [value, setValue] = useState("");
  const send = async () => {
    const body = by === "phone" ? { phone: value.trim() } : by === "username" ? { username: value.trim() } : {};
    if (await act.run(() => gymManage.invite(ctx.gymId, memberId, body), t("profile.invited"))) onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("profile.inviteTitle")}
      description={t("profile.inviteBody")}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={send} busy={act.busy} confirm="send" data-testid="invite-send">
            {t("profile.inviteSend")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Select id="inv-by" label={t("profile.inviteBy")} value={by} onChange={(e) => setBy(e.target.value as typeof by)}>
          <option value="own">{t("profile.inviteOwn")}</option>
          <option value="phone">{t("profile.invitePhone")}</option>
          <option value="username">{t("profile.inviteUsername")}</option>
        </Select>
        {by !== "own" ? <Field id="inv-value" label={by === "phone" ? t("member.phone") : t("profile.username")} value={value} onChange={(e) => setValue(e.target.value)} /> : null}
        {act.problem ? <p role="alert" className="text-sm text-danger">{act.problem}</p> : null}
      </div>
    </Dialog>
  );
}

/** A yes/no question for an action that needs no input. */
function Confirm({ open, onOpenChange, title, body, confirm, busy, danger, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; title: ReactNode; body?: ReactNode; confirm: string; busy?: boolean; danger?: boolean; onConfirm: () => void }) {
  const t = useTranslations("gm");
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={body}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button type="button" variant={danger ? "danger" : "primary"} onClick={onConfirm} busy={busy} data-testid="confirm-yes">
            {confirm}
          </Button>
        </>
      }
    />
  );
}

// ---------------------------------------------------------------- memberships

const MS_TONE: Record<Membership["status"], "brand" | "info" | "warning" | "neutral" | "danger"> = { upcoming: "info", active: "brand", frozen: "info", expired: "warning", cancelled: "neutral", changed: "neutral" };

type MsDialog = { kind: "assign" | "renew" | "freeze" | "change"; ms: Membership | null } | { kind: "unfreeze" | "cancel"; ms: Membership } | null;

function Memberships({ ctx, p }: { ctx: GymCtx; p: Profile }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const act = useAct(ctx.gymId, p.member.id);
  const [dialog, setDialog] = useState<MsDialog>(null);
  const list = p.memberships.filter((m): m is Membership => Boolean(m));
  const latestId = list[0]?.id;
  const hasOpen = list.some((m) => ["upcoming", "active", "frozen"].includes(m.status));
  const editable = p.can.edit && !["removed", "left"].includes(p.member.status);
  return (
    <Section
      title={t("profile.memberships")}
      testId="profile-memberships"
      actions={editable && !hasOpen ? <Button type="button" size="sm" onClick={() => setDialog({ kind: "assign", ms: null })} data-testid="ms-assign">{t("ms.assign")}</Button> : null}
    >
      {!list.length ? <p className="text-sm text-muted">{t("ms.none")}</p> : null}
      <ul className="flex flex-col gap-2">
        {list.map((ms) => (
          <li key={ms.id} className={cn("rounded-control border border-line p-3", ["active", "frozen"].includes(ms.status) && "border-brand/50")} data-testid="ms-card" data-status={ms.status}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{ms.title}</p>
                <p className="text-sm text-muted tabular-nums">
                  {f.date(ms.startsOn)} – {f.date(ms.endsOn)}
                  {["active", "frozen"].includes(ms.status) ? ` · ${t("ms.daysLeft", { n: ms.daysLeft })}` : ""}
                </p>
              </div>
              <span className="flex flex-wrap justify-end gap-1">
                {ms.createdVia === "member" ? <Badge tone="brand">{t("ms.byMember")}</Badge> : null}
                <Badge tone={MS_TONE[ms.status]}>{t(`msStatus.${ms.status}`)}</Badge>
              </span>
            </div>
            {ms.frozenDays ? <p className="mt-1 text-xs text-muted">{t("ms.frozenDays", { n: ms.frozenDays, count: ms.freezesCount })}</p> : null}
            {ms.freezes.filter((fr) => fr.status !== "cancelled").map((fr) => (
              <p key={fr.id} className="mt-1 flex items-center gap-1 text-xs text-muted">
                <Snowflake size={14} aria-hidden /> {f.short(fr.fromOn)} – {f.short(fr.endedEarlyOn ?? fr.toOn)} · {t(`freezeStatus.${fr.status}`)} · {fr.reason}
              </p>
            ))}
            {ms.cancelReason ? <p className="mt-1 text-xs text-muted">{t("ms.cancelled", { reason: ms.cancelReason })}</p> : null}
            {editable ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {membershipActions(ms, p.can, ms.id === latestId).map((a) => (
                  <Button key={a} type="button" size="sm" variant={a === "renew" ? "primary" : a === "cancel" ? "ghost" : "secondary"} onClick={() => setDialog({ kind: a, ms } as MsDialog)} data-testid={`ms-${a}`}>
                    {t(`ms.${a}`)}
                  </Button>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {act.problem ? <p role="alert" className="mt-2 text-sm text-danger">{act.problem}</p> : null}
      {dialog && (dialog.kind === "assign" || dialog.kind === "renew" || dialog.kind === "change") ? <PackageDialog ctx={ctx} p={p} kind={dialog.kind} ms={dialog.ms} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "freeze" && dialog.ms ? <FreezeDialog ctx={ctx} memberId={p.member.id} ms={dialog.ms} onClose={() => setDialog(null)} /> : null}
      <Confirm
        open={dialog?.kind === "unfreeze"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t("ms.unfreezeTitle")}
        body={t("ms.unfreezeBody")}
        confirm={t("ms.unfreeze")}
        busy={act.busy}
        onConfirm={async () => {
          if (dialog?.ms && (await act.run(() => gymManage.unfreeze(ctx.gymId, dialog.ms!.id), t("ms.unfrozen")))) setDialog(null);
        }}
      />
      <ReasonDialog
        open={dialog?.kind === "cancel"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t("ms.cancelTitle")}
        description={t("ms.cancelBody")}
        confirmLabel={t("ms.cancel")}
        danger
        minLength={2}
        maxLength={300}
        busy={act.busy}
        error={act.problem}
        testId="ms-cancel-dialog"
        onConfirm={async (reason) => {
          if (dialog?.ms && (await act.run(() => gymManage.cancelMembership(ctx.gymId, dialog.ms!.id, reason), t("ms.cancelledDone")))) setDialog(null);
        }}
      />
    </Section>
  );
}

/** Assign, renew or change: the package (owner's list; staff renew the same package), dates and, where allowed, the first payment. */
function PackageDialog({ ctx, p, kind, ms, onClose }: { ctx: GymCtx; p: Profile; kind: "assign" | "renew" | "change"; ms: Membership | null; onClose: () => void }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const toast = useToast();
  const act = useAct(ctx.gymId, p.member.id);
  const packages = useDeskPackages(ctx.gymId, ctx.owner || ctx.can("members.view"));
  const canCollect = ctx.can("fees.collect") && p.can.collect;
  const canAdjust = ctx.can("fees.adjust") && p.can.adjust;
  const [packageId, setPackageId] = useState(kind === "renew" ? "" : "");
  const [date, setDate] = useState(kind === "renew" ? "" : dhakaToday());
  const [dueTaka, setDueTaka] = useState("");
  const [withPay, setWithPay] = useState(false);
  const [pay, setPay] = useState(emptyPayment());
  const [key] = useState(newKey);
  const pkg = packages.desk.find((x) => x.id === packageId);
  const needsPackage = kind !== "renew";
  const submit = async () => {
    if (needsPackage && !packageId) return act.setProblem(t("new.choosePackage"));
    let payment: Payment | undefined;
    if (kind !== "change" && canCollect && withPay) {
      const b = paymentBody(pay, canAdjust);
      if (!b.ok) return act.setProblem(t("money.badAmount"));
      payment = b.payment;
    }
    if (kind === "assign") {
      const r = await act.run(() => gymManage.assign(ctx.gymId, p.member.id, { packageId, startsOn: date, ...(payment ? { payment } : {}) }, key), t("ms.assigned"));
      if (r) onClose();
    } else if (kind === "renew" && ms) {
      const r = await act.run(() => gymManage.renew(ctx.gymId, ms.id, { ...(packageId ? { packageId } : {}), ...(date ? { startsOn: date } : {}), ...(payment ? { payment } : {}) }, key), t("ms.renewed"));
      if (r) onClose();
    } else if (kind === "change" && ms) {
      let dueAmountPoisha: number | undefined;
      if (canAdjust && dueTaka.trim()) {
        const v = takaToPoisha(dueTaka, { allowZero: true });
        if (v === null) return act.setProblem(t("money.badAmount"));
        dueAmountPoisha = v;
      }
      const r = await act.run(() => gymManage.change(ctx.gymId, ms.id, { packageId, ...(date ? { onDate: date } : {}), ...(dueAmountPoisha !== undefined ? { dueAmountPoisha } : {}) }, key));
      if (r) {
        toast.show(r.credit ? t("ms.changedCredit", { amount: f.taka(r.credit.creditPoisha) }) : t("ms.changed"));
        onClose();
      }
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t(`ms.${kind}Title`)}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={submit} busy={act.busy} confirm={needsPackage && !packageId ? undefined : { kind: kind !== "change" && canCollect && withPay ? "money" : kind === "assign" ? "add" : "save", title: t(`ms.${kind}Ask`), body: kind !== "change" && canCollect && withPay ? t("ms.withPayBody") : undefined }} data-testid="ms-submit">
            {t(`ms.${kind}`)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-testid={`ms-${kind}-dialog`}>
        {packages.desk.length ? (
          <Select id="ms-package" label={t("member.package")} value={packageId} onChange={(e) => setPackageId(e.target.value)} data-testid="ms-package">
            <option value="">{kind === "renew" ? t("ms.samePackage", { title: ms?.title ?? "" }) : t("new.choosePackage")}</option>
            {packages.desk.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title} · {f.taka(x.price)}
              </option>
            ))}
          </Select>
        ) : kind === "renew" ? (
          <p className="text-sm">{t("ms.samePackage", { title: ms?.title ?? "" })}</p>
        ) : (
          <Notice tone="info">{ctx.owner ? t("new.noPackagesOwner") : t("new.noPackagesStaff")}</Notice>
        )}
        <DatePicker
          id="ms-date"
          label={kind === "change" ? t("ms.changeOn") : t("member.startsOn")}
          optional={kind === "renew" ? t("ms.autoStart") : undefined}
          hint={kind === "renew" ? t("ms.renewHint") : undefined}
          value={date}
          min={kind === "renew" ? dhakaToday() : addDays(dhakaToday(), -60)}
          onChange={setDate}
        />
        {kind === "change" && canAdjust ? <Field id="ms-due" label={t("ms.dueOverride")} optional={t("ms.dueDefault")} inputMode="decimal" value={dueTaka} onChange={(e) => setDueTaka(e.target.value)} leading={<span className="text-muted">৳</span>} /> : null}
        {kind !== "change" && canCollect ? (
          <>
            <Checkbox
              id="ms-with-pay"
              label={t("new.withPayment")}
              checked={withPay}
              onChange={(e) => {
                setWithPay(e.target.checked);
                if (e.target.checked && !pay.taka) setPay(emptyPayment(pkg?.price ?? ms?.pricePoisha));
              }}
            />
            {withPay ? <PaymentFields id="ms-pay" value={pay} onChange={setPay} backdate={canAdjust} /> : null}
          </>
        ) : null}
        {act.problem ? <p role="alert" className="text-sm text-danger">{act.problem}</p> : null}
      </div>
    </Dialog>
  );
}

function FreezeDialog({ ctx, memberId, ms, onClose }: { ctx: GymCtx; memberId: string; ms: Membership; onClose: () => void }) {
  const t = useTranslations("gm");
  const act = useAct(ctx.gymId, memberId);
  const [fromOn, setFrom] = useState(dhakaToday());
  const [toOn, setTo] = useState(addDays(dhakaToday(), 6));
  const [reason, setReason] = useState("");
  const submit = async () => {
    if (reason.trim().length < 2) return act.setProblem(t("money.reasonNeeded"));
    if (toOn < fromOn) return act.setProblem(t("ms.freezeOrder"));
    if (await act.run(() => gymManage.freeze(ctx.gymId, ms.id, { fromOn, toOn, reason: reason.trim() }), t("ms.frozen"))) onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("ms.freezeTitle")}
      description={t("ms.freezeBody")}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={submit} busy={act.busy} confirm={reason.trim().length < 2 || toOn < fromOn ? undefined : { kind: "save", title: t("ms.freezeAsk"), body: t("ms.freezeBody") }} data-testid="freeze-submit">
            {t("ms.freeze")}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2" data-testid="ms-freeze-dialog">
        <DatePicker id="fr-from" label={t("ms.from")} value={fromOn} min={dhakaToday()} max={ms.endsOn} onChange={setFrom} />
        <DatePicker id="fr-to" label={t("ms.to")} value={toOn} min={fromOn} onChange={setTo} />
        <Field id="fr-reason" label={t("money.reason")} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} className="sm:col-span-2" data-testid="freeze-reason" />
        {act.problem ? <p role="alert" className="text-sm text-danger sm:col-span-2">{act.problem}</p> : null}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- dues and payments

function Dues({ ctx, p }: { ctx: GymCtx; p: Profile }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const act = useAct(ctx.gymId, p.member.id);
  const [paying, setPaying] = useState<Due | null>(null);
  const [waiving, setWaiving] = useState<Due | null>(null);
  const [reversing, setReversing] = useState<FeePayment | null>(null);
  const [refunding, setRefunding] = useState<FeePayment | null>(null);
  const [linking, setLinking] = useState<Due | null>(null);
  const [revKey, setRevKey] = useState(newKey);
  const dues = p.dues.filter((d): d is Due => Boolean(d));
  const title = (d: Due) => p.memberships.find((m) => m?.id === d.membershipId)?.title ?? t("profile.due");
  const can = { collect: p.can.collect, adjust: p.can.adjust };
  // M24-FR-165: a receipt again on WhatsApp, while sending is on and for whatsapp.send.
  const waOn = useWaSending(ctx);
  return (
    <Section title={t("profile.dues")} testId="profile-dues">
      {!dues.length ? <p className="text-sm text-muted">{t("profile.noDues")}</p> : null}
      <ul className="flex flex-col gap-2">
        {dues.map((d) => (
          <li key={d.id} className={cn("rounded-control border border-line p-3", d.overdue && "border-danger/50")} data-testid="due-card" data-status={d.status}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{title(d)}</p>
                <p className="text-sm text-muted">{t("profile.dueOn", { date: f.date(d.dueOn) })}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge tone={d.status === "paid" ? "brand" : d.status === "partial" ? "warning" : d.status === "unpaid" ? "warning" : "neutral"}>{t(`dueStatus.${d.status}`)}</Badge>
                {d.overdue ? <Badge tone="danger">{t("flag.overdue")}</Badge> : null}
              </div>
            </div>
            {d.amountPoisha !== undefined ? (
              <div className="mt-1 grid grid-cols-2 gap-x-3 text-sm sm:grid-cols-4">
                <span>
                  <span className="block text-xs text-muted">{t("money.amountDue")}</span>
                  {f.taka(d.amountPoisha)}
                </span>
                <span>
                  <span className="block text-xs text-muted">{t("money.paid")}</span>
                  {f.taka(d.paidPoisha)}
                </span>
                <span>
                  <span className="block text-xs text-muted">{t("money.waivedLabel")}</span>
                  {f.taka(d.waivedPoisha)}
                </span>
                <span className="font-semibold">
                  <span className="block text-xs font-normal text-muted">{t("money.outstandingLabel")}</span>
                  <span data-testid="due-outstanding">{f.taka(d.outstandingPoisha)}</span>
                </span>
              </div>
            ) : null}
            {d.payments?.length ? (
              <ul className="mt-2 divide-y divide-line border-t border-line">
                {d.payments.map((pm) => (
                  <li key={pm.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-sm" data-testid="payment-row">
                    <span className="tabular-nums">{f.short(pm.paidOn)}</span>
                    <span className={cn("font-semibold tabular-nums", pm.amountPoisha < 0 && "text-danger")}>{f.taka(pm.amountPoisha)}</span>
                    {pm.method === "online" ? <OnlineCharge p={pm} /> : <span className="text-muted">{t(`method.${pm.method}`)}</span>}
                    {pm.receiptNo ? <span className="text-xs text-muted">{pm.receiptNo}</span> : null}
                    {pm.reversedById ? <Badge tone="danger">{t("money.reversed")}</Badge> : null}
                    {pm.amountPoisha < 0 && pm.reason ? <span className="text-xs text-muted">{pm.reason}</span> : null}
                    <span className="ml-auto flex items-center gap-2">
                      <ReceiptLink url={pm.receiptUrl} />
                      {waOn && pm.receiptUrl && pm.amountPoisha > 0 && !pm.reversedById ? <WaReceiptButton gymId={ctx.gymId} feePaymentId={pm.id} /> : null}
                      {ctx.owner && pm.method === "online" && pm.amountPoisha > 0 && !pm.reversedById ? (
                        <Button type="button" size="sm" variant="ghost" icon={<ArrowArcLeft size={14} aria-hidden />} onClick={() => setRefunding(pm)} data-testid="payment-refund">
                          {t("online.refund")}
                        </Button>
                      ) : null}
                      {reversible(pm, can.adjust) ? (
                        <Button type="button" size="sm" variant="ghost" icon={<ArrowCounterClockwise size={14} aria-hidden />} onClick={() => (setRevKey(newKey()), setReversing(pm))} data-testid="payment-reverse">
                          {t("money.reverse")}
                        </Button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {dueActions(d, can).length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {dueActions(d, can).map((a) => (
                  <Button key={a} type="button" size="sm" variant={a === "collect" ? "primary" : "secondary"} onClick={() => (a === "collect" ? setPaying(d) : setWaiving(d))} data-testid={`due-${a}`}>
                    {t(`money.${a}`)}
                  </Button>
                ))}
                {dueActions(d, can).includes("collect") ? (
                  <Button type="button" size="sm" variant="secondary" icon={<LinkSimple size={16} aria-hidden />} onClick={() => setLinking(d)} data-testid="due-link">
                    {t("online.link")}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {paying ? <PayDialog gymId={ctx.gymId} due={paying} canAdjust={can.adjust} open onOpenChange={(o) => !o && setPaying(null)} onDone={() => void act.refresh()} /> : null}
      {waiving ? <WaiveDialog gymId={ctx.gymId} due={waiving} open onOpenChange={(o) => !o && setWaiving(null)} onDone={() => void act.refresh()} /> : null}
      {linking ? <PaymentLinkDialog gymId={ctx.gymId} due={linking} owner={ctx.owner} tierLocked={featureLocked(ctx.gym.features, "online_fees")} title={t("online.linkFor", { name: p.member.displayName })} open onOpenChange={(o) => !o && setLinking(null)} /> : null}
      {refunding ? <RefundDialog gymId={ctx.gymId} payment={refunding} open onOpenChange={(o) => !o && setRefunding(null)} onDone={() => void act.refresh()} /> : null}
      <ReasonDialog
        open={Boolean(reversing)}
        onOpenChange={(o) => !o && setReversing(null)}
        title={t("money.reverseTitle")}
        description={reversing ? t("money.reverseBody", { amount: f.taka(reversing.amountPoisha), no: reversing.receiptNo ?? "" }) : undefined}
        confirmLabel={t("money.reverse")}
        danger
        minLength={2}
        maxLength={300}
        busy={act.busy}
        error={act.problem}
        testId="reverse-dialog"
        onConfirm={async (reason) => {
          if (reversing && (await act.run(() => gymManage.reverse(ctx.gymId, reversing.id, reason, revKey), t("money.reversedDone")))) setReversing(null);
        }}
      />
    </Section>
  );
}

// ---------------------------------------------------------------- check-ins, notes, lifecycle

function CheckinCalendar({ gymId, memberId }: { gymId: string; memberId: string }) {
  const t = useTranslations("gm");
  const [month, setMonth] = useState(monthOf(dhakaToday()));
  const q = useQuery({ queryKey: ["gm-attendance", gymId, memberId, month], queryFn: () => gymManage.attendance(gymId, memberId, month) });
  return (
    <Section title={t("profile.checkins")} actions={<CalendarBlank size={20} aria-hidden className="text-muted" />}>
      <MonthCalendar month={month} onMonth={setMonth} days={(q.data?.days ?? []).map((d) => d.date)} count={q.data?.count ?? 0} />
    </Section>
  );
}

function Notes({ gymId, memberId }: { gymId: string; memberId: string }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const act = useAct(gymId, memberId);
  const q = useQuery({ queryKey: ["gm-notes", gymId, memberId], queryFn: () => gymManage.notes(gymId, memberId) });
  const [body, setBody] = useState("");
  const items = (q.data as { items?: { id: string; body: string; by: { displayName: string | null }; createdAt: string }[] } | undefined)?.items ?? [];
  return (
    <Section title={t("profile.notes")} testId="profile-notes" actions={<NotePencil size={20} aria-hidden className="text-muted" />}>
      <p className="mb-2 text-xs text-muted">{t("member.noteHint")}</p>
      <form
        className="flex flex-col gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!body.trim()) return;
          if (await act.run(() => gymManage.addNote(gymId, memberId, body.trim()))) setBody("");
        }}
      >
        <Textarea id="note-body" label={t("profile.addNote")} value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} rows={2} />
        <Button type="submit" size="sm" variant="secondary" busy={act.busy} className="self-start" confirm={body.trim() ? "add" : undefined} data-testid="note-add">
          {t("profile.saveNote")}
        </Button>
        {act.problem ? <p role="alert" className="text-sm text-danger">{act.problem}</p> : null}
      </form>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((n) => (
          <li key={n.id} className="rounded-control bg-surface-2 p-2 text-sm">
            <p className="whitespace-pre-wrap">{n.body}</p>
            <p className="mt-1 text-xs text-muted">
              {n.by.displayName ?? t("profile.staff")} · {f.short(n.createdAt)} {f.time(n.createdAt)}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Lifecycle({ ctx, p }: { ctx: GymCtx; p: Profile }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const act = useAct(ctx.gymId, p.member.id);
  const m = p.member;
  const [leaving, setLeaving] = useState(false);
  const [rejoining, setRejoining] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [leave, setLeave] = useState<{ reason: LeftReason; leftOn: string; note: string }>({ reason: "unknown", leftOn: dhakaToday(), note: "" });
  if (!p.can.edit && !p.can.remove) return null;
  return (
    <Section title={t("profile.lifecycle")} testId="profile-lifecycle">
      {m.status === "left" ? <p className="mb-2 text-sm text-muted">{t("profile.leftOn", { date: f.date(m.leftOn), reason: m.leftReason ? t(`leftReason.${m.leftReason}`) : "" })}</p> : null}
      {m.status === "removed" ? <Notice tone="warning">{t("profile.removedNote", { reason: m.removedReason ?? "" })}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        {p.can.edit && m.status !== "left" && m.status !== "removed" ? (
          <Button type="button" size="sm" variant="secondary" icon={<UserMinus size={16} aria-hidden />} onClick={() => setLeaving(true)} data-testid="member-leave">
            {t("profile.markLeft")}
          </Button>
        ) : null}
        {p.can.edit && m.status === "left" ? (
          <Button type="button" size="sm" onClick={() => setRejoining(true)} data-testid="member-rejoin">
            {t("profile.rejoin")}
          </Button>
        ) : null}
        {p.can.remove && m.status !== "removed" ? (
          <Button type="button" size="sm" variant="danger" onClick={() => setRemoving(true)} data-testid="member-remove">
            {t("profile.remove")}
          </Button>
        ) : null}
      </div>
      {act.problem ? <p role="alert" className="mt-2 text-sm text-danger">{act.problem}</p> : null}
      <Dialog
        open={leaving}
        onOpenChange={setLeaving}
        title={t("profile.leaveTitle")}
        description={t("profile.leaveBody")}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setLeaving(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              busy={act.busy}
              onClick={async () => {
                if (await act.run(() => gymManage.leave(ctx.gymId, m.id, { reason: leave.reason, leftOn: leave.leftOn, ...(leave.note.trim() ? { note: leave.note.trim() } : {}) }), t("profile.leftDone"))) setLeaving(false);
              }}
              data-testid="leave-submit"
            >
              {t("profile.markLeft")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Select id="leave-reason" label={t("money.reason")} value={leave.reason} onChange={(e) => setLeave({ ...leave, reason: e.target.value as LeftReason })}>
            {LEFT_REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`leftReason.${r}`)}
              </option>
            ))}
          </Select>
          <DatePicker id="leave-on" label={t("profile.leftOnLabel")} value={leave.leftOn} max={dhakaToday()} onChange={(v) => setLeave({ ...leave, leftOn: v })} />
          <Textarea id="leave-note" label={t("money.note")} optional={t("optional")} value={leave.note} maxLength={2000} onChange={(e) => setLeave({ ...leave, note: e.target.value })} />
          {act.problem ? <p role="alert" className="text-sm text-danger">{act.problem}</p> : null}
        </div>
      </Dialog>
      <Confirm
        open={rejoining}
        onOpenChange={setRejoining}
        title={t("profile.rejoinTitle")}
        body={t("profile.rejoinBody")}
        confirm={t("profile.rejoin")}
        busy={act.busy}
        onConfirm={async () => {
          if (await act.run(() => gymManage.rejoin(ctx.gymId, m.id), t("profile.rejoined"))) setRejoining(false);
        }}
      />
      <ReasonDialog
        open={removing}
        onOpenChange={setRemoving}
        title={t("profile.removeTitle")}
        description={t("profile.removeBody")}
        confirmLabel={t("profile.remove")}
        danger
        minLength={2}
        maxLength={300}
        busy={act.busy}
        error={act.problem}
        testId="remove-dialog"
        onConfirm={async (reason) => {
          if (await act.run(() => gymManage.remove(ctx.gymId, m.id, reason), t("profile.removed"))) setRemoving(false);
        }}
      />
    </Section>
  );
}


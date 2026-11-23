"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CalendarBlank, CaretLeft, CaretRight, PencilSimple, Plus, Trash, UsersThree } from "@phosphor-icons/react";
import { Avatar, Badge, Button, Card, Checkbox, Dialog, EmptyState, Field, IconButton, Notice, ReasonDialog, Select, SkeletonList, Textarea, useConfirm, useToast } from "@kriraghor/ui/kit";
import { newKey } from "@kriraghor/ui/format";
import { cn } from "@kriraghor/ui/cn";
import { dhakaToday } from "@/lib/gym-manage";
import { byDay, dhakaTime, gymOps2, plusDays, WEEK_DOWS, type ClassSession, type GymClass, type Slot } from "@/lib/gym-ops";
import { GymPage, useFmt, useGymError, type GymCtx } from "../gym-manage/common";
import { MemberPick, type PickedMember } from "./parts";
import { TrainerFace } from "../TrainerFace";

/**
 * /manage/[gymId]/classes (M27-FR-45 to FR-54; classes.manage, or attendance.mark for the desk side;
 * Standard plan): the week's sessions day by day with places and the waitlist; a session opens its bookings
 * (book a member, cancel a booking, mark who came, cancel the session). The classes themselves, with their
 * trainer, capacity, length, room and weekly slots, are added and changed by classes.manage.
 */
export function Classes({ gymId }: { gymId: string }) {
  const t = useTranslations("go");
  return (
    <GymPage gymId={gymId} page="classes" feature="classes" wide title={t("classes.title")} description={t("classes.lead")} testId="go-classes">
      {(ctx) => <Body ctx={ctx} />}
    </GymPage>
  );
}

function Body({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("go");
  const f = useFmt();
  const err = useGymError();
  const today = dhakaToday();
  const [from, setFrom] = useState(today);
  const to = plusDays(from, 6);
  const [editing, setEditing] = useState<GymClass | "new" | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const canManage = ctx.can("classes.manage");
  const classes = useQuery({ queryKey: ["go-classes", ctx.gymId], queryFn: () => gymOps2.classes(ctx.gymId) });
  const week = useQuery({ queryKey: ["go-sessions", ctx.gymId, from], queryFn: () => gymOps2.sessions(ctx.gymId, from, to) });
  const days = byDay(week.data?.items ?? []);
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconButton label={t("classes.prevWeek")} variant="secondary" onClick={() => setFrom(plusDays(from, -7))} disabled={from <= today}>
              <CaretLeft size={18} aria-hidden />
            </IconButton>
            <p className="min-w-52 text-center font-display text-lg font-bold" aria-live="polite">
              {f.short(from)} – {f.short(to)}
            </p>
            <IconButton label={t("classes.nextWeek")} variant="secondary" onClick={() => setFrom(plusDays(from, 7))}>
              <CaretRight size={18} aria-hidden />
            </IconButton>
          </div>
          {canManage ? (
            <Button onClick={() => setEditing("new")} data-testid="class-add">
              <Plus size={18} weight="bold" aria-hidden />
              {t("classes.add")}
            </Button>
          ) : null}
        </div>
        {week.isPending ? (
          <SkeletonList rows={4} />
        ) : week.isError ? (
          <Notice tone="error">{err(week.error)}</Notice>
        ) : !days.length ? (
          <EmptyState icon={<CalendarBlank size={28} aria-hidden />} title={t("classes.noSessions")} body={canManage ? t("classes.noSessionsHint") : undefined} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="class-week">
            {days.map((d) => (
              <Card key={d.date} padded={false}>
                <p className={cn("border-b border-line px-4 py-2 text-sm font-bold", d.date === today && "text-brand-text")}>
                  {d.date === today ? t("classes.today") : f.date(d.date)}
                </p>
                <ul className="divide-y divide-line">
                  {d.items.map((s) => (
                    <li key={s.id}>
                      <button type="button" onClick={() => setOpen(s.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2" data-testid={`session-${s.id}`}>
                        <span className="w-12 font-bold tabular-nums">{dhakaTime(s.startsAt)}</span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block truncate font-semibold", s.status === "cancelled" && "line-through opacity-60")}>{s.name}</span>
                          <span className="block truncate text-xs text-muted">{[s.trainer?.displayName, s.room].filter(Boolean).join(" · ")}</span>
                        </span>
                        {s.trainer?.displayName ? <Avatar name={s.trainer.displayName} src={s.trainer.avatarUrl} size={28} alt={s.trainer.displayName} /> : null}
                        <SessionCount s={s} />
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">{t("classes.all")}</h2>
        {classes.isPending ? (
          <SkeletonList rows={2} />
        ) : !classes.data?.items.length ? (
          <p className="text-sm text-muted">{t("classes.none")}</p>
        ) : (
          <Card padded={false}>
            <ul className="divide-y divide-line" data-testid="class-list">
              {classes.data.items.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{k.name}</p>
                    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
                      <span>{t("classes.facts", { capacity: f.n(k.capacity), minutes: f.n(k.minutes) })}</span>
                      {k.trainer?.displayName ? (
                        <>
                          <span aria-hidden>·</span>
                          <TrainerFace name={k.trainer.displayName} src={k.trainer.avatarUrl} size={24} />
                        </>
                      ) : null}
                      {k.room ? <span>· {k.room}</span> : null}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-1">
                      {k.slots.map((x) => (
                        <Badge key={x.id} tone="neutral">
                          {t(`dow.${x.dow}`)} {x.startTime}
                        </Badge>
                      ))}
                    </p>
                  </div>
                  {canManage ? (
                    <IconButton label={t("classes.edit")} variant="secondary" onClick={() => setEditing(k)}>
                      <PencilSimple size={18} aria-hidden />
                    </IconButton>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {editing ? <ClassDialog ctx={ctx} klass={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      {open ? <SessionDialog ctx={ctx} sessionId={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

function SessionCount({ s }: { s: ClassSession }) {
  const t = useTranslations("go");
  const f = useFmt();
  if (s.status === "cancelled") return <Badge tone="danger">{t("classes.cancelled")}</Badge>;
  if (s.status === "done") return <Badge tone="neutral">{t("classes.done")}</Badge>;
  return (
    <span className="flex flex-col items-end text-xs">
      <Badge tone={s.spaces ? "brand" : "warning"}>
        <UsersThree size={12} aria-hidden /> {f.n(s.booked)}/{f.n(s.capacity)}
      </Badge>
      {s.waitlisted ? <span className="mt-0.5 text-muted">{t("classes.waiting", { n: f.n(s.waitlisted) })}</span> : null}
    </span>
  );
}

function useRefresh(gymId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["go-classes", gymId] });
    void qc.invalidateQueries({ queryKey: ["go-sessions", gymId] });
    void qc.invalidateQueries({ queryKey: ["go-session", gymId] });
  };
}

function ClassDialog({ ctx, klass, onClose }: { ctx: GymCtx; klass: GymClass | null; onClose: () => void }) {
  const t = useTranslations("go");
  const err = useGymError();
  const toast = useToast();
  const refresh = useRefresh(ctx.gymId);
  const [d, setD] = useState(() => ({
    name: klass?.name ?? "",
    description: klass?.description ?? "",
    capacity: String(klass?.capacity ?? 15),
    minutes: String(klass?.minutes ?? 45),
    room: klass?.room ?? "",
    trainerUserId: klass?.trainer?.id ?? "",
  }));
  const [slots, setSlots] = useState<Slot[]>(() => klass?.slots.map(({ dow, startTime }) => ({ dow, startTime })) ?? []);
  const [newSlot, setNewSlot] = useState<Slot>({ dow: 6, startTime: "07:00" });
  const [busy, setBusy] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const toggleSlot = (x: Slot) => setSlots((list) => (list.some((y) => y.dow === x.dow && y.startTime === x.startTime) ? list.filter((y) => !(y.dow === x.dow && y.startTime === x.startTime)) : [...list, x]));
  const save = async () => {
    const capacity = Number(d.capacity);
    const minutes = Number(d.minutes);
    if (!d.name.trim()) return setProblem(t("classes.nameNeeded"));
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) return setProblem(t("classes.capacityBad"));
    if (!Number.isInteger(minutes) || minutes < 10 || minutes > 480) return setProblem(t("classes.minutesBad"));
    setBusy(true);
    setProblem(null);
    const fields = { name: d.name.trim(), description: d.description.trim() || null, capacity, minutes, room: d.room.trim() || null, trainerUserId: d.trainerUserId || null };
    try {
      if (klass) {
        await gymOps2.editClass(ctx.gymId, klass.id, fields);
        const before = klass.slots.map((x) => `${x.dow}-${x.startTime}`).sort().join();
        const after = slots.map((x) => `${x.dow}-${x.startTime}`).sort().join();
        if (before !== after) await gymOps2.setSlots(ctx.gymId, klass.id, slots);
      } else {
        await gymOps2.addClass(ctx.gymId, { ...fields, slots });
      }
      toast.show(t("classes.saved"));
      refresh();
      onClose();
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  const retire = async () => {
    setBusy(true);
    try {
      if (klass) await gymOps2.editClass(ctx.gymId, klass.id, { status: "retired" });
      toast.show(t("classes.retired"));
      refresh();
      onClose();
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
      setRetiring(false);
    }
  };
  const sorted = [...slots].sort((a, b) => WEEK_DOWS.indexOf(a.dow) - WEEK_DOWS.indexOf(b.dow) || a.startTime.localeCompare(b.startTime));
  return (
    <>
      <Dialog
        open={!retiring}
        onOpenChange={(o) => !o && !busy && onClose()}
        title={klass ? t("classes.editTitle") : t("classes.add")}
        className="max-w-xl"
        footer={
          <div className="flex w-full flex-wrap justify-between gap-2">
            {klass ? (
              <Button variant="ghost" onClick={() => setRetiring(true)} disabled={busy}>
                {t("classes.retire")}
              </Button>
            ) : (
              <span />
            )}
            <span className="flex gap-2">
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                {t("cancel")}
              </Button>
              <Button onClick={() => void save()} busy={busy} confirm={klass ? "save" : "add"} data-testid="class-save">
                {t("save")}
              </Button>
            </span>
          </div>
        }
      >
        <div className="grid gap-3 px-6 pb-2 sm:grid-cols-2">
          <Field id="c-name" label={t("classes.name")} value={d.name} maxLength={80} onChange={(e) => setD({ ...d, name: e.target.value })} className="sm:col-span-2" autoFocus data-testid="class-name" />
          <Field id="c-cap" label={t("classes.capacity")} inputMode="numeric" value={d.capacity} onChange={(e) => setD({ ...d, capacity: e.target.value.replace(/\D/g, "") })} />
          <Field id="c-min" label={t("classes.minutes")} inputMode="numeric" value={d.minutes} onChange={(e) => setD({ ...d, minutes: e.target.value.replace(/\D/g, "") })} />
          <Field id="c-room" label={t("classes.room")} optional={t("optional")} value={d.room} maxLength={40} onChange={(e) => setD({ ...d, room: e.target.value })} />
          <TrainerSelect ctx={ctx} value={d.trainerUserId} onChange={(v) => setD({ ...d, trainerUserId: v })} />
          <Textarea id="c-desc" label={t("classes.description")} optional={t("optional")} value={d.description} maxLength={500} onChange={(e) => setD({ ...d, description: e.target.value })} className="sm:col-span-2" />
          <fieldset className="flex flex-col gap-2 sm:col-span-2">
            <legend className="text-sm font-semibold">{t("classes.slots")}</legend>
            <p className="text-xs text-muted">{t("classes.slotsHint")}</p>
            <div className="flex flex-wrap gap-2">
              {sorted.map((x) => (
                <span key={`${x.dow}-${x.startTime}`} className="inline-flex items-center gap-1 rounded-pill border border-line px-3 py-1 text-sm">
                  {t(`dow.${x.dow}`)} {x.startTime}
                  <button type="button" onClick={() => toggleSlot(x)} aria-label={t("classes.removeSlot")} className="text-muted hover:text-danger">
                    <Trash size={14} aria-hidden />
                  </button>
                </span>
              ))}
              {!slots.length ? <span className="text-sm text-muted">{t("classes.noSlots")}</span> : null}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Select id="c-dow" label={t("classes.day")} value={String(newSlot.dow)} onChange={(e) => setNewSlot({ ...newSlot, dow: Number(e.target.value) })} className="w-40">
                {WEEK_DOWS.map((n) => (
                  <option key={n} value={n}>
                    {t(`dow.${n}`)}
                  </option>
                ))}
              </Select>
              <Field id="c-time" label={t("classes.time")} type="time" value={newSlot.startTime} onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })} className="w-36" />
              <Button variant="secondary" onClick={() => !slots.some((y) => y.dow === newSlot.dow && y.startTime === newSlot.startTime) && setSlots([...slots, newSlot])} data-testid="class-add-slot">
                <Plus size={16} aria-hidden />
                {t("classes.addSlot")}
              </Button>
            </div>
          </fieldset>
          {problem ? (
            <p role="alert" className="text-sm text-danger sm:col-span-2">
              {problem}
            </p>
          ) : null}
        </div>
      </Dialog>
      <Dialog
        open={retiring}
        onOpenChange={(o) => !o && setRetiring(false)}
        title={t("classes.retireTitle")}
        description={t("classes.retireBody")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRetiring(false)} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button variant="danger" onClick={() => void retire()} busy={busy}>
              {t("classes.retire")}
            </Button>
          </>
        }
      >
        <span />
      </Dialog>
    </>
  );
}

/** The trainer: the owner or a staff member of this gym (from the team). */
function TrainerSelect({ ctx, value, onChange }: { ctx: GymCtx; value: string; onChange: (v: string) => void }) {
  const t = useTranslations("go");
  const team = useQuery({ queryKey: ["go-trainers", ctx.gymId], queryFn: () => gymOps2.trainers(ctx.gymId) });
  const people = team.data?.items ?? [];
  return (
    <Select id="c-trainer" label={t("classes.trainer")} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t("classes.noTrainer")}</option>
      {people.map((p) => (
        <option key={p.userId} value={p.userId}>
          {p.displayName ?? "–"}
          {p.owner ? ` (${t("classes.owner")})` : ""}
        </option>
      ))}
    </Select>
  );
}

function SessionDialog({ ctx, sessionId, onClose }: { ctx: GymCtx; sessionId: string; onClose: () => void }) {
  const t = useTranslations("go");
  const f = useFmt();
  const err = useGymError();
  const toast = useToast();
  const refresh = useRefresh(ctx.gymId);
  const ask = useConfirm();
  const q = useQuery({ queryKey: ["go-session", ctx.gymId, sessionId], queryFn: () => gymOps2.session(ctx.gymId, sessionId) });
  const [member, setMember] = useState<PickedMember | null>(null);
  const [key, setKey] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [came, setCame] = useState<Set<string> | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // The dialog's open time is "now" for the started check; a session that starts while it is open shows on reopen.
  const [openedAt] = useState(() => Date.now());
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setProblem(null);
    try {
      await fn();
      toast.show(done);
      refresh();
      return true;
    } catch (e) {
      setProblem(err(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const s = q.data;
  const started = s ? new Date(s.startsAt).getTime() <= openedAt : false;
  const live = s?.bookings.filter((b) => b.status !== "cancelled") ?? [];
  const marking = came ?? new Set(live.filter((b) => b.status === "attended").map((b) => b.member.id));
  return (
    <>
      <Dialog open={!cancelling} onOpenChange={(o) => !o && !busy && onClose()} title={s ? `${s.name} · ${dhakaTime(s.startsAt)}` : t("classes.session")} description={s ? f.date(s.localDate) : undefined} className="max-w-xl">
        <div className="flex flex-col gap-3 px-6 pb-5">
          {q.isPending ? (
            <SkeletonList rows={3} />
          ) : q.isError || !s ? (
            <Notice tone="error">{err(q.error)}</Notice>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <SessionCount s={s} />
                {s.trainer?.displayName ? <TrainerFace name={s.trainer.displayName} src={s.trainer.avatarUrl} size={32} className="text-muted" /> : null}
                {s.room ? <span className="text-muted">· {s.room}</span> : null}
              </div>
              {s.status === "cancelled" ? <Notice tone="warning">{t("classes.cancelledBecause", { reason: s.cancelReason ?? "" })}</Notice> : null}
              <ul className="divide-y divide-line rounded-control border border-line" data-testid="session-bookings">
                {!live.length ? <li className="px-3 py-2 text-sm text-muted">{t("classes.noBookings")}</li> : null}
                {live.map((b, i) => (
                  <li key={b.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    {started && s.status !== "cancelled" && b.status !== "waitlisted" ? (
                      <Checkbox
                        id={`came-${b.id}`}
                        label={<span className="font-semibold">{b.member.displayName}</span>}
                        checked={marking.has(b.member.id)}
                        onChange={(e) => {
                          const next = new Set(marking);
                          if (e.target.checked) next.add(b.member.id);
                          else next.delete(b.member.id);
                          setCame(next);
                        }}
                        className="flex-1"
                      />
                    ) : (
                      <span className="min-w-0 flex-1 truncate font-semibold">{b.member.displayName}</span>
                    )}
                    <span className="text-xs text-muted">{b.member.memberCode}</span>
                    <Badge tone={b.status === "booked" || b.status === "attended" ? "brand" : b.status === "waitlisted" ? "warning" : "neutral"}>
                      {b.status === "waitlisted" ? t("classes.waitPos", { n: f.n(live.filter((x) => x.status === "waitlisted").indexOf(b) + 1) }) : t(`classes.bookingStatus.${b.status}`)}
                    </Badge>
                    {!started && (b.status === "booked" || b.status === "waitlisted") ? (
                      <IconButton label={t("classes.cancelBooking")} variant="ghost" onClick={async () => {
                          if (!(await ask({ kind: "remove", title: t("classes.cancelBookingAsk", { name: b.member.displayName }), body: t("classes.cancelBookingBody") }))) return;
                          void run(() => gymOps2.deskCancel(ctx.gymId, b.id), t("classes.bookingCancelled"));
                        }}
                        disabled={busy}
                      >
                        <Trash size={16} aria-hidden />
                      </IconButton>
                    ) : null}
                    <span className="sr-only">{i}</span>
                  </li>
                ))}
              </ul>
              {!started && s.status === "scheduled" ? (
                <div className="flex flex-col gap-2">
                  <MemberPick gymId={ctx.gymId} id="s-member" label={t("classes.bookMember")} value={member} onChange={setMember} />
                  <Button
                    variant="secondary"
                    disabled={!member}
                    busy={busy}
                    confirm={member ? { kind: "add", title: t("classes.bookAsk", { name: member.displayName }) } : undefined}
                    onClick={() =>
                      member &&
                      void run(() => gymOps2.deskBook(ctx.gymId, s.id, member.id, key), t("classes.booked")).then((ok) => {
                        if (ok) {
                          setMember(null);
                          setKey(newKey());
                        }
                      })
                    }
                    data-testid="session-book"
                  >
                    {s.spaces ? t("classes.book") : t("classes.bookWaitlist")}
                  </Button>
                </div>
              ) : null}
              {started && s.status !== "cancelled" ? (
                <Button onClick={() => void run(() => gymOps2.attendance(ctx.gymId, s.id, [...marking]), t("classes.marked"))} busy={busy} confirm="save" data-testid="session-mark">
                  {t("classes.saveAttendance")}
                </Button>
              ) : null}
              {!started && s.status === "scheduled" && ctx.can("classes.manage") ? (
                <Button variant="ghost" className="self-start" onClick={() => setCancelling(true)}>
                  {t("classes.cancelSession")}
                </Button>
              ) : null}
              {problem ? (
                <p role="alert" className="text-sm text-danger">
                  {problem}
                </p>
              ) : null}
            </>
          )}
        </div>
      </Dialog>
      <ReasonDialog
        open={cancelling}
        onOpenChange={(o) => !o && setCancelling(false)}
        title={t("classes.cancelSessionTitle")}
        description={t("classes.cancelSessionBody")}
        confirmLabel={t("classes.cancelSession")}
        danger
        busy={busy}
        error={problem}
        onConfirm={(reason) => void run(() => gymOps2.cancelSession(ctx.gymId, sessionId, reason), t("classes.sessionCancelled")).then((ok) => ok && setCancelling(false))}
        testId="session-cancel"
      />
    </>
  );
}

"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CaretLeft, CaretRight, Clock, IdentificationBadge, PencilSimple, Plus, SignIn, SignOut, Trash } from "@phosphor-icons/react";
import { Badge, Button, Card, DataTable, Dialog, EmptyState, IconButton, Notice, SegmentedControl, Select, SkeletonList, useToast } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { dhakaToday } from "@/lib/gym-manage";
import { WEEK_DOWS } from "@/lib/gym-ops";
import { gymStaff, hoursText, shiftMonth, thisMonth, type ShiftInput, type StaffShifts } from "@/lib/gym-staff";
import { GymPage, useFmt, useGymError, type GymCtx } from "../gym-manage/common";

/**
 * /manage/[gymId]/staff (M27-FR-72 to FR-75; shifts.manage, reads also reports.view; Standard plan): today's
 * board (who is clocked in, shifts, clock times, late), each staff member's weekly shifts, and the month's
 * report (hours, days, late and missed shifts). shifts.manage clocks someone in or out at the desk; staff clock
 * themselves on My work by scanning the entrance QR.
 */
export function Staff({ gymId }: { gymId: string }) {
  const t = useTranslations("gt");
  return (
    <GymPage gymId={gymId} page="staff" feature="staff_attendance" wide title={t("staff.title")} description={t("staff.lead")} testId="gt-staff">
      {(ctx) => <Body ctx={ctx} />}
    </GymPage>
  );
}

type View = "today" | "shifts" | "month";

function Body({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gt");
  const [view, setView] = useState<View>("today");
  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label={t("staff.title")}
        value={view}
        onChange={setView}
        className="self-start"
        options={(["today", "shifts", "month"] as const).map((v) => ({ value: v, label: t(`staff.view.${v}`) }))}
      />
      {view === "today" ? <Today ctx={ctx} /> : view === "shifts" ? <Shifts ctx={ctx} /> : <Month ctx={ctx} />}
    </div>
  );
}

function Today({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gt");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["gt-board", ctx.gymId], queryFn: () => gymStaff.board(ctx.gymId), refetchInterval: 60_000 });
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const canClock = ctx.can("shifts.manage");
  const clock = async (staffId: string, kind: "in" | "out") => {
    setBusy(staffId);
    setProblem(null);
    try {
      await gymStaff.clockAtDesk(ctx.gymId, staffId, kind);
      toast.show(kind === "in" ? t("staff.clockedIn") : t("staff.clockedOut"));
      void qc.invalidateQueries({ queryKey: ["gt-board", ctx.gymId] });
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(null);
    }
  };
  if (q.isPending) return <SkeletonList rows={4} />;
  if (q.isError) return <Notice tone="error">{err(q.error)}</Notice>;
  if (!q.data.items.length) return <EmptyState icon={<IdentificationBadge size={28} aria-hidden />} title={t("staff.noStaff")} body={t("staff.noStaffHint")} />;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold" data-testid="staff-in-now">
        {t("staff.inNow", { n: f.n(q.data.inNow) })}
      </p>
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <ul className="grid gap-2 md:grid-cols-2" data-testid="staff-board">
        {q.data.items.map((s) => (
          <li key={s.staff.id}>
            <Card className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{s.staff.name ?? "–"}</p>
                  <p className="text-xs text-muted">{s.shifts.length ? s.shifts.map((x) => `${x.startTime}–${x.endTime}`).join(", ") : t("staff.noShiftToday")}</p>
                </div>
                <span className="flex shrink-0 gap-1">
                  {s.late ? <Badge tone="warning">{t("staff.late")}</Badge> : null}
                  <Badge tone={s.clockedIn ? "brand" : "neutral"}>{s.clockedIn ? t("staff.in", { time: f.time(s.since) }) : t("staff.out")}</Badge>
                </span>
              </div>
              {s.times.length ? (
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                  {s.times.map((x) => (
                    <span key={x.id} className="inline-flex items-center gap-1">
                      {x.kind === "in" ? <SignIn size={12} aria-hidden /> : <SignOut size={12} aria-hidden />}
                      {f.time(x.at)}
                      {x.method === "auto" ? ` (${t("staff.method.auto")})` : x.method === "desk" ? ` (${t("staff.method.desk")})` : ""}
                    </span>
                  ))}
                </p>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">{t("staff.workedToday", { time: hoursText(s.minutes, (k, v) => t(`time.${k}`, v)) })}</span>
                {canClock ? (
                  <Button size="sm" variant={s.clockedIn ? "secondary" : "primary"} busy={busy === s.staff.id}
                    confirm={{ kind: "save", title: t(s.clockedIn ? "staff.clockOutAsk" : "staff.clockInAsk", { name: s.staff.name ?? "–" }), confirmLabel: s.clockedIn ? t("staff.clockOut") : t("staff.clockIn") }}
                    onClick={() => void clock(s.staff.id, s.clockedIn ? "out" : "in")}
                    data-testid={`staff-clock-${s.staff.id}`}>
                    {s.clockedIn ? <SignOut size={16} aria-hidden /> : <SignIn size={16} aria-hidden />}
                    {s.clockedIn ? t("staff.clockOut") : t("staff.clockIn")}
                  </Button>
                ) : null}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Shifts({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gt");
  const err = useGymError();
  const q = useQuery({ queryKey: ["gt-shifts", ctx.gymId], queryFn: () => gymStaff.shifts(ctx.gymId) });
  const [editing, setEditing] = useState<StaffShifts["items"][number] | null>(null);
  if (q.isPending) return <SkeletonList rows={4} />;
  if (q.isError) return <Notice tone="error">{err(q.error)}</Notice>;
  if (!q.data.items.length) return <EmptyState icon={<IdentificationBadge size={28} aria-hidden />} title={t("staff.noStaff")} body={t("staff.noStaffHint")} />;
  return (
    <>
      <ul className="grid gap-2 md:grid-cols-2" data-testid="staff-shifts">
        {q.data.items.map((s) => (
          <li key={s.staff.id}>
            <Card className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{s.staff.name ?? "–"}</p>
                {s.shifts.length ? (
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {s.shifts.map((x) => (
                      <li key={x.id}>
                        <Badge tone="neutral">
                          {t(`dow.${x.dow}`)} {x.startTime}–{x.endTime}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">{t("staff.noShifts")}</p>
                )}
              </div>
              {ctx.can("shifts.manage") ? (
                <IconButton label={t("staff.editShifts")} variant="secondary" onClick={() => setEditing(s)}>
                  <PencilSimple size={18} aria-hidden />
                </IconButton>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
      {editing ? <ShiftDialog ctx={ctx} item={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

function ShiftDialog({ ctx, item, onClose }: { ctx: GymCtx; item: StaffShifts["items"][number]; onClose: () => void }) {
  const t = useTranslations("gt");
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const [rows, setRows] = useState<ShiftInput[]>(item.shifts.map((x) => ({ dow: x.dow, startTime: x.startTime, endTime: x.endTime })));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const set = (i: number, patch: Partial<ShiftInput>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const save = async () => {
    if (rows.some((r) => r.endTime <= r.startTime)) return setProblem(t("staff.shiftBad"));
    setBusy(true);
    setProblem(null);
    try {
      await gymStaff.setShifts(ctx.gymId, item.staff.id, rows);
      toast.show(t("staff.shiftsSaved"));
      void qc.invalidateQueries({ queryKey: ["gt-shifts", ctx.gymId] });
      void qc.invalidateQueries({ queryKey: ["gt-board", ctx.gymId] });
      onClose();
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()} title={t("staff.shiftsOf", { name: item.staff.name ?? "–" })} description={t("staff.shiftsHint")}>
      <div className="flex flex-col gap-3 px-6 pb-5">
        {rows.length ? (
          <ul className="flex flex-col gap-2" data-testid="shift-rows">
            {rows.map((r, i) => (
              <li key={i} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
                <Select id={`sh-d-${i}`} label={t("staff.day")} value={String(r.dow)} onChange={(e) => set(i, { dow: Number(e.target.value) })}>
                  {WEEK_DOWS.map((d) => (
                    <option key={d} value={d}>
                      {t(`dow.${d}`)}
                    </option>
                  ))}
                </Select>
                <Select id={`sh-s-${i}`} label={t("staff.from")} value={r.startTime} onChange={(e) => set(i, { startTime: e.target.value })}>
                  {TIMES.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </Select>
                <Select id={`sh-e-${i}`} label={t("staff.to")} value={r.endTime} onChange={(e) => set(i, { endTime: e.target.value })}>
                  {[...TIMES.slice(1), "23:59"].map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </Select>
                <IconButton label={t("staff.removeShift")} variant="ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  <Trash size={18} aria-hidden />
                </IconButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("staff.noShifts")}</p>
        )}
        <Button variant="secondary" className="self-start" onClick={() => setRows([...rows, { dow: rows.at(-1)?.dow ?? 6, startTime: rows.at(-1)?.startTime ?? "06:00", endTime: rows.at(-1)?.endTime ?? "14:00" }])}>
          <Plus size={18} aria-hidden />
          {t("staff.addShift")}
        </Button>
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void save()} busy={busy} confirm="save" data-testid="shifts-save">
            {t("save")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function Month({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gt");
  const f = useFmt();
  const err = useGymError();
  const current = thisMonth(dhakaToday());
  const [period, setPeriod] = useState(current);
  const q = useQuery({ queryKey: ["gt-report", ctx.gymId, period], queryFn: () => gymStaff.report(ctx.gymId, period) });
  const time = (m: number) => hoursText(m, (k, v) => t(`time.${k}`, v));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <IconButton label={t("prevMonth")} variant="secondary" onClick={() => setPeriod(shiftMonth(period, -1))}>
          <CaretLeft size={18} aria-hidden />
        </IconButton>
        <span className="min-w-36 text-center font-semibold">{f.month(period)}</span>
        <IconButton label={t("nextMonth")} variant="secondary" disabled={period >= current} onClick={() => setPeriod(shiftMonth(period, 1))}>
          <CaretRight size={18} aria-hidden />
        </IconButton>
      </div>
      {q.isPending ? (
        <SkeletonList rows={4} />
      ) : q.isError ? (
        <Notice tone="error">{err(q.error)}</Notice>
      ) : !q.data.items.length ? (
        <EmptyState icon={<Clock size={28} aria-hidden />} title={t("staff.noTimes")} />
      ) : (
        <DataTable
          label={t("staff.reportLabel", { month: f.month(period) })}
          testId="staff-report"
          rows={q.data.items}
          rowId={(x) => x.staff.id}
          rowProps={(x) => ({ tone: x.staff.status === "left" ? "muted" : undefined })}
          columns={[
            {
              id: "person",
              header: t("staff.person"),
              primary: true,
              sort: (x) => x.staff.name ?? "",
              cell: (x) => (
                <>
                  {x.staff.name ?? "–"}
                  {x.staff.status === "left" ? <span className="text-xs text-muted"> · {t("staff.left")}</span> : null}
                </>
              ),
            },
            { id: "hours", header: t("staff.hours"), align: "end", sort: (x) => x.workedMinutes, cell: (x) => time(x.workedMinutes), total: (rows) => time(rows.reduce((s, x) => s + x.workedMinutes, 0)) },
            { id: "days", header: t("staff.days"), align: "end", sort: (x) => x.days, cell: (x) => f.n(x.days), total: (rows) => f.n(rows.reduce((s, x) => s + x.days, 0)) },
            { id: "late", header: t("staff.lateCol"), align: "end", sort: (x) => x.late, cell: (x) => <span className={cn(x.late && "font-semibold text-warning")}>{f.n(x.late)}</span>, total: (rows) => f.n(rows.reduce((s, x) => s + x.late, 0)) },
            { id: "missed", header: t("staff.missedCol"), align: "end", sort: (x) => x.missed, cell: (x) => <span className={cn(x.missed && "font-semibold text-danger")}>{f.n(x.missed)}</span>, total: (rows) => f.n(rows.reduce((s, x) => s + x.missed, 0)) },
          ]}
        />
      )}
      <p className="text-xs text-muted">{t("staff.reportHint")}</p>
    </div>
  );
}


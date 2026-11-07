"use client";

import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Camera, ClockUser, Receipt, SignIn, SignOut } from "@phosphor-icons/react";
import { Badge, Button, Card, EmptyState, Notice, SkeletonList } from "@kriraghor/ui/kit";
import { featureLocked } from "@/lib/gym-manage";
import { entranceTokenFrom } from "@/lib/plans";
import { gymStaff, hoursText } from "@/lib/gym-staff";
import { canScan, useQrScanner } from "@/components/QrScanner";
import { GymPage, useFmt, useGymError, type GymCtx } from "../gym-manage/common";
import { PayslipDialog } from "./Payslip";

/**
 * /manage/[gymId]/my-work (staff with clock.in; never the owner): clock in and out by scanning the gym's
 * entrance QR with this phone (M27-FR-73), today's shifts and times and the month's hours; my payslips once
 * the owner approves the month (M27-FR-81). Each part shows only when the gym's plan has it.
 */
export function MyWork({ gymId }: { gymId: string }) {
  const t = useTranslations("gt");
  return (
    <GymPage gymId={gymId} page="mywork" title={t("my.title")} description={t("my.lead")} testId="gt-mywork">
      {(ctx) => <Body ctx={ctx} />}
    </GymPage>
  );
}

function Body({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gt");
  const clockOn = !featureLocked(ctx.gym.features, "staff_attendance");
  const payOn = !featureLocked(ctx.gym.features, "payroll");
  if (!clockOn && !payOn) return <EmptyState icon={<ClockUser size={28} aria-hidden />} title={t("my.nothing")} />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {clockOn ? <ClockCard ctx={ctx} /> : null}
      {payOn ? <Payslips ctx={ctx} /> : null}
    </div>
  );
}

function ClockCard({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gt");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["gt-myclock", ctx.gymId], queryFn: () => gymStaff.myClock(ctx.gymId) });
  const [camera, setCamera] = useState<"off" | "on" | "denied" | "unsupported">("off");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: true; kind: "in" | "out"; at: string; minutes: number | null } | { ok: false; message: string } | null>(null);
  const sent = useRef<string | null>(null);
  const time = (m: number) => hoursText(m, (k, v) => t(`time.${k}`, v));
  const submit = useCallback(
    async (raw: string) => {
      const token = entranceTokenFrom(raw);
      if (!token) return setResult({ ok: false, message: t("my.notEntrance") });
      if (sent.current === token) return;
      sent.current = token;
      setCamera("off");
      setBusy(true);
      try {
        const r = await gymStaff.clockByScan(token);
        setResult({ ok: true, kind: r.kind, at: r.at, minutes: r.minutes ?? null });
        void qc.invalidateQueries({ queryKey: ["gt-myclock", ctx.gymId] });
      } catch (e) {
        setResult({ ok: false, message: err(e) });
        sent.current = null;
      } finally {
        setBusy(false);
      }
    },
    [ctx.gymId, err, qc, t],
  );
  const onValue = useCallback((v: string) => void submit(v), [submit]);
  const onDenied = useCallback(() => setCamera("denied"), []);
  const video = useQrScanner({ on: camera === "on", onValue, onDenied });
  return (
    <Card className="flex flex-col gap-3" data-testid="my-clock">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <ClockUser size={22} aria-hidden /> {t("my.clockTitle")}
        </h2>
        {q.data ? <Badge tone={q.data.clockedIn ? "brand" : "neutral"}>{q.data.clockedIn ? t("staff.in", { time: f.time(q.data.since) }) : t("staff.out")}</Badge> : null}
      </div>
      {q.isPending ? (
        <SkeletonList rows={2} />
      ) : q.isError ? (
        <Notice tone="error">{err(q.error)}</Notice>
      ) : (
        <>
          <p className="text-sm text-muted">
            {q.data.todayShifts.length ? t("my.shiftsToday", { shifts: q.data.todayShifts.map((x) => `${x.startTime}–${x.endTime}`).join(", ") }) : t("staff.noShiftToday")}
            {" · "}
            {t("my.month", { time: time(q.data.monthMinutes) })}
          </p>
          {q.data.today.length ? (
            <p className="flex flex-wrap gap-x-3 text-sm">
              {q.data.today.map((x) => (
                <span key={x.id} className="inline-flex items-center gap-1">
                  {x.kind === "in" ? <SignIn size={14} aria-hidden /> : <SignOut size={14} aria-hidden />}
                  {f.time(x.at)}
                </span>
              ))}
            </p>
          ) : null}
        </>
      )}
      {result?.ok ? (
        <Notice tone="success" title={result.kind === "in" ? t("my.inDone", { time: f.time(result.at) }) : t("my.outDone", { time: f.time(result.at) })}>
          <span data-testid="clock-result">{result.kind === "out" && result.minutes != null ? t("my.shiftLength", { time: time(result.minutes) }) : t("my.haveAGoodShift")}</span>
        </Notice>
      ) : result ? (
        <Notice tone="error">{result.message}</Notice>
      ) : null}
      {camera === "on" ? (
        <>
          <video ref={video} muted playsInline className="aspect-square w-full max-w-[420px] rounded-control bg-black object-cover" />
          <Button type="button" variant="secondary" onClick={() => setCamera("off")}>
            {t("my.stop")}
          </Button>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <Button type="button" size="lg" icon={<Camera size={20} aria-hidden />} busy={busy} onClick={() => setCamera(canScan() ? "on" : "unsupported")} data-testid="clock-scan">
            {q.data?.clockedIn ? t("my.scanOut") : t("my.scanIn")}
          </Button>
          <p className="text-xs text-muted">{t("my.scanHint")}</p>
          {camera === "unsupported" ? <p className="text-sm text-muted">{t("my.noScanner")}</p> : null}
          {camera === "denied" ? <p className="text-sm text-danger">{t("my.cameraDenied")}</p> : null}
        </div>
      )}
    </Card>
  );
}

function Payslips({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gt");
  const f = useFmt();
  const err = useGymError();
  const q = useQuery({ queryKey: ["gt-mypayslips", ctx.gymId], queryFn: () => gymStaff.myPayslips(ctx.gymId) });
  const [open, setOpen] = useState<{ runId: string; lineId: string } | null>(null);
  return (
    <Card className="flex flex-col gap-3" data-testid="my-payslips">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <Receipt size={22} aria-hidden /> {t("my.payslips")}
      </h2>
      {q.isPending ? (
        <SkeletonList rows={2} />
      ) : q.isError ? (
        <Notice tone="error">{err(q.error)}</Notice>
      ) : !q.data.items.length ? (
        <p className="text-sm text-muted">{t("my.noPayslips")}</p>
      ) : (
        <ul className="divide-y divide-line">
          {q.data.items.map((x) => (
            <li key={x.lineId}>
              <button type="button" onClick={() => setOpen({ runId: x.runId, lineId: x.lineId })} className="flex w-full items-center justify-between gap-2 py-2.5 text-left hover:bg-surface-2">
                <span className="font-semibold">{f.month(x.period)}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">{f.taka(x.netPoisha)}</span>
                  <Badge tone={x.status === "paid" ? "brand" : "warning"}>{x.status === "paid" ? t("payroll.paid") : t("payroll.unpaid")}</Badge>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open ? <PayslipDialog gymId={ctx.gymId} runId={open.runId} lineId={open.lineId} onClose={() => setOpen(null)} /> : null}
    </Card>
  );
}

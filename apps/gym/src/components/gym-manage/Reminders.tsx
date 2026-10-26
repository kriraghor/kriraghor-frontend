"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { BellRinging, ChatText } from "@phosphor-icons/react";
import { Badge, Card, EmptyState, Notice, Skeleton, useToast } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { gymManage } from "@/lib/gym-manage";
import { gymMoney, remindersOffAfter, type ReminderKind, type RemindersPage } from "@/lib/gym-money";
import { GymPage, Row, useFmt, useGymError, type GymCtx } from "./common";

/**
 * /manage/[gymId]/reminders (owner; feature reminders, Basic and up; M24-FR-55 to FR-61): each reminder
 * kind on or off (saved in the gym's settings, remindersOff), the offsets from Kriraghor's settings
 * (read-only), SMS (comes with the add-on), how many active members only SMS could reach, and the last
 * days of reminders sent (kind, date, channels, member code; never the message or a phone).
 */
export function Reminders({ gymId }: { gymId: string }) {
  const t = useTranslations("gm");
  return (
    <GymPage gymId={gymId} page="reminders" feature="reminders" title={t("reminders.title")} description={t("reminders.lead")} testId="gm-reminders">
      {(ctx) => <Body ctx={ctx} />}
    </GymPage>
  );
}

function Body({ ctx }: { ctx: GymCtx }) {
  const err = useGymError();
  const q = useQuery({ queryKey: ["gm-reminders", ctx.gymId], queryFn: () => gymMoney.reminders(ctx.gymId), retry: false });
  if (q.isPending) return <Skeleton className="h-64 rounded-card" />;
  if (q.isError) return <Notice tone="error">{err(q.error)}</Notice>;
  return <Page ctx={ctx} r={q.data} />;
}

function Page({ ctx, r }: { ctx: GymCtx; r: RemindersPage }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState<ReminderKind | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const flip = async (kind: ReminderKind, on: boolean) => {
    setBusy(kind);
    setProblem(null);
    try {
      await gymManage.saveSettings(ctx.gymId, { remindersOff: remindersOffAfter(r.kinds, kind, on) });
      await qc.invalidateQueries({ queryKey: ["gm-reminders", ctx.gymId] });
      await qc.invalidateQueries({ queryKey: ["gm-settings", ctx.gymId] });
      toast.show(on ? t("reminders.turnedOn", { kind: t(`reminders.kind.${kind}`) }) : t("reminders.turnedOff", { kind: t(`reminders.kind.${kind}`) }));
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      {r.restricted ? <Notice tone="error" title={t("reminders.restricted")}>{t("reminders.restrictedBody")}</Notice> : null}
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Card padded={false} className="p-4" data-testid="reminder-kinds">
          <h2 className="font-display text-lg font-bold">{t("reminders.kinds")}</h2>
          <ul className="mt-2 divide-y divide-line">
            {r.kinds.map((k) => (
              <li key={k.kind} className="flex items-center gap-3 py-2.5" data-testid={`reminder-${k.kind}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t(`reminders.kind.${k.kind}`)}</p>
                  <p className="text-xs text-muted">
                    {t(`reminders.when.${k.kind}`, { days: r.offsets.remindBeforeDays, overdue: r.offsets.overdueRemindDays.join(", "), time: r.offsets.morningSummaryTime })} · {k.member ? t("reminders.toMember") : t("reminders.toYou")}
                  </p>
                </div>
                <Switch on={k.on} busy={busy === k.kind} label={t(`reminders.kind.${k.kind}`)} onChange={(on) => void flip(k.kind, on)} testId={`reminder-switch-${k.kind}`} />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">{t("reminders.channels")}</p>
        </Card>
        <div className="flex flex-col gap-4">
          <Card padded={false} className="p-4" data-testid="reminder-offsets">
            <h2 className="font-display text-lg font-bold">{t("reminders.timing")}</h2>
            <div className="mt-1 divide-y divide-line">
              <Row label={t("reminders.before")}>{t("reminders.days", { n: r.offsets.remindBeforeDays })}</Row>
              <Row label={t("reminders.overdueAfter")}>{r.offsets.overdueRemindDays.map((d) => f.n(d)).join(", ")}</Row>
              <Row label={t("reminders.morningAt")}>{r.offsets.morningSummaryTime}</Row>
            </div>
            <p className="mt-2 text-xs text-muted">{t("reminders.timingHint")}</p>
          </Card>
          <Card padded={false} className="p-4" data-testid="reminder-reach">
            <h2 className="font-display text-lg font-bold">{t("reminders.reach")}</h2>
            <p className="mt-1 font-display text-3xl font-extrabold tabular-nums" data-testid="reminder-sms-only">
              {f.n(r.reachability.smsOnly)}
            </p>
            <p className="text-sm text-muted">{t("reminders.smsOnly", { n: r.reachability.smsOnly, active: f.n(r.reachability.activeMembers) })}</p>
          </Card>
          <Card padded={false} className="flex gap-3 border-dashed p-4" data-testid="reminder-sms">
            <ChatText size={24} className="shrink-0 text-muted" aria-hidden />
            <div>
              <p className="font-semibold">{t("reminders.sms")}</p>
              <p className="text-sm text-muted">{r.sms.available ? t("reminders.smsAvailable") : t("reminders.smsSoon")}</p>
            </div>
          </Card>
        </div>
      </div>
      <Log r={r} />
    </div>
  );
}

/** An accessible on/off switch (a button with role switch), a big tap target for phones. */
function Switch({ on, busy, label, onChange, testId }: { on: boolean; busy: boolean; label: string; onChange: (on: boolean) => void; testId?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={() => onChange(!on)}
      className={cn("relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors disabled:opacity-60", on ? "border-brand bg-brand" : "border-line-strong bg-surface-2")}
      data-testid={testId}
      data-on={on}
    >
      <span className={cn("absolute size-5 rounded-full bg-white shadow transition-transform", on ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}

function Log({ r }: { r: RemindersPage }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const kindLabel = (k: string) => (t.has(`reminders.kind.${k}`) ? t(`reminders.kind.${k}`) : k);
  return (
    <Card padded={false} className="p-4" data-testid="reminder-log">
      <h2 className="font-display text-lg font-bold">{t("reminders.log", { days: r.log.days })}</h2>
      {!r.log.items.length ? (
        <EmptyState icon={<BellRinging size={28} aria-hidden />} title={t("reminders.logEmpty")} />
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="py-1.5 pr-3 font-semibold">{t("reminders.col.date")}</th>
                <th scope="col" className="py-1.5 pr-3 font-semibold">{t("reminders.col.kind")}</th>
                <th scope="col" className="py-1.5 pr-3 font-semibold">{t("reminders.col.member")}</th>
                <th scope="col" className="py-1.5 pr-3 font-semibold">{t("reminders.col.channels")}</th>
                <th scope="col" className="py-1.5 font-semibold">{t("reminders.col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {r.log.items.map((i) => (
                <tr key={i.id} className="border-t border-line" data-testid="reminder-log-row">
                  <td className="py-1.5 pr-3 tabular-nums">{f.short(i.date)}</td>
                  <td className="py-1.5 pr-3">{kindLabel(i.kind)}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{i.memberCode ?? "–"}</td>
                  <td className="py-1.5 pr-3">{i.channels.length ? i.channels.map((c) => (t.has(`reminders.channel.${c}`) ? t(`reminders.channel.${c}`) : c)).join(", ") : "–"}</td>
                  <td className="py-1.5">
                    {i.status === "published" ? <Badge tone="brand">{t("reminders.sent")}</Badge> : <Badge>{t.has(`reminders.skip.${i.skipReason}`) ? t(`reminders.skip.${i.skipReason}`) : t("reminders.skipped")}</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

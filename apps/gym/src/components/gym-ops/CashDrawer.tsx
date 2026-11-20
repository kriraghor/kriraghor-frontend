"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CheckCircle, Printer, Vault, Warning } from "@phosphor-icons/react";
import { Badge, Button, Card, Field, Notice, Skeleton, Textarea, useConfirm, useToast } from "@kriraghor/ui/kit";
import { DatePicker } from "@kriraghor/ui/date";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { cn } from "@kriraghor/ui/cn";
import { dhakaToday, takaToPoisha } from "@/lib/gym-manage";
import { drawerTone, gymOps, type Drawer } from "@/lib/gym-ops";
import { GymPage, Row, useFmt, useGymError, type GymCtx } from "../gym-manage/common";
import { useWaitingCount } from "../manage/offline/OfflineDesk";

/**
 * /manage/[gymId]/cash (M27-FR-06 to FR-09): today's cash drawer. The cashier opens it with a float and
 * closes it with the counted cash; the expected amount (float + cash fees + cash sales − cash paid out of
 * the drawer) and the difference are kept. A closed day refuses more cash. Earlier days are read-only.
 * cash.drawer works it; reports.view reads it.
 */
export function CashDrawer({ gymId }: { gymId: string }) {
  const t = useTranslations("go");
  return (
    <GymPage gymId={gymId} page="cash" feature="expenses" title={t("drawer.title")} description={t("drawer.lead")} testId="go-drawer">
      {(ctx) => <Body ctx={ctx} />}
    </GymPage>
  );
}

function Body({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("go");
  const err = useGymError();
  const today = dhakaToday();
  const [date, setDate] = useState(today);
  const q = useQuery({ queryKey: ["go-drawer", ctx.gymId, date], queryFn: () => gymOps.drawer(ctx.gymId, date) });
  const canWork = ctx.can("cash.drawer") && date === today;
  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <DatePicker id="drawer-date" label={t("drawer.day")} value={date} max={today} clearable={false} onChange={(v) => v && setDate(v)} className="w-56" />
        <div className="flex gap-2">
          <Link href={`/manage/${ctx.gymId}/fees/closing`} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-text underline-offset-4 hover:underline">
            {t("drawer.byMethod")}
          </Link>
          {q.data?.status === "closed" ? (
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={18} aria-hidden />
              {t("print")}
            </Button>
          ) : null}
        </div>
      </div>
      {q.isPending ? <Skeleton className="h-64 rounded-card" /> : q.isError ? <Notice tone="error">{err(q.error)}</Notice> : <DrawerView ctx={ctx} d={q.data} canWork={canWork} />}
    </div>
  );
}

function DrawerView({ ctx, d, canWork }: { ctx: GymCtx; d: Drawer; canWork: boolean }) {
  const t = useTranslations("go");
  const f = useFmt();
  const tone = drawerTone(d.differencePoisha);
  return (
    <div className="print-area grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      <Card className="flex flex-col gap-1" data-testid="drawer-sheet">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg font-bold">{ctx.gym.name}</p>
            <p className="text-sm text-muted">{f.date(d.date)}</p>
          </div>
          <Badge tone={d.status === "open" ? "brand" : d.status === "closed" ? "neutral" : "warning"}>{t(`drawer.status.${d.status}`)}</Badge>
        </div>
        <Row label={t("drawer.opening")}>{f.taka(d.openingPoisha ?? 0)}</Row>
        <Row label={t("drawer.cashFees")}>+ {f.taka(d.cash.feesPoisha)}</Row>
        <Row label={t("drawer.cashSales")}>+ {f.taka(d.cash.salesPoisha)}</Row>
        <Row label={t("drawer.paidOut")}>− {f.taka(d.cash.expensesPoisha)}</Row>
        <div className="my-1 border-t border-line" />
        <Row label={<span className="font-semibold text-ink">{t("drawer.expected")}</span>}>
          <span className="font-display text-xl" data-testid="drawer-expected">
            {f.taka(d.cash.expectedPoisha)}
          </span>
        </Row>
        {d.status === "closed" ? (
          <>
            <Row label={t("drawer.counted")}>{f.taka(d.countedPoisha)}</Row>
            <div
              className={cn(
                "mt-2 flex items-center gap-2 rounded-control px-3 py-2 text-sm font-semibold",
                tone === "balanced" ? "bg-brand-soft text-brand-text" : tone === "short" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning",
              )}
              data-testid="drawer-difference"
            >
              {tone === "balanced" ? <CheckCircle size={18} weight="fill" aria-hidden /> : <Warning size={18} weight="fill" aria-hidden />}
              {tone === "balanced" ? t("drawer.balanced") : t(tone === "short" ? "drawer.short" : "drawer.over", { amount: f.taka(Math.abs(d.differencePoisha ?? 0)) })}
            </div>
            {d.closeNote ? <p className="mt-2 text-sm text-muted">{d.closeNote}</p> : null}
            <p className="mt-2 text-xs text-muted">{t("drawer.closedBy", { name: d.closedBy ?? "–", time: f.time(d.closedAt) })}</p>
          </>
        ) : d.status === "open" ? (
          <p className="mt-2 text-xs text-muted">{t("drawer.openedBy", { name: d.openedBy ?? "–", time: f.time(d.openedAt) })}</p>
        ) : null}
      </Card>
      <div className="no-print">{canWork ? d.status === "not_open" ? <OpenForm ctx={ctx} /> : d.status === "open" ? <CloseForm ctx={ctx} d={d} /> : <ClosedNote /> : <ReadOnlyNote status={d.status} />}</div>
    </div>
  );
}

function useRefresh(gymId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["go-drawer", gymId] });
    void qc.invalidateQueries({ queryKey: ["gm-overview", gymId] });
  };
}

function OpenForm({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("go");
  const f = useFmt();
  const ask = useConfirm();
  const err = useGymError();
  const toast = useToast();
  const refresh = useRefresh(ctx.gymId);
  const [taka, setTaka] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const open = async (e: React.FormEvent) => {
    e.preventDefault();
    const poisha = takaToPoisha(taka || "0", { allowZero: true });
    if (poisha == null) return setProblem(t("amountBad"));
    if (!(await ask({ kind: "money", title: t("drawer.openAsk", { amount: f.taka(poisha) }), confirmLabel: t("drawer.open") }))) return;
    setBusy(true);
    setProblem(null);
    try {
      await gymOps.openDrawer(ctx.gymId, poisha);
      toast.show(t("drawer.opened"));
      refresh();
    } catch (e2) {
      setProblem(err(e2));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <form onSubmit={open} className="flex flex-col gap-3" data-testid="drawer-open-form">
        <div className="flex items-center gap-2">
          <Vault size={22} className="text-brand-text" aria-hidden />
          <h2 className="font-display text-lg font-bold">{t("drawer.openTitle")}</h2>
        </div>
        <p className="text-sm text-muted">{t("drawer.openHint")}</p>
        <Field id="drawer-float" label={t("drawer.float")} inputMode="decimal" leading="৳" value={taka} onChange={(e) => setTaka(e.target.value)} placeholder="0" data-testid="drawer-float" />
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
        <Button type="submit" busy={busy} data-testid="drawer-open">
          {t("drawer.open")}
        </Button>
      </form>
    </Card>
  );
}

function CloseForm({ ctx, d }: { ctx: GymCtx; d: Drawer }) {
  const t = useTranslations("go");
  const f = useFmt();
  const err = useGymError();
  const toast = useToast();
  const refresh = useRefresh(ctx.gymId);
  const tOff = useTranslations("off.drawer");
  const ask = useConfirm();
  // M24 §22: the day cannot be closed while this device still has offline items to send.
  const waiting = useWaitingCount(ctx.gymId);
  const [taka, setTaka] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const counted = takaToPoisha(taka, { allowZero: true });
  const diff = counted == null || d.cash.expectedPoisha == null ? null : counted - d.cash.expectedPoisha;
  const tone = drawerTone(diff);
  const close = async (e: React.FormEvent) => {
    e.preventDefault();
    if (waiting) return setProblem(tOff("waiting", { n: waiting }));
    if (counted == null) return setProblem(t("amountBad"));
    if (diff !== 0 && !note.trim()) return setProblem(t("drawer.noteNeeded"));
    if (!(await ask({ kind: "money", title: t("drawer.closeAsk", { amount: f.taka(counted) }), body: t("drawer.closeAskBody"), confirmLabel: t("drawer.close") }))) return;
    setBusy(true);
    setProblem(null);
    try {
      await gymOps.closeDrawer(ctx.gymId, counted, note.trim() || null);
      toast.show(t("drawer.closed"));
      refresh();
    } catch (e2) {
      setProblem(err(e2));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <form onSubmit={close} className="flex flex-col gap-3" data-testid="drawer-close-form">
        <h2 className="font-display text-lg font-bold">{t("drawer.closeTitle")}</h2>
        <p className="text-sm text-muted">{t("drawer.closeHint")}</p>
        {waiting ? (
          <Notice tone="warning" data-testid="drawer-offline-waiting">
            {tOff("waiting", { n: waiting })}
          </Notice>
        ) : null}
        <Field id="drawer-counted" label={t("drawer.counted")} inputMode="decimal" leading="৳" value={taka} onChange={(e) => setTaka(e.target.value)} data-testid="drawer-counted" />
        {tone ? (
          <p className={cn("text-sm font-semibold", tone === "balanced" ? "text-brand-text" : tone === "short" ? "text-danger" : "text-warning")} aria-live="polite">
            {tone === "balanced" ? t("drawer.balanced") : t(tone === "short" ? "drawer.short" : "drawer.over", { amount: f.taka(Math.abs(diff ?? 0)) })}
          </p>
        ) : null}
        <Textarea id="drawer-note" label={t("note")} optional={diff ? undefined : t("optional")} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} hint={diff ? t("drawer.noteHint") : undefined} />
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
        <Button type="submit" busy={busy} disabled={waiting > 0} data-testid="drawer-close">
          {t("drawer.close")}
        </Button>
      </form>
    </Card>
  );
}

function ClosedNote() {
  const t = useTranslations("go");
  return <Notice tone="info">{t("drawer.closedToday")}</Notice>;
}

function ReadOnlyNote({ status }: { status: Drawer["status"] }) {
  const t = useTranslations("go");
  return <Notice tone="info">{status === "not_open" ? t("drawer.notOpened") : t("drawer.readOnly")}</Notice>;
}

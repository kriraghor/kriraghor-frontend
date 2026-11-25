"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowsClockwise, CheckCircle, Money, PencilSimple, Receipt } from "@phosphor-icons/react";
import { Badge, Button, Card, Checkbox, DataTable, Dialog, EmptyState, Field, IconButton, Notice, ReasonDialog, SegmentedControl, Select, SkeletonList, useConfirm, useToast } from "@kriraghor/ui/kit";
import { newKey } from "@kriraghor/ui/format";
import { dhakaToday } from "@/lib/gym-manage";
import { bpsToPct, gymStaff, hoursText, PAY_METHODS, pctToBps, shiftMonth, thisMonth, type PayMethod, type PayrollLine, type PayrollRun, type PayTerms } from "@/lib/gym-staff";
import type { Column } from "@kriraghor/ui/kit";
import { GymPage, useFmt, useGymError, type GymCtx } from "../gym-manage/common";
import { PayslipDialog } from "./Payslip";

/**
 * /manage/[gymId]/payroll (M27-FR-76 to FR-81; the owner only; Pro plan): each staff member's pay terms (base,
 * a trainer's commission on the fees of their members, a commission on their counter sales); the months, each
 * drafted from the terms and the month's facts, with bonuses and deductions, approved, then paid line by line
 * (each payment is a salary expense, so it shows in profit and loss); payslips. Kriraghor never pays staff.
 */
export function Payroll({ gymId }: { gymId: string }) {
  const t = useTranslations("gt");
  return (
    <GymPage gymId={gymId} page="payroll" feature="payroll" wide title={t("payroll.title")} description={t("payroll.lead")} testId="gt-payroll">
      {(ctx) => <Body ctx={ctx} />}
    </GymPage>
  );
}

function Body({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gt");
  const [view, setView] = useState<"months" | "terms">("months");
  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label={t("payroll.title")}
        value={view}
        onChange={setView}
        className="self-start"
        options={[
          { value: "months", label: t("payroll.months") },
          { value: "terms", label: t("payroll.terms") },
        ]}
      />
      {view === "months" ? <Months ctx={ctx} /> : <Terms ctx={ctx} />}
    </div>
  );
}

// ---------------------------------------------------------------- pay terms

function Terms({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gt");
  const f = useFmt();
  const err = useGymError();
  const q = useQuery({ queryKey: ["gt-terms", ctx.gymId], queryFn: () => gymStaff.payTerms(ctx.gymId) });
  const [editing, setEditing] = useState<PayTerms["items"][number] | null>(null);
  if (q.isPending) return <SkeletonList rows={4} />;
  if (q.isError) return <Notice tone="error">{err(q.error)}</Notice>;
  if (!q.data.items.length) return <EmptyState icon={<Money size={28} aria-hidden />} title={t("staff.noStaff")} body={t("staff.noStaffHint")} />;
  return (
    <>
      <ul className="grid gap-2 md:grid-cols-2" data-testid="pay-terms">
        {q.data.items.map((x) => (
          <li key={x.staff.id}>
            <Card className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{x.staff.name ?? "–"}</p>
                {x.terms.set ? (
                  <p className="text-sm text-muted">
                    {t("payroll.termsLine", { base: f.taka(x.terms.basePoisha) })}
                    {x.terms.ptCommissionBps ? ` · ${t("payroll.ptShort", { pct: f.n(x.terms.ptCommissionBps / 100) })}` : ""}
                    {x.terms.salesCommissionBps ? ` · ${t("payroll.salesShort", { pct: f.n(x.terms.salesCommissionBps / 100) })}` : ""}
                  </p>
                ) : (
                  <p className="text-sm text-warning">{t("payroll.noTerms")}</p>
                )}
              </div>
              <IconButton label={t("payroll.editTerms")} variant="secondary" onClick={() => setEditing(x)}>
                <PencilSimple size={18} aria-hidden />
              </IconButton>
            </Card>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">{t("payroll.termsHint")}</p>
      {editing ? <TermsDialog ctx={ctx} item={editing} limits={q.data.limits} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

const takaText = (poisha: number) => (poisha % 100 ? (poisha / 100).toFixed(2) : String(poisha / 100));
const toPoisha = (text: string): number | null => (/^\d{1,9}(\.\d{1,2})?$/.test(text.trim()) ? Math.round(Number(text) * 100) : null);

function TermsDialog({ ctx, item, limits, onClose }: { ctx: GymCtx; item: PayTerms["items"][number]; limits: PayTerms["limits"]; onClose: () => void }) {
  const t = useTranslations("gt");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const [base, setBase] = useState(item.terms.set ? takaText(item.terms.basePoisha) : "");
  const [pt, setPt] = useState(bpsToPct(item.terms.ptCommissionBps));
  const [sales, setSales] = useState(bpsToPct(item.terms.salesCommissionBps));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const save = async () => {
    const basePoisha = toPoisha(base);
    const ptBps = pctToBps(pt);
    const salesBps = pctToBps(sales);
    if (basePoisha === null || basePoisha > limits.salaryMax) return setProblem(t("payroll.baseBad", { max: f.taka(limits.salaryMax) }));
    if (ptBps === null || salesBps === null || ptBps > limits.commissionMax || salesBps > limits.commissionMax) return setProblem(t("payroll.pctBad", { max: f.n(limits.commissionMax / 100) }));
    setBusy(true);
    setProblem(null);
    try {
      await gymStaff.setPayTerms(ctx.gymId, item.staff.id, { basePoisha, ptCommissionBps: ptBps, salesCommissionBps: salesBps });
      toast.show(t("payroll.termsSaved"));
      void qc.invalidateQueries({ queryKey: ["gt-terms", ctx.gymId] });
      onClose();
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()} title={t("payroll.termsOf", { name: item.staff.name ?? "–" })}>
      <div className="flex flex-col gap-3 px-6 pb-5">
        <Field id="pt-base" label={t("payroll.base")} inputMode="decimal" leading="৳" value={base} onChange={(e) => setBase(e.target.value)} hint={t("payroll.baseHint")} autoFocus />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="pt-pt" label={t("payroll.ptPct")} inputMode="decimal" value={pt} onChange={(e) => setPt(e.target.value)} hint={item.staff.trainer ? t("payroll.ptHint") : t("payroll.ptNotTrainer")} />
          <Field id="pt-sales" label={t("payroll.salesPct")} inputMode="decimal" value={sales} onChange={(e) => setSales(e.target.value)} hint={item.staff.seller ? t("payroll.salesHint") : t("payroll.salesNotSeller")} />
        </div>
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void save()} busy={busy} confirm="save" data-testid="terms-save">
            {t("save")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- months

const RUN_TONE = { draft: "warning", approved: "info", paid: "brand", void: "neutral" } as const;

function Months({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gt");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const current = thisMonth(dhakaToday());
  const q = useQuery({ queryKey: ["gt-runs", ctx.gymId], queryFn: () => gymStaff.runs(ctx.gymId) });
  const [open, setOpen] = useState<string | null>(null);
  const [period, setPeriod] = useState(current);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const draft = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const r = await gymStaff.draft(ctx.gymId, period);
      void qc.invalidateQueries({ queryKey: ["gt-runs", ctx.gymId] });
      setOpen(r.id);
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  if (open) return <RunView ctx={ctx} runId={open} onBack={() => setOpen(null)} />;
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-end gap-3">
        <Select id="pr-period" label={t("payroll.month")} value={period} onChange={(e) => setPeriod(e.target.value)} className="w-48">
          {[0, 1, 2].map((n) => {
            const p = n ? shiftMonth(n === 1 ? current : shiftMonth(current, -1), -1) : current;
            return (
              <option key={p} value={p}>
                {f.month(p)}
              </option>
            );
          })}
        </Select>
        <Button onClick={() => void draft()} busy={busy} confirm={{ kind: "add", title: t("payroll.draftAsk", { month: f.month(period) }), confirmLabel: t("payroll.draft") }} data-testid="payroll-draft">
          <Money size={18} aria-hidden />
          {t("payroll.draft")}
        </Button>
        <p className="w-full text-xs text-muted">{t("payroll.draftHint")}</p>
        {problem ? (
          <p role="alert" className="w-full text-sm text-danger">
            {problem}
          </p>
        ) : null}
      </Card>
      {q.isPending ? (
        <SkeletonList rows={3} />
      ) : q.isError ? (
        <Notice tone="error">{err(q.error)}</Notice>
      ) : !q.data.items.length ? (
        <EmptyState icon={<Money size={28} aria-hidden />} title={t("payroll.none")} />
      ) : (
        <DataTable
          label={t("payroll.allMonths")}
          testId="payroll-runs"
          rows={q.data.items}
          rowId={(r) => r.id}
          onRowClick={(r) => setOpen(r.id)}
          columns={[
            { id: "month", header: t("payroll.month"), primary: true, sort: (r) => r.period, cell: (r) => <span className="font-semibold">{f.month(r.period)}</span> },
            { id: "staff", header: t("payroll.staff"), align: "end", sort: (r) => r.staffCount, cell: (r) => f.n(r.staffCount) },
            { id: "net", header: t("payroll.net"), align: "end", sort: (r) => r.totalNetPoisha, cell: (r) => <span className="font-semibold">{f.taka(r.totalNetPoisha)}</span> },
            { id: "status", header: t("payroll.statusLabel"), cell: (r) => <Badge tone={RUN_TONE[r.status]}>{t(`payroll.status.${r.status}`)}</Badge> },
          ]}
        />
      )}
    </div>
  );
}

function RunView({ ctx, runId, onBack }: { ctx: GymCtx; runId: string; onBack: () => void }) {
  const t = useTranslations("gt");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["gt-run", ctx.gymId, runId], queryFn: () => gymStaff.run(ctx.gymId, runId) });
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [editing, setEditing] = useState<PayrollLine | null>(null);
  const [paying, setPaying] = useState<PayrollLine | null>(null);
  const [slip, setSlip] = useState<string | null>(null);
  const [voiding, setVoiding] = useState(false);
  const refresh = (r: PayrollRun) => {
    qc.setQueryData(["gt-run", ctx.gymId, runId], r);
    void qc.invalidateQueries({ queryKey: ["gt-runs", ctx.gymId] });
  };
  const act = async (name: string, fn: () => Promise<PayrollRun>, done: string) => {
    setBusy(name);
    setProblem(null);
    try {
      refresh(await fn());
      toast.show(done);
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(null);
    }
  };
  const time = (m: number) => hoursText(m, (k, v) => t(`time.${k}`, v));
  if (q.isPending) return <SkeletonList rows={4} />;
  if (q.isError) return <Notice tone="error">{err(q.error)}</Notice>;
  const r = q.data;
  const sum = (by: (l: PayrollLine) => number) => (rows: PayrollLine[]) => f.taka(rows.reduce((s, l) => s + by(l), 0));
  const lineColumns: Column<PayrollLine>[] = [
    {
      id: "person",
      header: t("staff.person"),
      primary: true,
      sort: (l) => l.staff.name ?? "",
      cell: (l) => (
        <>
          <span className="font-semibold">{l.staff.name ?? "–"}</span>
          {l.note ? <span className="block text-xs text-muted">{l.note}</span> : null}
        </>
      ),
    },
    { id: "base", header: t("payroll.base"), align: "end", sort: (l) => l.basePoisha, cell: (l) => f.taka(l.basePoisha), total: sum((l) => l.basePoisha) },
    {
      id: "commission",
      header: t("payroll.commission"),
      align: "end",
      sort: (l) => l.ptCommissionPoisha + l.salesCommissionPoisha,
      total: sum((l) => l.ptCommissionPoisha + l.salesCommissionPoisha),
      cell: (l) => (
        <>
          {f.taka(l.ptCommissionPoisha + l.salesCommissionPoisha)}
          {l.ptBasePoisha || l.salesBasePoisha ? <span className="block text-xs text-muted">{t("payroll.fromFeesSales", { fees: f.taka(l.ptBasePoisha), sales: f.taka(l.salesBasePoisha) })}</span> : null}
        </>
      ),
    },
    {
      id: "adjust",
      header: t("payroll.bonusMinus"),
      align: "end",
      hideBelow: "lg",
      cell: (l) => (!l.bonusPoisha && !l.deductionPoisha ? "–" : `${l.bonusPoisha ? `+${f.taka(l.bonusPoisha)}` : ""} ${l.deductionPoisha ? `−${f.taka(l.deductionPoisha)}` : ""}`.trim()),
    },
    { id: "net", header: t("payroll.net"), align: "end", sort: (l) => l.netPoisha, cell: (l) => <span className="font-semibold">{f.taka(l.netPoisha)}</span>, total: sum((l) => l.netPoisha) },
    {
      id: "hours",
      header: t("staff.hours"),
      sort: (l) => l.workedMinutes,
      cell: (l) => (
        <span className="text-xs text-muted">
          {time(l.workedMinutes)}
          {l.lateCount || l.missedCount ? ` · ${t("payroll.lateMissed", { late: f.n(l.lateCount), missed: f.n(l.missedCount) })}` : ""}
        </span>
      ),
    },
    {
      id: "act",
      header: <span className="sr-only">{t("payroll.actions")}</span>,
      label: t("payroll.actions"),
      align: "end",
      cell: (l) => (
        <span className="flex justify-end gap-1">
          {r.status === "draft" ? (
            <IconButton label={t("payroll.editLine")} variant="ghost" onClick={() => setEditing(l)}>
              <PencilSimple size={18} aria-hidden />
            </IconButton>
          ) : null}
          {r.status === "approved" && l.status === "unpaid" && l.netPoisha > 0 ? (
            <Button size="sm" onClick={() => setPaying(l)} data-testid={`pay-${l.id}`}>
              {t("payroll.pay")}
            </Button>
          ) : l.status === "paid" ? (
            <Badge tone="brand">{t("payroll.paidOn", { date: f.short(l.paidOn) })}</Badge>
          ) : null}
          <IconButton label={t("payslip.title")} variant="ghost" onClick={() => setSlip(l.id)}>
            <Receipt size={18} aria-hidden />
          </IconButton>
        </span>
      ),
    },
  ];
  return (
    <div className="flex flex-col gap-4" data-testid="payroll-run">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-text hover:underline">
            <ArrowLeft size={16} aria-hidden />
            {t("payroll.allMonths")}
          </button>
          <h2 className="mt-1 flex items-center gap-2 font-display text-xl font-bold">
            {f.month(r.period)} <Badge tone={RUN_TONE[r.status]}>{t(`payroll.status.${r.status}`)}</Badge>
          </h2>
          <p className="text-sm text-muted">{t("payroll.totals", { total: f.taka(r.totalNetPoisha), paid: f.taka(r.paidPoisha) })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {r.status === "draft" ? (
            <>
              <Button variant="secondary" busy={busy === "recalc"} confirm={{ kind: "save", title: t("payroll.recalcAsk"), body: t("payroll.draftNotice"), confirmLabel: t("payroll.recalculate") }} onClick={() => void act("recalc", () => gymStaff.recalculate(ctx.gymId, runId), t("payroll.recalculated"))}>
                <ArrowsClockwise size={18} aria-hidden />
                {t("payroll.recalculate")}
              </Button>
              <Button busy={busy === "approve"} confirm={{ kind: "money", title: t("payroll.approveAsk", { month: f.month(r.period), total: f.taka(r.totalNetPoisha) }), body: t("payroll.approveAskBody"), confirmLabel: t("payroll.approve") }} onClick={() => void act("approve", () => gymStaff.approve(ctx.gymId, runId), t("payroll.approved"))} data-testid="payroll-approve">
                <CheckCircle size={18} aria-hidden />
                {t("payroll.approve")}
              </Button>
            </>
          ) : null}
          {(r.status === "draft" || (r.status === "approved" && !r.paidPoisha)) ? (
            <Button variant="ghost" onClick={() => setVoiding(true)}>
              {t("payroll.void")}
            </Button>
          ) : null}
        </div>
      </div>
      {r.status === "draft" ? <Notice tone="info">{t("payroll.draftNotice")}</Notice> : null}
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <DataTable
        label={t("payroll.linesLabel", { month: f.month(r.period) })}
        testId="payroll-lines"
        rows={r.lines}
        rowId={(l) => l.id}
        maxHeight="70vh"
        rowProps={(l) => ({ data: { status: l.status } })}
        columns={lineColumns}
      />
      {editing ? <LineDialog ctx={ctx} runId={runId} line={editing} onDone={refresh} onClose={() => setEditing(null)} /> : null}
      {paying ? <PayDialog ctx={ctx} runId={runId} line={paying} onDone={refresh} onClose={() => setPaying(null)} /> : null}
      {slip ? <PayslipDialog gymId={ctx.gymId} runId={runId} lineId={slip} onClose={() => setSlip(null)} /> : null}
      <ReasonDialog
        open={voiding}
        onOpenChange={(o) => !o && setVoiding(false)}
        title={t("payroll.voidTitle")}
        description={t("payroll.voidBody")}
        confirmLabel={t("payroll.void")}
        danger
        busy={busy === "void"}
        error={problem}
        onConfirm={(reason) => void act("void", () => gymStaff.voidRun(ctx.gymId, runId, reason), t("payroll.voided")).then(() => setVoiding(false))}
        testId="payroll-void"
      />
    </div>
  );
}

function LineDialog({ ctx, runId, line, onDone, onClose }: { ctx: GymCtx; runId: string; line: PayrollLine; onDone: (r: PayrollRun) => void; onClose: () => void }) {
  const t = useTranslations("gt");
  const f = useFmt();
  const err = useGymError();
  const [bonus, setBonus] = useState(line.bonusPoisha ? takaText(line.bonusPoisha) : "");
  const [deduction, setDeduction] = useState(line.deductionPoisha ? takaText(line.deductionPoisha) : "");
  const [note, setNote] = useState(line.note ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const save = async () => {
    const b = bonus.trim() ? toPoisha(bonus) : 0;
    const d = deduction.trim() ? toPoisha(deduction) : 0;
    if (b === null || d === null) return setProblem(t("payroll.amountBad"));
    setBusy(true);
    setProblem(null);
    try {
      onDone(await gymStaff.updateLine(ctx.gymId, runId, line.id, { bonusPoisha: b, deductionPoisha: d, note: note.trim() || null }));
      onClose();
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  const gross = line.basePoisha + line.ptCommissionPoisha + line.salesCommissionPoisha;
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()} title={line.staff.name ?? "–"} description={t("payroll.grossIs", { gross: f.taka(gross) })}>
      <div className="flex flex-col gap-3 px-6 pb-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="ln-bonus" label={t("payroll.bonus")} inputMode="decimal" leading="৳" value={bonus} onChange={(e) => setBonus(e.target.value)} />
          <Field id="ln-deduction" label={t("payroll.deduction")} inputMode="decimal" leading="৳" value={deduction} onChange={(e) => setDeduction(e.target.value)} />
        </div>
        <Field id="ln-note" label={t("payroll.lineNote")} optional={t("optional")} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={t("payroll.lineNotePh")} />
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void save()} busy={busy} confirm="save" data-testid="line-save">
            {t("save")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function PayDialog({ ctx, runId, line, onDone, onClose }: { ctx: GymCtx; runId: string; line: PayrollLine; onDone: (r: PayrollRun) => void; onClose: () => void }) {
  const t = useTranslations("gt");
  const f = useFmt();
  const err = useGymError();
  const toast = useToast();
  const ask = useConfirm();
  const [method, setMethod] = useState<PayMethod>("cash");
  const [fromDrawer, setFromDrawer] = useState(false);
  const [key] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const pay = async () => {
    const drawer = method === "cash" && fromDrawer;
    if (!(await ask({ kind: "money", title: t("payroll.payAsk", { name: line.staff.name ?? "–", amount: f.taka(line.netPoisha), method: t(`method.${method}`) }), body: drawer ? t("payroll.fromDrawer") : t("payroll.payHint"), confirmLabel: t("payroll.markPaid") }))) return;
    setBusy(true);
    setProblem(null);
    try {
      onDone(await gymStaff.payLine(ctx.gymId, runId, line.id, { method, fromDrawer: method === "cash" && fromDrawer }, key));
      toast.show(t("payroll.paidToast", { name: line.staff.name ?? "" }));
      onClose();
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()} title={t("payroll.payTitle", { name: line.staff.name ?? "–", amount: f.taka(line.netPoisha) })} description={t("payroll.payHint")}>
      <div className="flex flex-col gap-3 px-6 pb-5">
        <Select id="pay-method" label={t("payroll.method")} value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
          {PAY_METHODS.map((m) => (
            <option key={m} value={m}>
              {t(`method.${m}`)}
            </option>
          ))}
        </Select>
        {method === "cash" ? <Checkbox id="pay-drawer" label={t("payroll.fromDrawer")} checked={fromDrawer} onChange={(e) => setFromDrawer(e.target.checked)} /> : null}
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void pay()} busy={busy} data-testid="pay-confirm">
            {t("payroll.markPaid")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

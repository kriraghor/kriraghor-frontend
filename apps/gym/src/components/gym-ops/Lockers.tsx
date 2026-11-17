"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Lockers as LockersIcon, Plus } from "@phosphor-icons/react";
import { Badge, Button, Card, Checkbox, Dialog, EmptyState, Field, Notice, ReasonDialog, Select, Skeleton, useToast } from "@kriraghor/ui/kit";
import { DatePicker } from "@kriraghor/ui/date";
import { newKey } from "@kriraghor/ui/format";
import { cn } from "@kriraghor/ui/cn";
import { dhakaToday, poishaToTakaText, takaToPoisha } from "@/lib/gym-manage";
import { daysLeft, gymOps, LOCKER_SIZES, lockerNumbers, plusDays, SALE_METHODS, type Locker, type LockerSize, type LockerState, type SaleMethod } from "@/lib/gym-ops";
import { GymPage, Row, useFmt, useGymError, type GymCtx } from "../gym-manage/common";
import { MemberPick, type PickedMember } from "./parts";

/**
 * /manage/[gymId]/lockers (M27-FR-22 to FR-26; lockers.manage, Basic plan): the locker room as a grid,
 * green free, red taken, amber unpaid or past its end, grey out of service. Tap a free locker to rent it
 * to a member (the fee is the monthly fee for each started 30 days, taken now or later); tap a taken one
 * to take the fee, end the rental or see who has it. Add lockers in bulk ("1-40, A1-A10").
 */
export function Lockers({ gymId }: { gymId: string }) {
  const t = useTranslations("go");
  return (
    <GymPage gymId={gymId} page="lockers" feature="lockers" wide title={t("lockers.title")} description={t("lockers.lead")} testId="go-lockers">
      {(ctx) => <Body ctx={ctx} />}
    </GymPage>
  );
}

const STATE_CLASS: Record<LockerState, string> = {
  free: "border-brand/50 bg-brand-soft text-brand-text",
  taken: "border-danger/40 bg-danger-soft text-danger",
  unpaid: "border-warning/50 bg-warning-soft text-warning",
  overdue: "border-warning bg-warning-soft text-warning",
  out_of_service: "border-line bg-surface-2 text-muted",
};

function Body({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("go");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<Locker | null>(null);
  const q = useQuery({ queryKey: ["go-lockers", ctx.gymId], queryFn: () => gymOps.lockers(ctx.gymId) });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["go-lockers", ctx.gymId] });
    void qc.invalidateQueries({ queryKey: ["go-sales", ctx.gymId] });
    void qc.invalidateQueries({ queryKey: ["go-drawer", ctx.gymId] });
  };
  if (q.isPending) return <Skeleton className="h-80 rounded-card" />;
  if (q.isError) return <Notice tone="error">{err(q.error)}</Notice>;
  const { items, counts } = q.data;
  const zones = [...new Set(items.map((l) => l.zone ?? ""))];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-2 text-sm" aria-label={t("lockers.legend")}>
          {(["free", "taken", "unpaid", "overdue", "out_of_service"] as LockerState[]).map((s) => (
            <li key={s} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-semibold", STATE_CLASS[s])} data-testid={`lockers-count-${s}`}>
              {t(`lockers.state.${s}`)} <span className="tabular-nums">{f.n(s === "out_of_service" ? counts.outOfService : counts[s])}</span>
            </li>
          ))}
        </ul>
        <Button onClick={() => setAdding(true)} data-testid="lockers-add">
          <Plus size={18} weight="bold" aria-hidden />
          {t("lockers.add")}
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<LockersIcon size={28} aria-hidden />} title={t("lockers.empty")} body={t("lockers.emptyHint")} action={<Button onClick={() => setAdding(true)}>{t("lockers.add")}</Button>} />
      ) : (
        zones.map((z) => (
          <section key={z || "none"} className="flex flex-col gap-2">
            {zones.length > 1 ? <h2 className="font-display text-base font-bold">{z || t("lockers.noZone")}</h2> : null}
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2" data-testid="lockers-grid">
              {items
                .filter((l) => (l.zone ?? "") === z)
                .map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => setOpen(l)}
                      className={cn("flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-control border p-1 transition-transform active:scale-[0.97]", STATE_CLASS[l.state])}
                      aria-label={t("lockers.cellLabel", { number: l.number, state: t(`lockers.state.${l.state}`) })}
                      data-testid={`locker-${l.number}`}
                    >
                      <span className="font-display text-xl font-extrabold">{l.number}</span>
                      <span className="max-w-full truncate text-xs font-semibold">{l.rental ? l.rental.member.memberCode : t(`lockers.state.${l.state}`)}</span>
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
      {adding ? <AddLockers ctx={ctx} onClose={() => setAdding(false)} onDone={refresh} /> : null}
      {open ? <LockerDialog ctx={ctx} locker={open} onClose={() => setOpen(null)} onDone={refresh} /> : null}
    </div>
  );
}

function AddLockers({ ctx, onClose, onDone }: { ctx: GymCtx; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("go");
  const err = useGymError();
  const toast = useToast();
  const [numbers, setNumbers] = useState("");
  const [zone, setZone] = useState("");
  const [size, setSize] = useState<LockerSize>("medium");
  const [fee, setFee] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const list = lockerNumbers(numbers);
  const save = async () => {
    const monthly = takaToPoisha(fee || "0", { allowZero: true });
    if (!list) return setProblem(t("lockers.numbersBad"));
    if (monthly == null) return setProblem(t("amountBad"));
    setBusy(true);
    setProblem(null);
    try {
      await gymOps.addLockers(ctx.gymId, { numbers: list, zone: zone.trim() || null, size, monthlyFeePoisha: monthly });
      toast.show(t("lockers.added", { n: list.length }));
      onDone();
      onClose();
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={t("lockers.add")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void save()} busy={busy} data-testid="lockers-save">
            {list ? t("lockers.addN", { n: list.length }) : t("lockers.add")}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 px-6 pb-2 sm:grid-cols-2">
        <Field id="l-numbers" label={t("lockers.numbers")} value={numbers} onChange={(e) => setNumbers(e.target.value)} hint={t("lockers.numbersHint")} className="sm:col-span-2" autoFocus data-testid="lockers-numbers" />
        <Field id="l-zone" label={t("lockers.zone")} optional={t("optional")} value={zone} maxLength={30} onChange={(e) => setZone(e.target.value)} hint={t("lockers.zoneHint")} />
        <Select id="l-size" label={t("lockers.size")} value={size} onChange={(e) => setSize(e.target.value as LockerSize)}>
          {LOCKER_SIZES.map((s) => (
            <option key={s} value={s}>
              {t(`lockers.sizes.${s}`)}
            </option>
          ))}
        </Select>
        <Field id="l-fee" label={t("lockers.monthlyFee")} inputMode="decimal" leading="৳" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" data-testid="lockers-fee" />
        {problem ? (
          <p role="alert" className="text-sm text-danger sm:col-span-2">
            {problem}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

function LockerDialog({ ctx, locker, onClose, onDone }: { ctx: GymCtx; locker: Locker; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("go");
  const f = useFmt();
  const err = useGymError();
  const toast = useToast();
  const today = dhakaToday();
  const r = locker.rental;
  const [ending, setEnding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [method, setMethod] = useState<SaleMethod>("cash");
  const [collectKey] = useState(newKey);
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setProblem(null);
    try {
      await fn();
      toast.show(done);
      onDone();
      onClose();
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  const toggleService = () =>
    run(() => gymOps.editLocker(ctx.gymId, locker.id, { status: locker.status === "out_of_service" ? "available" : "out_of_service" }), locker.status === "out_of_service" ? t("lockers.backInService") : t("lockers.outOfServiceDone"));

  return (
    <>
      <Dialog open={!ending} onOpenChange={(o) => !o && !busy && onClose()} title={t("lockers.lockerN", { number: locker.number })} description={t(`lockers.state.${locker.state}`)}>
        <div className="flex flex-col gap-3 px-6 pb-5">
          {r ? (
            <>
              <Card className="flex flex-col">
                <Row label={t("lockers.member")}>
                  {r.member.displayName} ({r.member.memberCode})
                </Row>
                <Row label={t("lockers.from")}>{f.date(r.startsOn)}</Row>
                <Row label={t("lockers.until")}>
                  {f.date(r.endsOn)}{" "}
                  <Badge tone={daysLeft(r.endsOn, today) < 0 ? "danger" : daysLeft(r.endsOn, today) <= 3 ? "warning" : "neutral"}>
                    {daysLeft(r.endsOn, today) < 0 ? t("lockers.overdueBy", { n: f.n(-daysLeft(r.endsOn, today)) }) : t("lockers.daysLeft", { n: f.n(daysLeft(r.endsOn, today)) })}
                  </Badge>
                </Row>
                <Row label={t("lockers.fee")}>
                  {f.taka(r.feePoisha)} {r.paid ? <Badge tone="brand">{t("lockers.paid")}</Badge> : <Badge tone="warning">{t("lockers.unpaid")}</Badge>}
                </Row>
              </Card>
              {!r.paid && r.feePoisha > 0 ? (
                <div className="flex items-end gap-2">
                  <Select id="l-collect-method" label={t("lockers.takeFeeBy")} value={method} onChange={(e) => setMethod(e.target.value as SaleMethod)} className="flex-1">
                    {SALE_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {t(`method.${m}`)}
                      </option>
                    ))}
                  </Select>
                  <Button onClick={() => void run(() => gymOps.collect(ctx.gymId, r.id, method, collectKey), t("lockers.feeTaken"))} busy={busy} data-testid="locker-collect">
                    {t("lockers.takeFee", { amount: f.taka(r.feePoisha) })}
                  </Button>
                </div>
              ) : null}
              <Button variant="secondary" onClick={() => setEnding(true)} data-testid="locker-end">
                {t("lockers.end")}
              </Button>
            </>
          ) : locker.status === "out_of_service" ? (
            <Button onClick={() => void toggleService()} busy={busy}>
              {t("lockers.backToService")}
            </Button>
          ) : (
            <>
              <RentForm ctx={ctx} locker={locker} onDone={onDone} onClose={onClose} />
              <Button variant="ghost" onClick={() => void toggleService()} disabled={busy} className="self-start">
                {t("lockers.outOfService")}
              </Button>
            </>
          )}
          {problem ? (
            <p role="alert" className="text-sm text-danger">
              {problem}
            </p>
          ) : null}
        </div>
      </Dialog>
      <ReasonDialog
        open={ending}
        onOpenChange={(o) => !o && setEnding(false)}
        title={t("lockers.endTitle", { number: locker.number })}
        description={t("lockers.endBody")}
        confirmLabel={t("lockers.end")}
        busy={busy}
        error={problem}
        onConfirm={(reason) => r && void run(() => gymOps.endRental(ctx.gymId, r.id, reason), t("lockers.ended"))}
        testId="locker-end-dialog"
      />
    </>
  );
}

function RentForm({ ctx, locker, onDone, onClose }: { ctx: GymCtx; locker: Locker; onDone: () => void; onClose: () => void }) {
  const t = useTranslations("go");
  const f = useFmt();
  const err = useGymError();
  const toast = useToast();
  const today = dhakaToday();
  const [key] = useState(newKey);
  const [member, setMember] = useState<PickedMember | null>(null);
  const [endsOn, setEndsOn] = useState(plusDays(today, 29));
  const months = Math.max(1, Math.ceil((daysLeft(endsOn, today) + 1) / 30));
  const [fee, setFee] = useState<string | null>(null);
  const shownFee = fee ?? poishaToTakaText(locker.monthlyFeePoisha * months);
  const [collectNow, setCollectNow] = useState(true);
  const [method, setMethod] = useState<SaleMethod>("cash");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const rent = async () => {
    if (!member) return setProblem(t("lockers.pickMember"));
    const feePoisha = takaToPoisha(shownFee || "0", { allowZero: true });
    if (feePoisha == null) return setProblem(t("amountBad"));
    setBusy(true);
    setProblem(null);
    try {
      await gymOps.rent(ctx.gymId, locker.id, { memberId: member.id, startsOn: today, endsOn, feePoisha, ...(collectNow && feePoisha > 0 ? { collect: { method } } : {}) }, key);
      toast.show(t("lockers.rented", { number: locker.number, name: member.displayName }));
      onDone();
      onClose();
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3" data-testid="locker-rent-form">
      <MemberPick gymId={ctx.gymId} id="l-member" label={t("lockers.member")} value={member} onChange={setMember} />
      <div className="grid gap-3 sm:grid-cols-2">
        <DatePicker id="l-ends" label={t("lockers.until")} value={endsOn} min={today} clearable={false} onChange={(v) => v && setEndsOn(v)} />
        <Field id="l-rent-fee" label={t("lockers.fee")} inputMode="decimal" leading="৳" value={shownFee} onChange={(e) => setFee(e.target.value)} hint={t("lockers.feeHint", { monthly: f.taka(locker.monthlyFeePoisha), n: f.n(months) })} />
      </div>
      <Checkbox id="l-collect" label={t("lockers.collectNow")} checked={collectNow} onChange={(e) => setCollectNow(e.target.checked)} />
      {collectNow ? (
        <Select id="l-method" label={t("lockers.takeFeeBy")} value={method} onChange={(e) => setMethod(e.target.value as SaleMethod)}>
          {SALE_METHODS.map((m) => (
            <option key={m} value={m}>
              {t(`method.${m}`)}
            </option>
          ))}
        </Select>
      ) : null}
      {problem ? (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      ) : null}
      <Button onClick={() => void rent()} busy={busy} data-testid="locker-rent">
        {t("lockers.rent")}
      </Button>
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowsClockwise, Storefront } from "@phosphor-icons/react";
import { useRouter } from "@kriraghor/ui/i18n/navigation";
import { Button, Card, Dialog, Notice, SegmentedControl, Skeleton, useToast } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { newKey } from "@kriraghor/ui/format";
import { payPath, type MyDue } from "@/lib/gym-money";
import { firstChoice, firstPay, gymRenewal, renewState, type MyRenewal, type RenewPay } from "@/lib/gym-progress";
import { useFmt, useGymError } from "@/components/gym-manage/common";
import { PayDueButton } from "./MyDues";

/**
 * "Renew" on My membership (M24 §19, FR-121 to FR-127). From the days before the end the member picks a
 * package, sees its dates and price, and pays online or at the counter. A renewal that waits to start shows
 * what is still to pay and, while unpaid, **Cancel renewal**. Too early: the first day it opens. A gym that
 * switched it off: a line that renewals are taken at the front desk. A reminder link (?renew=1) opens the
 * form at once.
 */
export function RenewCard({ memberId, payable }: { memberId: string; payable: Map<string, MyDue> }) {
  const t = useTranslations("gm.renew");
  const f = useFmt();
  const search = useSearchParams();
  const q = useQuery({ queryKey: ["my-gym-renewal", memberId], queryFn: () => gymRenewal.options(memberId) });
  // null: not touched yet, so a reminder link (?renew=1) decides; after that the member's own choice.
  const [chosen, setOpen] = useState<boolean | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const state = q.data ? renewState(q.data) : null;
  const open = chosen ?? (search.get("renew") === "1" && state?.kind === "renew");

  if (q.isPending) return <Skeleton className="h-20 rounded-card" />;
  if (q.isError || !q.data || !state || state.kind === "none") return null;
  const r = q.data;

  if (state.kind === "later")
    return (
      <p className="text-sm text-muted" data-testid="renew-later">
        {state.on ? t("later", { date: f.date(state.on) }) : null}
      </p>
    );
  if (state.kind === "desk")
    return (
      <p className="flex items-start gap-1.5 text-sm text-muted" data-testid="renew-desk">
        <Storefront size={18} className="shrink-0" aria-hidden /> {t("desk")}
      </p>
    );

  if (state.kind === "waiting" && r.renewal) {
    const w = r.renewal;
    const due = w.dueId ? payable.get(w.dueId) : undefined;
    return (
      <Card className="flex flex-col gap-2" data-testid="renew-waiting">
        <p className="text-sm text-muted">{t("waitingTitle")}</p>
        <p className="font-display text-xl font-extrabold">{w.title}</p>
        <p className="text-sm tabular-nums">
          {f.date(w.startsOn)} – {f.date(w.endsOn)}
        </p>
        {w.outstandingPoisha > 0 ? (
          <>
            <p className="text-sm">{t("toPay", { amount: f.taka(w.outstandingPoisha) })}</p>
            <div className="flex flex-wrap items-center gap-2">
              {due ? <PayDueButton due={due} size="sm" /> : <p className="text-sm text-muted">{t("payAtDesk")}</p>}
              {w.cancellable ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => setCancelling(true)} data-testid="renew-cancel">
                  {t("cancel")}
                </Button>
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">{t("paid")}</p>
        )}
        <CancelDialog memberId={memberId} open={cancelling} onClose={() => setCancelling(false)} />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-2" data-testid="renew-card">
      <p className="font-display text-lg font-bold">{r.current?.status === "expired" ? t("expiredTitle") : t("title", { date: f.date(r.current?.endsOn) })}</p>
      <p className="text-sm text-muted">{t("lead")}</p>
      <div>
        <Button type="button" icon={<ArrowsClockwise size={18} aria-hidden />} onClick={() => setOpen(true)} data-testid="renew-open">
          {t("open")}
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen} title={t("formTitle")} description={r.gym.name}>
        {open ? <RenewForm memberId={memberId} r={r} onDone={() => setOpen(false)} /> : null}
      </Dialog>
    </Card>
  );
}

function RenewForm({ memberId, r, onDone }: { memberId: string; r: MyRenewal; onDone: () => void }) {
  const t = useTranslations("gm.renew");
  const f = useFmt();
  const err = useGymError();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const [packageId, setPackageId] = useState(firstChoice(r.packages)?.packageId ?? "");
  const [pay, setPay] = useState<RenewPay>(firstPay(r));
  const [key] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const chosen = r.packages.find((p) => p.packageId === packageId);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!chosen) return;
    setBusy(true);
    setProblem(null);
    try {
      const made = await gymRenewal.renew(memberId, { packageId: chosen.packageId, pay }, key);
      await Promise.all([["my-gym-renewal", memberId], ["my-gym-membership", memberId], ["my-gym-dues"], ["my-gym-memberships"]].map((k) => qc.invalidateQueries({ queryKey: k })));
      if (made.payment) {
        const to = payPath(made.payment.payUrl);
        if (to.startsWith("/")) router.push(to);
        else window.location.assign(to);
        return;
      }
      toast.show(t("savedCounter", { amount: f.taka(made.due.amountPoisha) }));
      onDone();
    } catch (e2) {
      setProblem(err(e2));
      setBusy(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={send} data-testid="renew-form">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">{t("package")}</legend>
        {r.packages.map((p) => (
          <label
            key={p.packageId}
            className={cn("flex min-h-11 cursor-pointer items-start gap-3 rounded-control border p-3", p.packageId === packageId ? "border-brand bg-brand-soft" : "border-line")}
            data-testid={`renew-package-${p.kind}`}
          >
            <input type="radio" name="renew-package" className="mt-1 size-5 shrink-0 accent-[var(--kg-brand)]" checked={p.packageId === packageId} onChange={() => setPackageId(p.packageId)} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">
                  {p.title}
                  {p.current ? <span className="ml-2 text-xs font-normal text-muted">{t("currentPackage")}</span> : null}
                </span>
                <span className="font-bold tabular-nums">{f.taka(p.pricePoisha)}</span>
              </span>
              <span className="block text-sm text-muted tabular-nums">
                {f.date(p.startsOn)} – {f.date(p.endsOn)} · {t("days", { n: p.days })}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      {r.onlineFees ? (
        <>
          <SegmentedControl
            label={t("how")}
            value={pay}
            onChange={setPay}
            options={[
              { value: "online", label: t("online"), testId: "renew-online" },
              { value: "counter", label: t("counter"), testId: "renew-counter" },
            ]}
          />
          <p className="text-sm text-muted">{pay === "online" ? t("onlineHint") : t("counterHint")}</p>
        </>
      ) : (
        <Notice tone="info">{t("noOnline")}</Notice>
      )}
      {problem ? (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      ) : null}
      <Button
        type="submit"
        busy={busy}
        disabled={!chosen}
        confirm={
          chosen
            ? pay === "online"
              ? { kind: "money", title: t("askOnline", { title: chosen.title, amount: f.taka(chosen.pricePoisha) }), body: t("askOnlineBody"), confirmLabel: t("sendOnline", { amount: f.taka(chosen.pricePoisha) }) }
              : { kind: "add", title: t("askCounter", { title: chosen.title }), body: t("askCounterBody", { amount: f.taka(chosen.pricePoisha) }), confirmLabel: t("sendCounter") }
            : undefined
        }
        data-testid="renew-send"
      >
        {chosen ? (pay === "online" ? t("sendOnline", { amount: f.taka(chosen.pricePoisha) }) : t("sendCounter")) : t("open")}
      </Button>
    </form>
  );
}

function CancelDialog({ memberId, open, onClose }: { memberId: string; open: boolean; onClose: () => void }) {
  const t = useTranslations("gm.renew");
  const err = useGymError();
  const toast = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const cancel = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const fresh = await gymRenewal.cancel(memberId);
      qc.setQueryData(["my-gym-renewal", memberId], fresh);
      await Promise.all([["my-gym-membership", memberId], ["my-gym-dues"], ["my-gym-memberships"]].map((k) => qc.invalidateQueries({ queryKey: k })));
      toast.show(t("cancelled"));
      onClose();
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t("cancelTitle")}
      description={t("cancelBody")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("keep")}
          </Button>
          <Button variant="danger" busy={busy} onClick={() => void cancel()} data-testid="renew-cancel-yes">
            {t("cancel")}
          </Button>
        </>
      }
    >
      {problem ? (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      ) : null}
    </Dialog>
  );
}

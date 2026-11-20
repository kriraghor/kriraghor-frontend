"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Tray } from "@phosphor-icons/react";
import { newKey } from "@kriraghor/ui/format";
import { DatePicker } from "@kriraghor/ui/date";
import { Link, useRouter } from "@kriraghor/ui/i18n/navigation";
import { Avatar, Badge, Button, Checkbox, Dialog, EmptyState, FilterBar, Notice, Select, SkeletonList, Textarea, useToast } from "@kriraghor/ui/kit";
import { useUrlFilters } from "@kriraghor/ui/url-filters";
import { addDays, dhakaToday, gymManage, type JoinAccept, type LinkRequest } from "@/lib/gym-manage";
import { GymPage, useDeskPackages, useFmt, useGymError, type GymCtx } from "./common";
import { emptyPayment, paymentBody, PaymentFields } from "./money";

const STATUSES = ["pending", "accepted", "declined", "expired", "cancelled"] as const;
const SPEC = { status: { default: "pending", allowed: STATUSES } };

/**
 * /manage/[gymId]/requests (M24-FR-14 to FR-17): the gym's invites to link a member's Kriraghor
 * account, and join requests from the public gym page (prompt 3), by state. A pending invite can be
 * cancelled (members.edit). A join request shows the person (name, photo, the last digits of the
 * phone: they agreed the gym sees their name and phone), the package and note they sent; **Accept**
 * (members.edit) adds them as a member, or links the unlinked member with the same phone, optionally
 * with a package and a first counter payment (fees.collect); **Decline** keeps the reason with the gym.
 */
export function Requests({ gymId }: { gymId: string }) {
  const t = useTranslations("gm");
  return (
    <GymPage gymId={gymId} page="requests" title={t("requests.title")} description={t("requests.lead")} testId="gm-requests">
      {(ctx) => <List ctx={ctx} />}
    </GymPage>
  );
}

function List({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gm");
  const tj = useTranslations("gp.requests");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const { values, set } = useUrlFilters(SPEC);
  const status = values.status as LinkRequest["status"];
  const q = useQuery({ queryKey: ["gm-requests", ctx.gymId, status], queryFn: () => gymManage.requests(ctx.gymId, { status }) });
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<LinkRequest | null>(null);
  const [declining, setDeclining] = useState<LinkRequest | null>(null);
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["gm-requests", ctx.gymId] });
    await qc.invalidateQueries({ queryKey: ["gm-overview", ctx.gymId] });
    await qc.invalidateQueries({ queryKey: ["gm-members", ctx.gymId] });
  };
  const cancel = async (r: LinkRequest) => {
    setBusy(r.id);
    setProblem(null);
    try {
      await gymManage.cancelRequest(ctx.gymId, r.id);
      toast.show(t("requests.cancelled"));
      await refresh();
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(null);
    }
  };
  const items = q.data?.items ?? [];
  const canEdit = ctx.can("members.edit");
  return (
    <div className="flex flex-col gap-3">
      <FilterBar chips={{ value: status, onChange: (v) => set({ status: v }), label: t("requests.status"), options: STATUSES.map((s) => ({ value: s, label: t(`requestStatus.${s}`) })), testId: "requests-status" }} />
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      {q.isPending ? (
        <SkeletonList rows={4} />
      ) : q.isError ? (
        <Notice tone="error">{err(q.error)}</Notice>
      ) : !items.length ? (
        <EmptyState icon={<Tray size={32} aria-hidden />} title={t("requests.empty")} body={t("requests.emptyBody")} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface" data-testid="requests-list">
          {items.map((r) => {
            const join = r.direction === "join_request";
            return (
              <li key={r.id} className="flex flex-wrap items-start gap-3 px-3 py-2.5" data-testid={join ? "join-row" : "request-row"}>
                {join && r.requester ? <Avatar src={r.requester.avatarUrl} name={r.requester.displayName ?? "?"} size={36} /> : null}
                <div className="min-w-0 flex-1">
                  {r.member ? (
                    <Link href={`/manage/${ctx.gymId}/members/${r.member.id}`} className="font-semibold hover:underline">
                      {r.member.displayName}
                    </Link>
                  ) : join && r.requester ? (
                    <span className="font-semibold">{r.requester.displayName ?? t("requests.someone")}</span>
                  ) : (
                    <span className="font-semibold">{t("requests.someone")}</span>
                  )}
                  <p className="text-xs text-muted tabular-nums">
                    {r.member ? `${r.member.memberCode} · ••${r.member.phoneLast4} · ` : join && r.requester?.phoneLast4 ? `••${r.requester.phoneLast4} · ` : ""}
                    {t("requests.sent", { date: f.short(r.createdAt) })}
                    {r.status === "pending" ? ` · ${t("requests.expires", { date: f.short(r.expiresAt) })}` : r.decidedAt ? ` · ${f.short(r.decidedAt)}` : ""}
                  </p>
                  {join && r.package ? <p className="mt-1 text-sm">{tj("asked", { title: r.package.title, price: f.taka(r.package.pricePoisha) })}</p> : null}
                  {join && r.note ? <p className="mt-1 whitespace-pre-line rounded-control bg-surface-2 px-2 py-1 text-sm">{r.note}</p> : null}
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge tone={join ? "info" : "neutral"}>{t(`direction.${r.direction}`)}</Badge>
                    <Badge tone={r.status === "accepted" ? "brand" : r.status === "pending" ? "warning" : "neutral"}>{t(`requestStatus.${r.status}`)}</Badge>
                    {r.status === "pending" && !join && !r.accountKnown ? <Badge tone="info">{t("requests.noAccountYet")}</Badge> : null}
                  </div>
                </div>
                {r.status === "pending" && canEdit ? (
                  join ? (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={() => setAccepting(r)} data-testid="join-accept">
                        {tj("accept")}
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => setDeclining(r)} data-testid="join-decline">
                        {tj("decline")}
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" size="sm" variant="secondary" busy={busy === r.id} onClick={() => void cancel(r)} confirm={{ kind: "remove", title: t("requests.cancelAsk") }} data-testid="request-cancel">
                      {t("requests.cancel")}
                    </Button>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {accepting ? <AcceptDialog ctx={ctx} r={accepting} onClose={() => setAccepting(null)} onDone={refresh} /> : null}
      {declining ? <DeclineDialog ctx={ctx} r={declining} onClose={() => setDeclining(null)} onDone={refresh} /> : null}
    </div>
  );
}

/**
 * Accept a join request (M24-FR-17): optionally a package (the one asked for is chosen first), its
 * start date, the admission fee, and a first counter payment (fees.collect). One Idempotency-Key per
 * dialog, so a retry after a timeout never makes two members or two payments.
 */
function AcceptDialog({ ctx, r, onClose, onDone }: { ctx: GymCtx; r: LinkRequest; onClose: () => void; onDone: () => Promise<void> }) {
  const t = useTranslations("gm");
  const tj = useTranslations("gp.requests");
  const f = useFmt();
  const err = useGymError();
  const toast = useToast();
  const router = useRouter();
  const packages = useDeskPackages(ctx.gymId, true);
  const canCollect = ctx.can("fees.collect");
  const canAdjust = ctx.can("fees.adjust");
  const asked = r.package?.id ?? "";
  const [packageId, setPackageId] = useState(asked);
  const [startsOn, setStartsOn] = useState(dhakaToday());
  const [admission, setAdmission] = useState(true);
  const [withPay, setWithPay] = useState(false);
  const [pay, setPay] = useState(emptyPayment());
  const [key] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // The package asked for may be sold online only; the accept takes any active package of the gym.
  const options = [...packages.all];
  if (r.package && !options.some((p) => p.id === r.package!.id)) options.unshift({ id: r.package.id, kind: r.package.kind, title: r.package.title, price: r.package.pricePoisha, admissionFee: 0, days: 0, channel: "online" });
  const pkg = options.find((p) => p.id === packageId);
  const submit = async () => {
    setProblem(null);
    const body: JoinAccept = {};
    if (packageId) {
      body.packageId = packageId;
      body.startsOn = startsOn;
      if (pkg?.admissionFee) body.admissionFee = admission;
      if (canCollect && withPay) {
        const b = paymentBody(pay, canAdjust);
        if (!b.ok) return setProblem(t("money.badAmount"));
        body.payment = b.payment;
      }
    }
    setBusy(true);
    try {
      const res = await gymManage.acceptJoin(ctx.gymId, r.id, body, key);
      await onDone();
      toast.show(res.linkedExisting ? tj("linkedExisting", { name: res.member.displayName }) : tj("accepted", { name: res.member.displayName }));
      onClose();
      router.push(`/manage/${ctx.gymId}/members/${res.member.id}`);
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={tj("acceptTitle", { name: r.requester?.displayName ?? t("requests.someone") })}
      description={tj("acceptLead")}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={submit} busy={busy} confirm={packageId && canCollect && withPay ? { kind: "money", body: t("ms.withPayBody") } : undefined} data-testid="join-accept-submit">
            {tj("accept")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-testid="join-accept-dialog">
        <Select id="join-package" label={t("member.package")} optional={t("optional")} value={packageId} onChange={(e) => setPackageId(e.target.value)} data-testid="join-accept-package">
          <option value="">{tj("noPackage")}</option>
          {options.map((x) => (
            <option key={x.id} value={x.id}>
              {x.title} · {f.taka(x.price)}
              {x.id === asked ? ` · ${tj("theirChoice")}` : ""}
            </option>
          ))}
        </Select>
        {packageId ? (
          <>
            <DatePicker id="join-start" label={t("member.startsOn")} value={startsOn} min={addDays(dhakaToday(), -60)} onChange={setStartsOn} />
            {pkg?.admissionFee ? <Checkbox id="join-admission" label={tj("admission", { amount: f.taka(pkg.admissionFee) })} checked={admission} onChange={(e) => setAdmission(e.target.checked)} /> : null}
            {canCollect ? (
              <>
                <Checkbox
                  id="join-with-pay"
                  label={t("new.withPayment")}
                  checked={withPay}
                  onChange={(e) => {
                    setWithPay(e.target.checked);
                    if (e.target.checked && !pay.taka) setPay(emptyPayment((pkg?.price ?? 0) + (admission ? (pkg?.admissionFee ?? 0) : 0)));
                  }}
                />
                {withPay ? <PaymentFields id="join-pay" value={pay} onChange={setPay} backdate={canAdjust} /> : null}
              </>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted">{tj("noPackageHint")}</p>
        )}
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

/** Decline a join request; the optional reason stays with the gym (the person is only told the gym could not accept). */
function DeclineDialog({ ctx, r, onClose, onDone }: { ctx: GymCtx; r: LinkRequest; onClose: () => void; onDone: () => Promise<void> }) {
  const t = useTranslations("gm");
  const tj = useTranslations("gp.requests");
  const err = useGymError();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await gymManage.declineJoin(ctx.gymId, r.id, reason.trim().length >= 2 ? reason.trim() : undefined);
      await onDone();
      toast.show(tj("declined"));
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
      onOpenChange={(o) => !o && onClose()}
      title={tj("declineTitle", { name: r.requester?.displayName ?? t("requests.someone") })}
      description={tj("declineLead")}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="button" variant="danger" onClick={submit} busy={busy} data-testid="join-decline-submit">
            {tj("decline")}
          </Button>
        </>
      }
    >
      <Textarea id="join-decline-reason" label={tj("reason")} optional={t("optional")} value={reason} maxLength={300} rows={3} onChange={(e) => setReason(e.target.value)} />
      {problem ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {problem}
        </p>
      ) : null}
    </Dialog>
  );
}

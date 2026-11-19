"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ClipboardText, Plus } from "@phosphor-icons/react";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Badge, Button, Card, Dialog, Field, Notice, Select, Skeleton, useToast } from "@kriraghor/ui/kit";
import { dhakaToday, featureLocked, gymManage, type PlanKind, type Profile } from "@/lib/gym-manage";
import { groupsOn, latestTicks, progressOn, recentDone } from "@/lib/plans";
import { useFmt, useGymError, type GymCtx } from "./common";

type Item = Awaited<ReturnType<typeof gymManage.memberPlans>>["items"][number];
const KINDS: PlanKind[] = ["workout", "diet"];

/**
 * The member's plans on their profile (M24-FR-64 to FR-66; feature plans): the active workout plan and
 * diet chart with today's progress and the ticks of the last 7 days, the earlier ones, and for
 * plans.manage **Assign** and **End**. Anyone who can open the profile sees the titles; the API sends
 * the content and ticks to the owner and plans.manage staff only.
 */
export function MemberPlans({ ctx, p }: { ctx: GymCtx; p: Profile }) {
  const t = useTranslations("gp.memberPlans");
  const err = useGymError();
  const m = p.member;
  const locked = featureLocked(ctx.gym.features, "plans");
  const manage = ctx.can("plans.manage") && m.status !== "removed";
  const q = useQuery({ queryKey: ["gm-member-plans", ctx.gymId, m.id], queryFn: () => gymManage.memberPlans(ctx.gymId, m.id), enabled: !locked });
  const [assigning, setAssigning] = useState<PlanKind | null>(null);
  const [showPast, setShowPast] = useState(false);
  if (locked) return null;
  const items = q.data?.items ?? [];
  const active = KINDS.map((k) => items.find((i) => i.kind === k && i.status === "active") ?? null);
  const past = items.filter((i) => i.status !== "active");
  return (
    <Card padded={false} className="p-4" data-testid="profile-plans">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">{t("title")}</h2>
        <ClipboardText size={20} aria-hidden className="text-muted" />
      </div>
      {!m.linked ? <p className="mb-2 text-sm text-muted">{t("unlinked")}</p> : null}
      {q.isPending ? (
        <Skeleton className="h-24 rounded-control" />
      ) : q.isError ? (
        <Notice tone="error">{err(q.error)}</Notice>
      ) : (
        <div className="flex flex-col gap-3">
          {KINDS.map((kind, i) => (
            <Current key={kind} ctx={ctx} kind={kind} item={active[i]} manage={manage} onAssign={() => setAssigning(kind)} />
          ))}
          {past.length ? (
            <div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowPast(!showPast)} aria-expanded={showPast}>
                {showPast ? t("hidePast") : t("showPast", { n: past.length })}
              </Button>
              {showPast ? <PastList ctx={ctx} items={past} /> : null}
            </div>
          ) : null}
        </div>
      )}
      {assigning ? <AssignDialog ctx={ctx} memberId={m.id} kind={assigning} replacing={active[KINDS.indexOf(assigning)]} onClose={() => setAssigning(null)} /> : null}
    </Card>
  );
}

/** One kind: the active plan with today's progress and the last 7 days, or "none" with Assign. */
function Current({ ctx, kind, item, manage, onAssign }: { ctx: GymCtx; kind: PlanKind; item: Item | null; manage: boolean; onAssign: () => void }) {
  const t = useTranslations("gp.memberPlans");
  const tp = useTranslations("gp.plans");
  const f = useFmt();
  const err = useGymError();
  const toast = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const today = dhakaToday();
  const end = async () => {
    if (!item) return;
    setBusy(true);
    setProblem(null);
    try {
      await gymManage.endAssignment(ctx.gymId, item.id);
      await qc.invalidateQueries({ queryKey: ["gm-member-plans", ctx.gymId, item.memberId] });
      toast.show(tp("ended"));
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  if (!item) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-dashed border-line px-3 py-2.5">
        <span className="text-sm">
          <span className="font-semibold">{tp(`kind.${kind}`)}</span> <span className="text-muted">· {t("none")}</span>
        </span>
        {manage ? (
          <Button type="button" size="sm" variant="secondary" icon={<Plus size={16} aria-hidden />} onClick={onAssign} data-testid={`member-plan-assign-${kind}`}>
            {t("assign")}
          </Button>
        ) : null}
      </div>
    );
  }
  const ticks = item.logs ? latestTicks(item.logs) : null;
  const groups = item.content ? groupsOn({ content: item.content, startsOn: item.startsOn, endsOn: item.endsOn }, today) : null;
  const todayProgress = ticks && groups ? progressOn(groups.flatMap((g) => g.refs), ticks, today) : null;
  const recent = item.logs ? recentDone(item.logs, today) : null;
  return (
    <div className="rounded-control border border-line px-3 py-2.5" data-testid={`member-plan-${kind}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{tp(`kind.${kind}`)}</span>
        <Badge tone="brand">{tp("versionN", { n: item.version })}</Badge>
      </div>
      <p className="mt-1 font-semibold">
        {manage ? (
          <Link href={`/manage/${ctx.gymId}/plans/${item.planId}`} className="hover:underline">
            {item.title}
          </Link>
        ) : (
          item.title
        )}
      </p>
      <p className="text-sm text-muted">{item.endsOn ? t("dates", { from: f.short(item.startsOn), to: f.short(item.endsOn) }) : t("since", { from: f.short(item.startsOn) })}</p>
      {recent ? (
        <p className="mt-1 text-sm" data-testid={`member-plan-progress-${kind}`}>
          {todayProgress && todayProgress.total ? t("today", { done: todayProgress.done, total: todayProgress.total }) : t("restDay")} · {t("last7", { n: recent.done })} ·{" "}
          {recent.lastOn ? t("lastTick", { date: f.short(recent.lastOn) }) : t("noTicks")}
        </p>
      ) : null}
      {problem ? <p role="alert" className="mt-1 text-sm text-danger">{problem}</p> : null}
      {manage ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={onAssign} data-testid={`member-plan-change-${kind}`}>
            {t("change")}
          </Button>
          <Button type="button" size="sm" variant="ghost" busy={busy} onClick={() => void end()} confirm={{ kind: "remove", title: tp("endAsk"), body: tp("endAskBody") }} data-testid={`member-plan-end-${kind}`}>
            {tp("end")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function PastList({ ctx, items }: { ctx: GymCtx; items: Item[] }) {
  const t = useTranslations("gp.memberPlans");
  const tp = useTranslations("gp.plans");
  const f = useFmt();
  return (
    <ul className="mt-1 flex flex-col divide-y divide-line text-sm" data-testid="member-plans-past">
      {items.map((i) => (
        <li key={i.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5">
          <span className="text-muted">{tp(`kind.${i.kind}`)}</span>
          <span className="font-semibold">{ctx.can("plans.manage") ? <Link href={`/manage/${ctx.gymId}/plans/${i.planId}`} className="hover:underline">{i.title}</Link> : i.title}</span>
          <span className="text-muted">{tp("versionN", { n: i.version })}</span>
          <span className="ml-auto text-muted">
            {t(`status.${i.status}`)} · {f.short(i.startsOn)} – {f.short(i.endedAt ?? i.endsOn ?? i.startsOn)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Assign one of the gym's active plans of this kind to this member (it replaces the active one). */
function AssignDialog({ ctx, memberId, kind, replacing, onClose }: { ctx: GymCtx; memberId: string; kind: PlanKind; replacing: Item | null; onClose: () => void }) {
  const t = useTranslations("gp.memberPlans");
  const tp = useTranslations("gp.plans");
  const err = useGymError();
  const toast = useToast();
  const qc = useQueryClient();
  const locale = useLocale();
  const plans = useQuery({ queryKey: ["gm-plans", ctx.gymId, "active", kind], queryFn: () => gymManage.plans(ctx.gymId, { kind, status: "active" }) });
  const [planId, setPlanId] = useState("");
  const [startsOn, setStartsOn] = useState(dhakaToday());
  const [endsOn, setEndsOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const options = (plans.data?.items ?? []).filter((pl) => pl.id !== replacing?.planId || pl.currentVersion !== replacing?.version);
  const submit = async () => {
    if (!planId) return;
    setBusy(true);
    setProblem(null);
    try {
      await gymManage.assignPlan(ctx.gymId, planId, { memberIds: [memberId], startsOn, ...(endsOn ? { endsOn } : {}) });
      await qc.invalidateQueries({ queryKey: ["gm-member-plans", ctx.gymId, memberId] });
      toast.show(t("assigned"));
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
      title={t("assignTitle", { kind: tp(`kind.${kind}`) })}
      description={replacing ? t("replaces", { title: replacing.title }) : undefined}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {tp("cancel")}
          </Button>
          <Button type="button" onClick={() => void submit()} busy={busy} disabled={!planId} confirm={{ kind: "add", title: t("assignAsk"), body: replacing ? t("replaces", { title: replacing.title }) : undefined }} data-testid="member-plan-assign-submit">
            {t("assign")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {plans.isPending ? (
          <Skeleton className="h-11 rounded-control" />
        ) : plans.isError ? (
          <Notice tone="error">{err(plans.error)}</Notice>
        ) : !options.length ? (
          <Notice tone="info">
            {t("noPlans")}{" "}
            <Link href={`/manage/${ctx.gymId}/plans/new?kind=${kind}`} className="font-semibold underline">
              {t("writeOne")}
            </Link>
          </Notice>
        ) : (
          <Select id="member-plan-pick" label={t("pick")} value={planId} onChange={(e) => setPlanId(e.target.value)} data-testid="member-plan-pick">
            <option value="">{t("choose")}</option>
            {options.map((pl) => (
              <option key={pl.id} value={pl.id}>
                {pl.title}
                {pl.isTemplate ? ` · ${t("template")}` : ""}
              </option>
            ))}
          </Select>
        )}
        <div className="grid gap-3 sm:grid-cols-2" lang={locale}>
          <Field id="member-plan-from" label={tp("startsOn")} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          <Field id="member-plan-to" label={tp("endsOn")} hint={t("endsHint")} type="date" value={endsOn} min={startsOn} onChange={(e) => setEndsOn(e.target.value)} />
        </div>
        {problem ? <Notice tone="error">{problem}</Notice> : null}
      </div>
    </Dialog>
  );
}

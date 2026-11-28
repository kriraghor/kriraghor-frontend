"use client";

import { useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Barbell, ForkKnife, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Avatar, Button, ButtonLink, Card, Dialog, EmptyState, Field, Notice, Select, SkeletonList, useToast } from "@kriraghor/ui/kit";
import { DatePicker } from "@kriraghor/ui/date";
import { addDays, dhakaToday, gymManage, type PlanKind, type PlanMember } from "@/lib/gym-manage";
import { GymPage, MemberStatus, useGymError, type GymCtx } from "./common";

/**
 * /manage/[gymId]/plans/members (tester feedback, 28 Nov 2026; M24-FR-180): every member of the gym for
 * planning, with the workout plan and diet chart each has now. A trainer account's "Members" page: names,
 * photos and plans only (no phone, money or visits). Assign, change or end a plan from the row; a new plan
 * is written under Plans and can then be assigned to anyone.
 */
export function PlanMembers({ gymId }: { gymId: string }) {
  const t = useTranslations("gp.planMembers");
  return (
    <GymPage gymId={gymId} page="planMembers" feature="plans" wide title={t("title")} description={t("lead")} testId="gm-plan-members">
      {(ctx) => <Body ctx={ctx} />}
    </GymPage>
  );
}

function Body({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gp.planMembers");
  const err = useGymError();
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<{ member: PlanMember; kind: PlanKind } | null>(null);
  const term = q.trim().length >= 2 ? q.trim() : undefined;
  const list = useInfiniteQuery({
    queryKey: ["gm-plan-members", ctx.gymId, "page", term ?? ""],
    initialPageParam: "",
    queryFn: ({ pageParam }) => gymManage.planMembers(ctx.gymId, { ...(term ? { q: term } : {}), ...(pageParam ? { cursor: pageParam } : {}), limit: 50 }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field id="plan-members-q" label={t("find")} value={q} onChange={(e) => setQ(e.target.value)} leading={<MagnifyingGlass size={16} className="text-muted" aria-hidden />} placeholder={t("findPh")} className="min-w-64 flex-1" data-testid="plan-members-q" />
        <ButtonLink href={`/manage/${ctx.gymId}/plans/new?kind=workout`} variant="secondary" icon={<Plus size={16} />}>
          {t("newWorkout")}
        </ButtonLink>
        <ButtonLink href={`/manage/${ctx.gymId}/plans/new?kind=diet`} variant="secondary" icon={<Plus size={16} />}>
          {t("newDiet")}
        </ButtonLink>
      </div>
      {list.isPending ? (
        <SkeletonList rows={5} />
      ) : list.isError ? (
        <Notice tone="error">{err(list.error)}</Notice>
      ) : !rows.length ? (
        <EmptyState title={term ? t("noMatch") : t("none")} body={term ? undefined : t("noneBody")} />
      ) : (
        <ul className="flex flex-col gap-2" data-testid="plan-members-list">
          {rows.map((m) => (
            <MemberRow key={m.id} ctx={ctx} m={m} onAssign={(kind) => setPick({ member: m, kind })} />
          ))}
        </ul>
      )}
      {list.hasNextPage ? (
        <Button type="button" variant="ghost" className="self-center" busy={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
          {t("more")}
        </Button>
      ) : null}
      {pick ? <AssignOne ctx={ctx} member={pick.member} kind={pick.kind} onClose={() => setPick(null)} /> : null}
    </div>
  );
}

function MemberRow({ ctx, m, onAssign }: { ctx: GymCtx; m: PlanMember; onAssign: (kind: PlanKind) => void }) {
  const t = useTranslations("gp.planMembers");
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const [problem, setProblem] = useState<string | null>(null);
  const end = async (assignmentId: string) => {
    setProblem(null);
    try {
      await gymManage.endAssignment(ctx.gymId, assignmentId);
      await qc.invalidateQueries({ queryKey: ["gm-plan-members", ctx.gymId] });
      toast.show(t("ended"));
    } catch (e) {
      setProblem(err(e));
    }
  };
  return (
    <li className="surface-card flex flex-col gap-3 p-4 md:flex-row md:items-center" data-testid="plan-member">
      <div className="flex min-w-0 items-center gap-3 md:w-64">
        <Avatar name={m.displayName} size={40} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{m.displayName}</p>
          <p className="flex items-center gap-2 text-xs text-muted tabular-nums">
            {m.memberCode} <MemberStatus status={m.status} />
          </p>
        </div>
      </div>
      <div className="grid flex-1 gap-2 sm:grid-cols-2">
        {(["workout", "diet"] as const).map((kind) => {
          const cur = m.plans.find((p) => p.kind === kind);
          return (
            <div key={kind} className="flex items-center gap-2 rounded-control border border-line px-3 py-2">
              {kind === "workout" ? <Barbell size={18} className="shrink-0 text-muted" aria-hidden /> : <ForkKnife size={18} className="shrink-0 text-muted" aria-hidden />}
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted">{t(kind)}</span>
                {cur ? (
                  <Link href={`/manage/${ctx.gymId}/plans/${cur.planId}`} className="block truncate text-sm font-semibold text-brand-text underline-offset-4 hover:underline">
                    {cur.title}
                  </Link>
                ) : (
                  <span className="block text-sm text-muted">{t("noneYet")}</span>
                )}
              </span>
              <Button type="button" size="sm" variant="secondary" onClick={() => onAssign(kind)} data-testid={`plan-member-assign-${kind}`}>
                {cur ? t("change") : t("assign")}
              </Button>
              {cur ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => void end(cur.assignmentId)} confirm={{ kind: "remove", title: t("endAsk", { title: cur.title, name: m.displayName }) }}>
                  {t("end")}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
      {problem ? (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      ) : null}
    </li>
  );
}

/** Give one member a workout plan or diet chart from the gym's active plans (the one they had is replaced). */
function AssignOne({ ctx, member, kind, onClose }: { ctx: GymCtx; member: PlanMember; kind: PlanKind; onClose: () => void }) {
  const t = useTranslations("gp.planMembers");
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const plans = useQuery({ queryKey: ["gm-plans", ctx.gymId, kind, "active", false], queryFn: () => gymManage.plans(ctx.gymId, { kind, status: "active" }) });
  const [planId, setPlanId] = useState("");
  const [startsOn, setStartsOn] = useState(dhakaToday());
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const items = plans.data?.items ?? [];
  const chosen = planId || items[0]?.id || "";
  const submit = async () => {
    if (!chosen) return;
    setBusy(true);
    setProblem(null);
    try {
      await gymManage.assignPlan(ctx.gymId, chosen, { memberIds: [member.id], startsOn });
      await Promise.all([qc.invalidateQueries({ queryKey: ["gm-plan-members", ctx.gymId] }), qc.invalidateQueries({ queryKey: ["gm-plan", ctx.gymId] })]);
      toast.show(t("assigned", { name: member.displayName }));
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
      title={t(kind === "workout" ? "pickWorkout" : "pickDiet", { name: member.displayName })}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={() => void submit()} busy={busy} disabled={!chosen} data-testid="plan-member-assign-submit">
            {t("assign")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-testid="plan-member-assign">
        {plans.isPending ? (
          <SkeletonList rows={2} />
        ) : !items.length ? (
          <Card className="flex flex-col gap-2">
            <p className="text-sm">{t(kind === "workout" ? "noWorkouts" : "noDiets")}</p>
            <ButtonLink href={`/manage/${ctx.gymId}/plans/new?kind=${kind}`} size="sm" className="self-start">
              {t(kind === "workout" ? "newWorkout" : "newDiet")}
            </ButtonLink>
          </Card>
        ) : (
          <>
            <Select id="plan-member-plan" label={t("plan")} value={chosen} onChange={(e) => setPlanId(e.target.value)}>
              {items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
            <DatePicker id="plan-member-start" label={t("startsOn")} value={startsOn} min={addDays(dhakaToday(), -30)} max={addDays(dhakaToday(), 60)} onChange={setStartsOn} />
            {member.plans.some((p) => p.kind === kind) ? <p className="text-sm text-muted">{t("replaces")}</p> : null}
          </>
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

"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Barbell, CaretDown, CaretUp, ClipboardText, Copy, ForkKnife, MagnifyingGlass, Plus, Trash, UserPlus, X } from "@phosphor-icons/react";
import { Link, useRouter } from "@kriraghor/ui/i18n/navigation";
import { Badge, Button, ButtonLink, Card, Checkbox, DataTable, Dialog, Field, FilterBar, IconButton, Notice, SegmentedControl, SkeletonList, Textarea, useToast, type Column } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { DatePicker, TimePicker } from "@kriraghor/ui/date";
import { addDays, dhakaToday, gymManage, type DietContent, type MemberSummary, type Plan, type PlanContent, type PlanDetail, type PlanKind, type WorkoutContent } from "@/lib/gym-manage";
import {
  blankContent,
  blankDay,
  blankExercise,
  blankFood,
  blankMeal,
  cleanContent,
  itemCount,
  MAX_DAYS,
  MAX_ITEMS,
  MAX_MEALS,
  move,
  planProblems,
  refsIn,
  textOf,
  type Bilingual,
  type Exercise,
  type Food,
  type Meal,
  type PlanProblem,
  type WorkoutDay,
} from "@/lib/plans";
import { GymPage, MemberStatus, useFmt, useGymError, type GymCtx } from "./common";

const KINDS: PlanKind[] = ["workout", "diet"];
const KIND_ICON = { workout: Barbell, diet: ForkKnife } as const;

/**
 * /manage/[gymId]/plans (M24 §4.1, M24-FR-62 to FR-69; plans.manage, Standard tier and up): the gym's
 * workout plans and diet charts. Templates are reused for many members; a plan assigned to members
 * moves them to each new version (or not) when it is edited. Retired plans keep their assignments'
 * history. The API checks every rule again (the live item and meal limits are settings).
 */
export function Plans({ gymId }: { gymId: string }) {
  const t = useTranslations("gp.plans");
  return (
    <GymPage
      gymId={gymId}
      page="plans"
      feature="plans"
      wide
      title={t("title")}
      description={t("lead")}
      testId="gm-plans"
      actions={
        <>
          <ButtonLink href={`/manage/${gymId}/plans/new?kind=workout`} icon={<Barbell size={18} aria-hidden />} data-testid="plan-new-workout">
            {t("newWorkout")}
          </ButtonLink>
          <ButtonLink href={`/manage/${gymId}/plans/new?kind=diet`} variant="secondary" icon={<ForkKnife size={18} aria-hidden />} data-testid="plan-new-diet">
            {t("newDiet")}
          </ButtonLink>
        </>
      }
    >
      {(ctx) => <PlanList ctx={ctx} />}
    </GymPage>
  );
}

function PlanList({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gp.plans");
  const f = useFmt();
  const err = useGymError();
  const router = useRouter();
  const [kind, setKind] = useState<"" | PlanKind>("");
  const [status, setStatus] = useState<Plan["status"]>("active");
  const [templates, setTemplates] = useState(false);
  const q = useQuery({
    queryKey: ["gm-plans", ctx.gymId, kind, status, templates],
    queryFn: () => gymManage.plans(ctx.gymId, { ...(kind ? { kind } : {}), status, ...(templates ? { template: "true" as const } : {}) }),
  });
  const columns: Column<Plan>[] = [
    {
      id: "title",
      header: t("col.title"),
      cell: (p) => {
        const Icon = KIND_ICON[p.kind];
        return (
          <span className="flex items-center gap-2">
            <Icon size={18} className="shrink-0 text-brand-text" aria-hidden />
            <Link href={`/manage/${ctx.gymId}/plans/${p.id}`} className="font-semibold hover:underline">
              {p.title}
            </Link>
            {p.isTemplate ? <Badge tone="info">{t("template")}</Badge> : null}
          </span>
        );
      },
    },
    { id: "kind", header: t("col.kind"), cell: (p) => t(`kind.${p.kind}`), hideBelow: "lg" },
    { id: "version", header: t("col.version"), cell: (p) => t("versionN", { n: p.currentVersion }), align: "end", width: "6rem" },
    { id: "members", header: t("col.members"), cell: (p) => f.n(p.activeAssignments), align: "end", width: "7rem", sort: (p) => p.activeAssignments },
    { id: "updated", header: t("col.updated"), cell: (p) => f.short(p.updatedAt), align: "end", width: "8rem", hideBelow: "lg", sort: (p) => p.updatedAt },
  ];
  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        chips={{ value: kind, onChange: (v) => setKind(v as "" | PlanKind), label: t("col.kind"), options: [{ value: "", label: t("all") }, ...KINDS.map((k) => ({ value: k, label: t(`kind.${k}`) }))], testId: "plans-kind" }}
        extra={
          <div className="flex flex-wrap items-center gap-4">
            <SegmentedControl size="sm" label={t("status")} value={status} onChange={(v) => setStatus(v as Plan["status"])} options={(["active", "retired"] as const).map((s) => ({ value: s, label: t(`statusOf.${s}`) }))} />
            <Checkbox id="plans-templates" label={t("templatesOnly")} checked={templates} onChange={(e) => setTemplates(e.target.checked)} />
          </div>
        }
      />
      <DataTable
        label={t("title")}
        columns={columns}
        rows={q.data?.items}
        rowId={(p) => p.id}
        loading={q.isPending}
        error={q.isError ? err(q.error) : undefined}
        onRetry={() => void q.refetch()}
        onRowClick={(p) => router.push(`/manage/${ctx.gymId}/plans/${p.id}`)}
        empty={{ icon: <ClipboardText size={32} aria-hidden />, title: t("empty"), body: t("emptyBody") }}
        testId="plans-table"
      />
    </div>
  );
}

// ---------------------------------------------------------------- new and edit

/** /manage/[gymId]/plans/new?kind=workout|diet: write a plan (a template, or one to assign at once). */
export function PlanNew({ gymId }: { gymId: string }) {
  const t = useTranslations("gp.plans");
  const params = useSearchParams();
  const kind: PlanKind = params.get("kind") === "diet" ? "diet" : "workout";
  return (
    <GymPage gymId={gymId} page="plans" feature="plans" wide title={t(kind === "diet" ? "newDiet" : "newWorkout")} back={{ href: `/manage/${gymId}/plans`, label: t("title") }} testId="gm-plan-new">
      {(ctx) => <NewForm ctx={ctx} kind={kind} />}
    </GymPage>
  );
}

function NewForm({ ctx, kind }: { ctx: GymCtx; kind: PlanKind }) {
  const t = useTranslations("gp.plans");
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const [copy] = useState(() => readCopy(kind));
  const [title, setTitle] = useState(() => (copy ? t("copyOf", { title: copy.title }).slice(0, 120) : ""));
  const [isTemplate, setIsTemplate] = useState(true);
  const [content, setContent] = useState<PlanContent>(() => copy?.content ?? blankContent(kind));
  const [shown, setShown] = useState<PlanProblem[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const save = async () => {
    const problems = planProblems(content);
    setShown(problems);
    if (title.trim().length < 2) return setProblem(t("needTitle"));
    if (problems.length) return setProblem(t("fixProblems"));
    setBusy(true);
    setProblem(null);
    try {
      const p = await gymManage.createPlan(ctx.gymId, { kind, title: title.trim(), isTemplate, content: cleanContent(content) });
      await qc.invalidateQueries({ queryKey: ["gm-plans", ctx.gymId] });
      toast.show(t("created"));
      router.replace(`/manage/${ctx.gymId}/plans/${p.id}`);
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <Card className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <Field id="plan-title" label={t("planTitle")} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder={t(kind === "diet" ? "titleDietPh" : "titleWorkoutPh")} data-testid="plan-title" />
        <Checkbox id="plan-template" label={t("isTemplate")} checked={isTemplate} onChange={(e) => setIsTemplate(e.target.checked)} />
      </Card>
      <PlanEditor value={content} onChange={setContent} problems={shown} />
      <SaveBar problem={problem}>
        <Button type="button" onClick={save} busy={busy} data-testid="plan-save">
          {t("create")}
        </Button>
      </SaveBar>
    </div>
  );
}

/** /manage/[gymId]/plans/[planId]: edit (a new version), assign, adherence, versions, retire. */
export function PlanEdit({ gymId, planId }: { gymId: string; planId: string }) {
  const t = useTranslations("gp.plans");
  return (
    <GymPage gymId={gymId} page="plans" feature="plans" wide title={t("planTitleShort")} back={{ href: `/manage/${gymId}/plans`, label: t("title") }} testId="gm-plan">
      {(ctx) => <EditBody ctx={ctx} planId={planId} />}
    </GymPage>
  );
}

function EditBody({ ctx, planId }: { ctx: GymCtx; planId: string }) {
  const err = useGymError();
  const q = useQuery({ queryKey: ["gm-plan", ctx.gymId, planId], queryFn: () => gymManage.plan(ctx.gymId, planId), retry: false });
  if (q.isPending) return <SkeletonList rows={6} />;
  if (q.isError || !q.data) return <Notice tone="error">{err(q.error)}</Notice>;
  // Keyed by version: a saved version starts a fresh draft from what the API now holds.
  return <EditForm key={`${q.data.id}:${q.data.currentVersion}:${q.data.status}`} ctx={ctx} plan={q.data} />;
}

function EditForm({ ctx, plan }: { ctx: GymCtx; plan: PlanDetail }) {
  const t = useTranslations("gp.plans");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const retired = plan.status === "retired";
  const [title, setTitle] = useState(plan.title);
  const [isTemplate, setIsTemplate] = useState(plan.isTemplate);
  const [content, setContent] = useState<PlanContent>(plan.content);
  const [shown, setShown] = useState<PlanProblem[]>([]);
  const [busy, setBusy] = useState<"save" | "retire" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [applyToAssigned, setApply] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const contentChanged = JSON.stringify(cleanContent(content)) !== JSON.stringify(cleanContent(plan.content));
  const changed = contentChanged || title.trim() !== plan.title || isTemplate !== plan.isTemplate;
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["gm-plan", ctx.gymId, plan.id] }), qc.invalidateQueries({ queryKey: ["gm-plans", ctx.gymId] })]);

  const save = async (confirmed = false) => {
    const problems = contentChanged ? planProblems(content) : [];
    setShown(problems);
    if (title.trim().length < 2) return setProblem(t("needTitle"));
    if (problems.length) return setProblem(t("fixProblems"));
    // M24-FR-63: "Update for the N members who have it" before a new version reaches them.
    if (contentChanged && plan.activeAssignments > 0 && !confirmed) return setConfirm(true);
    setConfirm(false);
    setBusy("save");
    setProblem(null);
    try {
      const r = await gymManage.updatePlan(ctx.gymId, plan.id, {
        ...(title.trim() !== plan.title ? { title: title.trim() } : {}),
        ...(isTemplate !== plan.isTemplate ? { isTemplate } : {}),
        ...(contentChanged ? { content: cleanContent(content), applyToAssigned } : {}),
      });
      await refresh();
      toast.show(contentChanged ? t("savedVersion", { n: r.currentVersion, moved: r.movedAssignments ?? 0 }) : t("saved"));
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(null);
    }
  };
  const retire = async () => {
    setBusy("retire");
    setProblem(null);
    try {
      await gymManage.retirePlan(ctx.gymId, plan.id);
      await refresh();
      setRetiring(false);
      toast.show(t("retired"));
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">{t(`kind.${plan.kind}`)}</Badge>
          <Badge>{t("versionN", { n: plan.currentVersion })}</Badge>
          {retired ? <Badge tone="danger">{t("statusOf.retired")}</Badge> : null}
          <span className="text-sm text-muted">{t("membersOn", { n: plan.activeAssignments })}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            {!retired ? (
              <Button type="button" icon={<UserPlus size={18} aria-hidden />} onClick={() => setAssigning(true)} data-testid="plan-assign">
                {t("assign")}
              </Button>
            ) : null}
            <ButtonLink href={`/manage/${ctx.gymId}/plans/new?kind=${plan.kind}`} variant="secondary" icon={<Copy size={18} aria-hidden />} onClick={() => sessionStorageCopy(plan)}>
              {t("copy")}
            </ButtonLink>
            {!retired ? (
              <Button type="button" variant="ghost" icon={<Trash size={18} aria-hidden />} onClick={() => setRetiring(true)} data-testid="plan-retire">
                {t("retire")}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <Field id="plan-title" label={t("planTitle")} value={title} maxLength={120} disabled={retired} onChange={(e) => setTitle(e.target.value)} data-testid="plan-title" />
          <Checkbox id="plan-template" label={t("isTemplate")} checked={isTemplate} disabled={retired} onChange={(e) => setIsTemplate(e.target.checked)} />
        </div>
      </Card>

      {retired ? <Notice tone="info">{t("retiredBody")}</Notice> : <PlanEditor value={content} onChange={setContent} problems={shown} />}
      {retired ? <PlanPreview content={plan.content} /> : null}

      {!retired ? (
        <SaveBar problem={problem}>
          <Button type="button" variant="ghost" disabled={!changed || Boolean(busy)} onClick={() => (setContent(plan.content), setTitle(plan.title), setIsTemplate(plan.isTemplate), setShown([]), setProblem(null))}>
            {t("undo")}
          </Button>
          <Button type="button" onClick={() => void save()} busy={busy === "save"} disabled={!changed} data-testid="plan-save">
            {contentChanged ? t("saveVersion", { n: plan.currentVersion + 1 }) : t("save")}
          </Button>
        </SaveBar>
      ) : problem ? (
        <Notice tone="error">{problem}</Notice>
      ) : null}

      <Adherence ctx={ctx} plan={plan} onChange={refresh} />

      <Card className="flex flex-col gap-2" data-testid="plan-versions">
        <h2 className="font-display text-lg font-bold">{t("versions")}</h2>
        <ul className="flex flex-col divide-y divide-line">
          {plan.versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <Badge tone={v.version === plan.currentVersion ? "brand" : "neutral"}>{t("versionN", { n: v.version })}</Badge>
              <span className="tabular-nums text-muted">{f.date(v.createdAt)}</span>
              <span className="text-muted">{v.createdBy.displayName ?? ""}</span>
              <span className="ml-auto text-muted">{t("items", { n: itemCount(v.content) })}</span>
              {v.version !== plan.currentVersion && !retired ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => setContent(v.content)}>
                  {t("restore")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("confirmTitle", { n: plan.currentVersion + 1 })}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setConfirm(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" onClick={() => void save(true)} busy={busy === "save"} data-testid="plan-confirm">
              {t("saveVersion", { n: plan.currentVersion + 1 })}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Checkbox id="plan-apply" label={t("applyToAssigned", { n: plan.activeAssignments })} checked={applyToAssigned} onChange={(e) => setApply(e.target.checked)} />
          <p className="text-sm text-muted">{applyToAssigned ? t("applyYes") : t("applyNo")}</p>
        </div>
      </Dialog>
      <Dialog
        open={retiring}
        onOpenChange={setRetiring}
        title={t("retireTitle")}
        description={t("retireBody", { n: plan.activeAssignments })}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setRetiring(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" variant="danger" onClick={() => void retire()} busy={busy === "retire"} data-testid="plan-retire-confirm">
              {t("retire")}
            </Button>
          </>
        }
      />
      {assigning ? (
        <AssignDialog
          ctx={ctx}
          plan={plan}
          onClose={() => setAssigning(false)}
          onDone={async (n, replaced) => {
            await refresh();
            setAssigning(false);
            toast.show(t("assigned", { n, replaced }));
          }}
        />
      ) : null}
    </div>
  );
}

const COPY_KEY = "kg-plan-copy";

/** "Copy" opens a new plan with this one's content, handed over in this browser tab only. */
function sessionStorageCopy(plan: PlanDetail) {
  try {
    sessionStorage.setItem(COPY_KEY, JSON.stringify({ kind: plan.kind, title: plan.title, content: plan.content }));
  } catch {
    /* storage off: the new plan starts empty */
  }
}

/** The copied plan for this kind, read once (see sessionStorageCopy). */
function readCopy(kind: PlanKind): { title: string; content: PlanContent } | null {
  try {
    const raw = sessionStorage.getItem(COPY_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(COPY_KEY);
    const c = JSON.parse(raw) as { kind: PlanKind; title: string; content: PlanContent };
    return c.kind === kind && c.content?.kind === kind ? { title: c.title, content: c.content } : null;
  } catch {
    return null;
  }
}

function SaveBar({ problem, children }: { problem: string | null; children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      {problem ? (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- the editor

const intOrNull = (v: string, max: number) => {
  const n = /^\s*\d{1,5}\s*$/.test(v) ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(n, max) : null;
};
const decOrNull = (v: string, max: number) => {
  const n = /^\s*\d{1,4}(\.\d)?\s*$/.test(v) ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(n, max) : null;
};
const numText = (v: number | null | undefined) => (v == null ? "" : String(v));
const hasProblem = (problems: PlanProblem[], path: string) => problems.some((p) => p.path === path || p.path.startsWith(`${path}.`));

/**
 * The plan editor (M24 §6.10): a workout is up to 7 named days of exercises (sets, reps or time,
 * rest, a weight note, a note, a video link); a diet chart is meals (with an optional time) of foods
 * (portion, kcal, protein) and notes. Names go in English and Bangla side by side; one is enough.
 * Rows move up and down; refs stay with their rows, so members' ticks follow an edited item.
 */
export function PlanEditor({ value, onChange, problems }: { value: PlanContent; onChange: (c: PlanContent) => void; problems: PlanProblem[] }) {
  const t = useTranslations("gp.plans");
  const used = refsIn(value);
  if (value.kind === "workout") {
    const w = value;
    const setDays = (days: WorkoutDay[]) => onChange({ ...w, days });
    return (
      <div className="flex flex-col gap-3" data-testid="plan-editor">
        {w.days.map((d, i) => (
          <Group
            key={d.key}
            title={t("dayN", { n: i + 1 })}
            name={d.name}
            namePlaceholder={t("dayNamePh")}
            invalid={hasProblem(problems, `days[${i}].name`)}
            onName={(name) => setDays(w.days.map((x, j) => (j === i ? { ...x, name } : x)))}
            onUp={i > 0 ? () => setDays(move(w.days, i, -1)) : undefined}
            onDown={i < w.days.length - 1 ? () => setDays(move(w.days, i, 1)) : undefined}
            onRemove={w.days.length > 1 ? () => setDays(w.days.filter((_, j) => j !== i)) : undefined}
            tooMany={problems.some((p) => p.path === `days[${i}].items`)}
          >
            {d.items.map((x, k) => (
              <ExerciseRow
                key={x.ref}
                x={x}
                invalid={(f) => hasProblem(problems, `days[${i}].items[${k}]${f ? `.${f}` : ""}`)}
                onChange={(nx) => setDays(w.days.map((dd, j) => (j === i ? { ...dd, items: dd.items.map((y, m) => (m === k ? nx : y)) } : dd)))}
                onUp={k > 0 ? () => setDays(w.days.map((dd, j) => (j === i ? { ...dd, items: move(dd.items, k, -1) } : dd))) : undefined}
                onDown={k < d.items.length - 1 ? () => setDays(w.days.map((dd, j) => (j === i ? { ...dd, items: move(dd.items, k, 1) } : dd))) : undefined}
                onRemove={() => setDays(w.days.map((dd, j) => (j === i ? { ...dd, items: dd.items.filter((_, m) => m !== k) } : dd)))}
              />
            ))}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={<Plus size={16} aria-hidden />}
              disabled={d.items.length >= MAX_ITEMS}
              onClick={() => setDays(w.days.map((dd, j) => (j === i ? { ...dd, items: [...dd.items, blankExercise(used)] } : dd)))}
              data-testid="plan-add-exercise"
            >
              {t("addExercise")}
            </Button>
            {!d.items.length ? <p className="text-sm text-muted">{t("restDayHint")}</p> : null}
          </Group>
        ))}
        <Button type="button" variant="secondary" icon={<Plus size={18} aria-hidden />} disabled={w.days.length >= MAX_DAYS} onClick={() => setDays([...w.days, blankDay(used)])} className="self-start" data-testid="plan-add-day">
          {t("addDay", { n: w.days.length, max: MAX_DAYS })}
        </Button>
        <p className="text-sm text-muted">{t("daysRepeat")}</p>
      </div>
    );
  }
  const dt = value;
  const setMeals = (meals: Meal[]) => onChange({ ...dt, meals });
  return (
    <div className="flex flex-col gap-3" data-testid="plan-editor">
      {dt.meals.map((m, i) => (
        <Group
          key={m.ref}
          title={t("mealN", { n: i + 1 })}
          name={m.name}
          namePlaceholder={t("mealNamePh")}
          invalid={hasProblem(problems, `meals[${i}].name`)}
          onName={(name) => setMeals(dt.meals.map((x, j) => (j === i ? { ...x, name } : x)))}
          onUp={i > 0 ? () => setMeals(move(dt.meals, i, -1)) : undefined}
          onDown={i < dt.meals.length - 1 ? () => setMeals(move(dt.meals, i, 1)) : undefined}
          onRemove={dt.meals.length > 1 ? () => setMeals(dt.meals.filter((_, j) => j !== i)) : undefined}
          tooMany={problems.some((p) => p.path === `meals[${i}].items`)}
          extra={
            <TimePicker
              id={`meal-${m.ref}-time`}
              step={15}
              label={t("mealTime")}
              optional={t("optional")}
              value={m.time ?? ""}
              error={hasProblem(problems, `meals[${i}].time`) ? t("badTime") : undefined}
              onChange={(v) => setMeals(dt.meals.map((x, j) => (j === i ? { ...x, time: v || null } : x)))}
              className="sm:w-44"
            />
          }
        >
          {m.items.map((x, k) => (
            <FoodRow
              key={x.ref}
              x={x}
              invalid={(f) => hasProblem(problems, `meals[${i}].items[${k}]${f ? `.${f}` : ""}`)}
              onChange={(nx) => setMeals(dt.meals.map((mm, j) => (j === i ? { ...mm, items: mm.items.map((y, n) => (n === k ? nx : y)) } : mm)))}
              onUp={k > 0 ? () => setMeals(dt.meals.map((mm, j) => (j === i ? { ...mm, items: move(mm.items, k, -1) } : mm))) : undefined}
              onDown={k < m.items.length - 1 ? () => setMeals(dt.meals.map((mm, j) => (j === i ? { ...mm, items: move(mm.items, k, 1) } : mm))) : undefined}
              onRemove={() => setMeals(dt.meals.map((mm, j) => (j === i ? { ...mm, items: mm.items.filter((_, n) => n !== k) } : mm)))}
            />
          ))}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            icon={<Plus size={16} aria-hidden />}
            disabled={m.items.length >= MAX_ITEMS}
            onClick={() => setMeals(dt.meals.map((mm, j) => (j === i ? { ...mm, items: [...mm.items, blankFood(used)] } : mm)))}
            data-testid="plan-add-food"
          >
            {t("addFood")}
          </Button>
        </Group>
      ))}
      <Button type="button" variant="secondary" icon={<Plus size={18} aria-hidden />} disabled={dt.meals.length >= MAX_MEALS} onClick={() => setMeals([...dt.meals, blankMeal(used)])} className="self-start" data-testid="plan-add-meal">
        {t("addMeal", { n: dt.meals.length, max: MAX_MEALS })}
      </Button>
      <Card className="flex flex-col gap-2">
        <h3 className="font-display font-bold">{t("dietNotes")}</h3>
        <BilingualFields id="diet-notes" value={dt.notes ?? { en: "", bn: "" }} long onChange={(notes) => onChange({ ...dt, notes })} placeholder={t("dietNotesPh")} />
      </Card>
    </div>
  );
}

/** English and Bangla side by side (one is enough). */
function BilingualFields({ id, value, onChange, placeholder, invalid, long }: { id: string; value: Bilingual; onChange: (v: Bilingual) => void; placeholder?: { en?: string; bn?: string } | string; invalid?: boolean; long?: boolean }) {
  const t = useTranslations("gp.plans");
  const ph = typeof placeholder === "string" ? { en: placeholder, bn: undefined } : (placeholder ?? {});
  const err = invalid ? t("needName") : undefined;
  if (long)
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Textarea id={`${id}-en`} label={t("english")} value={value.en ?? ""} maxLength={500} rows={2} onChange={(e) => onChange({ ...value, en: e.target.value })} placeholder={ph.en} />
        <Textarea id={`${id}-bn`} label={t("bangla")} value={value.bn ?? ""} maxLength={500} rows={2} lang="bn" onChange={(e) => onChange({ ...value, bn: e.target.value })} placeholder={ph.bn} />
      </div>
    );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field id={`${id}-en`} label={t("english")} value={value.en ?? ""} maxLength={80} error={err} onChange={(e) => onChange({ ...value, en: e.target.value })} placeholder={ph.en} />
      <Field id={`${id}-bn`} label={t("bangla")} value={value.bn ?? ""} maxLength={80} lang="bn" onChange={(e) => onChange({ ...value, bn: e.target.value })} placeholder={ph.bn} />
    </div>
  );
}

function Group({
  title,
  name,
  namePlaceholder,
  invalid,
  onName,
  onUp,
  onDown,
  onRemove,
  tooMany,
  extra,
  children,
}: {
  title: string;
  name: Bilingual;
  namePlaceholder: string;
  invalid: boolean;
  onName: (n: Bilingual) => void;
  onUp?: () => void;
  onDown?: () => void;
  onRemove?: () => void;
  tooMany: boolean;
  extra?: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("gp.plans");
  const [open, setOpen] = useState(true);
  const locale = useLocale();
  return (
    <Card className="flex flex-col gap-3" data-testid="plan-group">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-10 min-w-0 flex-1 items-center gap-2 text-left">
          {open ? <CaretUp size={18} aria-hidden /> : <CaretDown size={18} aria-hidden />}
          <span className="font-display text-lg font-bold">{title}</span>
          {textOf(name, locale) ? <span className="truncate text-muted">· {textOf(name, locale)}</span> : null}
        </button>
        <RowTools onUp={onUp} onDown={onDown} onRemove={onRemove} removeLabel={t("removeGroup")} />
      </div>
      {open ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <BilingualFields id={`g-${title}`} value={name} onChange={onName} placeholder={namePlaceholder} invalid={invalid} />
            </div>
            {extra}
          </div>
          <div className="flex flex-col gap-2">{children}</div>
          {tooMany ? <p className="text-sm text-danger">{t("tooManyItems")}</p> : null}
        </>
      ) : null}
    </Card>
  );
}

function RowTools({ onUp, onDown, onRemove, removeLabel }: { onUp?: () => void; onDown?: () => void; onRemove?: () => void; removeLabel: string }) {
  const t = useTranslations("gp.plans");
  return (
    <span className="flex shrink-0 items-center">
      <IconButton label={t("moveUp")} onClick={onUp} disabled={!onUp}>
        <ArrowUp size={18} aria-hidden />
      </IconButton>
      <IconButton label={t("moveDown")} onClick={onDown} disabled={!onDown}>
        <ArrowDown size={18} aria-hidden />
      </IconButton>
      <IconButton label={removeLabel} onClick={onRemove} disabled={!onRemove}>
        <X size={18} aria-hidden />
      </IconButton>
    </span>
  );
}

function ExerciseRow({ x, invalid, onChange, onUp, onDown, onRemove }: { x: Exercise; invalid: (field?: string) => boolean; onChange: (x: Exercise) => void; onUp?: () => void; onDown?: () => void; onRemove: () => void }) {
  const t = useTranslations("gp.plans");
  const [more, setMore] = useState(Boolean(x.timeSec || x.weightNote || x.note || x.videoUrl));
  const id = `ex-${x.ref}`;
  return (
    <div className={cn("flex flex-col gap-3 rounded-control border p-3", invalid() ? "border-danger" : "border-line")} data-testid="plan-exercise">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <BilingualFields id={id} value={x.name} onChange={(name) => onChange({ ...x, name })} placeholder={{ en: t("exercisePh"), bn: t("exercisePhBn") }} invalid={invalid("name")} />
        </div>
        <RowTools onUp={onUp} onDown={onDown} onRemove={onRemove} removeLabel={t("removeItem")} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field id={`${id}-sets`} label={t("sets")} inputMode="numeric" value={numText(x.sets)} onChange={(e) => onChange({ ...x, sets: intOrNull(e.target.value, 50) })} />
        <Field id={`${id}-reps`} label={t("reps")} value={x.reps ?? ""} maxLength={20} placeholder="8-10" onChange={(e) => onChange({ ...x, reps: e.target.value })} />
        <Field id={`${id}-rest`} label={t("restSec")} inputMode="numeric" value={numText(x.restSec)} onChange={(e) => onChange({ ...x, restSec: intOrNull(e.target.value, 3600) })} />
      </div>
      {more ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={`${id}-time`} label={t("timeSec")} optional={t("optional")} inputMode="numeric" value={numText(x.timeSec)} onChange={(e) => onChange({ ...x, timeSec: intOrNull(e.target.value, 7200) })} />
          <Field id={`${id}-weight`} label={t("weightNote")} optional={t("optional")} value={x.weightNote ?? ""} maxLength={80} placeholder={t("weightPh")} onChange={(e) => onChange({ ...x, weightNote: e.target.value })} />
          <Field id={`${id}-note`} label={t("note")} optional={t("optional")} value={x.note ?? ""} maxLength={300} onChange={(e) => onChange({ ...x, note: e.target.value })} />
          <Field
            id={`${id}-video`}
            type="url"
            label={t("video")}
            optional={t("optional")}
            value={x.videoUrl ?? ""}
            maxLength={500}
            placeholder="https://"
            error={invalid("videoUrl") ? t("badVideo") : undefined}
            onChange={(e) => onChange({ ...x, videoUrl: e.target.value })}
          />
        </div>
      ) : (
        <button type="button" onClick={() => setMore(true)} className="w-fit text-sm font-semibold text-brand-text">
          {t("more")}
        </button>
      )}
    </div>
  );
}

function FoodRow({ x, invalid, onChange, onUp, onDown, onRemove }: { x: Food; invalid: (field?: string) => boolean; onChange: (x: Food) => void; onUp?: () => void; onDown?: () => void; onRemove: () => void }) {
  const t = useTranslations("gp.plans");
  const id = `food-${x.ref}`;
  return (
    <div className={cn("flex flex-col gap-3 rounded-control border p-3", invalid() ? "border-danger" : "border-line")} data-testid="plan-food">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <BilingualFields id={id} value={x.name} onChange={(name) => onChange({ ...x, name })} placeholder={{ en: t("foodPh"), bn: t("foodPhBn") }} invalid={invalid("name")} />
        </div>
        <RowTools onUp={onUp} onDown={onDown} onRemove={onRemove} removeLabel={t("removeItem")} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field id={`${id}-portion`} label={t("portion")} value={x.portion ?? ""} maxLength={40} placeholder={t("portionPh")} onChange={(e) => onChange({ ...x, portion: e.target.value })} />
        <Field id={`${id}-kcal`} label={t("kcal")} optional={t("optional")} inputMode="numeric" value={numText(x.kcal)} onChange={(e) => onChange({ ...x, kcal: intOrNull(e.target.value, 5000) })} />
        <Field id={`${id}-protein`} label={t("protein")} optional={t("optional")} inputMode="decimal" value={numText(x.proteinG)} onChange={(e) => onChange({ ...x, proteinG: decOrNull(e.target.value, 500) })} />
      </div>
      <Field id={`${id}-note`} label={t("note")} optional={t("optional")} value={x.note ?? ""} maxLength={300} onChange={(e) => onChange({ ...x, note: e.target.value })} />
    </div>
  );
}

/** A retired plan, read-only. */
function PlanPreview({ content }: { content: PlanContent }) {
  const t = useTranslations("gp.plans");
  const locale = useLocale();
  const groups = content.kind === "workout" ? (content as WorkoutContent).days.map((d) => ({ key: d.key, name: d.name, items: d.items })) : (content as DietContent).meals.map((m) => ({ key: m.ref, name: m.name, items: m.items }));
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {groups.map((g, i) => (
        <Card key={g.key} className="flex flex-col gap-1">
          <h3 className="font-display font-bold">
            {t(content.kind === "workout" ? "dayN" : "mealN", { n: i + 1 })} · {textOf(g.name, locale)}
          </h3>
          <ul className="list-inside list-disc text-sm">
            {g.items.map((x) => (
              <li key={x.ref}>{textOf(x.name, locale)}</li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- assign and adherence

/** Members on this plan (the active assignments the caller can see): last tick, items ticked in 7 days, End. */
function Adherence({ ctx, plan, onChange }: { ctx: GymCtx; plan: PlanDetail; onChange: () => Promise<unknown> }) {
  const t = useTranslations("gp.plans");
  const f = useFmt();
  const err = useGymError();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const end = async (id: string) => {
    setBusy(id);
    setProblem(null);
    try {
      await gymManage.endAssignment(ctx.gymId, id);
      await onChange();
      toast.show(t("ended"));
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(null);
    }
  };
  type Row = PlanDetail["assignments"][number];
  const columns: Column<Row>[] = [
    {
      id: "member",
      header: t("col.member"),
      cell: (a) => (
        <span className="flex flex-wrap items-center gap-2">
          <Link href={`/manage/${ctx.gymId}/members/${a.memberId}`} className="font-semibold hover:underline">
            {a.member.displayName}
          </Link>
          <span className="text-xs text-muted tabular-nums">{a.member.memberCode}</span>
          <MemberStatus status={a.member.status} />
        </span>
      ),
    },
    { id: "version", header: t("col.version"), cell: (a) => (a.version === plan.currentVersion ? t("versionN", { n: a.version }) : <Badge tone="warning">{t("versionN", { n: a.version })}</Badge>), width: "6rem" },
    { id: "from", header: t("col.from"), cell: (a) => `${f.short(a.startsOn)}${a.endsOn ? ` – ${f.short(a.endsOn)}` : ""}`, hideBelow: "lg" },
    { id: "last", header: t("col.lastTick"), cell: (a) => (a.lastTickOn ? f.short(a.lastTickOn) : t("never")), sort: (a) => a.lastTickOn ?? "" },
    { id: "done7", header: t("col.done7"), cell: (a) => f.n(a.doneLast7Days), align: "end", sort: (a) => a.doneLast7Days },
    {
      id: "end",
      header: "",
      label: t("end"),
      cell: (a) => (
        <Button type="button" size="sm" variant="ghost" busy={busy === a.id} onClick={() => void end(a.id)} data-testid="plan-end">
          {t("end")}
        </Button>
      ),
      align: "end",
      width: "6rem",
    },
  ];
  return (
    <Card className="flex flex-col gap-2" data-testid="plan-adherence">
      <h2 className="font-display text-lg font-bold">{t("adherence")}</h2>
      <p className="text-sm text-muted">{t("adherenceLead")}</p>
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <DataTable label={t("adherence")} columns={columns} rows={plan.assignments} rowId={(a) => a.id} empty={{ title: t("noMembers"), body: t("noMembersBody") }} testId="plan-adherence-table" />
    </Card>
  );
}

/**
 * Assign a plan (M24-FR-64): pick up to 100 members by name, phone or member code, a start date (from
 * gym_manage.backdate_days ago to 60 days ahead, checked by the API) and an optional end. A member who
 * already has a plan of this kind at the gym moves to this one (the earlier one is replaced).
 */
function AssignDialog({ ctx, plan, onClose, onDone }: { ctx: GymCtx; plan: PlanDetail; onClose: () => void; onDone: (n: number, replaced: number) => Promise<void> }) {
  const t = useTranslations("gp.plans");
  const err = useGymError();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Map<string, MemberSummary>>(new Map());
  const [startsOn, setStartsOn] = useState(dhakaToday());
  const [endsOn, setEndsOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const already = useMemo(() => new Set(plan.assignments.map((a) => a.memberId)), [plan.assignments]);
  const search = useQuery({
    queryKey: ["gm-members", ctx.gymId, "assign", q.trim()],
    queryFn: () => gymManage.members(ctx.gymId, { status: "active", ...(q.trim().length >= 2 ? { q: q.trim() } : {}), limit: 20 }),
    staleTime: 15_000,
  });
  const toggle = (m: MemberSummary) => {
    const next = new Map(picked);
    if (next.has(m.id)) next.delete(m.id);
    else if (next.size < 100) next.set(m.id, m);
    setPicked(next);
  };
  const submit = async () => {
    if (!picked.size) return setProblem(t("pickMembers"));
    setBusy(true);
    setProblem(null);
    try {
      const r = await gymManage.assignPlan(ctx.gymId, plan.id, { memberIds: [...picked.keys()], startsOn, ...(endsOn ? { endsOn } : {}) });
      await onDone(r.assignments.length, r.replaced);
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
      title={t("assignTitle", { title: plan.title })}
      description={t("assignLead")}
      className="sm:max-w-[640px]"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={submit} busy={busy} disabled={!picked.size} data-testid="plan-assign-submit">
            {t("assignN", { n: picked.size })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-testid="plan-assign-dialog">
        <Field id="assign-q" label={t("findMember")} value={q} onChange={(e) => setQ(e.target.value)} leading={<MagnifyingGlass size={16} className="text-muted" aria-hidden />} placeholder={t("findMemberPh")} data-testid="plan-assign-q" />
        {picked.size ? (
          <div className="flex flex-wrap gap-1.5">
            {[...picked.values()].map((m) => (
              <button key={m.id} type="button" onClick={() => toggle(m)} className="inline-flex min-h-8 items-center gap-1 rounded-pill bg-brand-soft px-3 text-sm font-semibold text-brand-text">
                {m.displayName} <X size={14} aria-label={t("removeItem")} />
              </button>
            ))}
          </div>
        ) : null}
        <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-control border border-line">
          {search.isPending ? (
            <li className="p-3">
              <SkeletonList rows={3} />
            </li>
          ) : !search.data?.items.length ? (
            <li className="p-3 text-sm text-muted">{t("noMatch")}</li>
          ) : (
            search.data.items.map((m) => (
              <li key={m.id}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2">
                  <input type="checkbox" checked={picked.has(m.id)} onChange={() => toggle(m)} className="size-5" data-testid="plan-assign-member" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{m.displayName}</span>
                    <span className="text-xs text-muted tabular-nums">
                      {m.memberCode}
                      {already.has(m.id) ? ` · ${t("alreadyOn")}` : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))
          )}
        </ul>
        <div className="grid gap-3 sm:grid-cols-2">
          <DatePicker id="assign-start" label={t("startsOn")} value={startsOn} min={addDays(dhakaToday(), -30)} max={addDays(dhakaToday(), 60)} onChange={setStartsOn} />
          <DatePicker id="assign-end" label={t("endsOn")} optional={t("optional")} value={endsOn} min={startsOn} onChange={setEndsOn} />
        </div>
        <p className="text-sm text-muted">{t("replaceNote", { kind: t(`kind.${plan.kind}`) })}</p>
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

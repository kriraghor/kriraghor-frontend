"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Barbell, Check, ClipboardText, ForkKnife, NotePencil, PlayCircle, Warning } from "@phosphor-icons/react";
import { useAuth } from "@kriraghor/ui/auth";
import { SignedOutCard } from "@kriraghor/ui/account";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Badge, Button, ButtonLink, Card, EmptyState, Notice, SegmentedControl, Skeleton, Textarea, useConfirm } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { addDays, gymMe, type MyPlanItem, type MyPlans as MyPlansData, type PlanContent } from "@/lib/gym-manage";
import { groupsOn, latestTicks, progressOn, textOf, tickKey, todayFirst, type Bilingual } from "@/lib/plans";
import { useFmt, useGymError } from "@/components/gym-manage/common";
import { ExerciseSteps } from "@/components/gym-ops/ExerciseLibrary";

const KEY = ["my-gym-plans"] as const;
type Ticks = Map<string, { done: boolean; note: string | null }>;

/** My plans across my gyms (M24-FR-64), shared by /me, /me/plans and the membership page. */
export function useMyPlans() {
  const { status } = useAuth();
  return { status, plans: useQuery({ queryKey: KEY, queryFn: () => gymMe.plans(), enabled: status === "signed_in" }) };
}

/** "45 s", "2 min", "1 min 30 s". */
function useDuration() {
  const t = useTranslations("gp.plan");
  return (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (!m) return t("secs", { n: s });
    return s ? t("minSecs", { m, s }) : t("mins", { n: m });
  };
}

/** One exercise or food: its name in my language, then the numbers the gym gave. */
function ItemFacts({ content, itemRef }: { content: PlanContent; itemRef: string }) {
  const t = useTranslations("gp.plan");
  const locale = useLocale();
  const dur = useDuration();
  if (content.kind === "workout") {
    const x = content.days.flatMap((d) => d.items).find((i) => i.ref === itemRef);
    if (!x) return null;
    const facts = [
      x.sets ? (x.reps ? t("setsReps", { sets: x.sets, reps: x.reps }) : t("sets", { n: x.sets })) : x.reps ? t("reps", { reps: x.reps }) : null,
      x.timeSec ? dur(x.timeSec) : null,
      x.restSec ? t("rest", { time: dur(x.restSec) }) : null,
      x.weightNote,
    ].filter(Boolean);
    return (
      <span className="min-w-0">
        <span className="block font-semibold">{textOf(x.name, locale)}</span>
        {facts.length ? <span className="block text-sm text-muted">{facts.join(" · ")}</span> : null}
        {x.note ? <span className="block text-sm text-muted">{x.note}</span> : null}
        {x.videoUrl ? (
          <a href={x.videoUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-0.5 inline-flex min-h-8 items-center gap-1 text-sm font-semibold text-brand-text underline">
            <PlayCircle size={16} aria-hidden /> {t("video")}
          </a>
        ) : null}
        {x.exerciseKey ? <ExerciseSteps exerciseKey={x.exerciseKey} /> : null}
      </span>
    );
  }
  const x = content.meals.flatMap((m) => m.items).find((i) => i.ref === itemRef);
  if (!x) return null;
  const facts = [x.portion, x.kcal != null ? t("kcal", { n: x.kcal }) : null, x.proteinG != null ? t("protein", { n: x.proteinG }) : null].filter(Boolean);
  return (
    <span className="min-w-0">
      <span className="block font-semibold">{textOf(x.name, locale)}</span>
      {facts.length ? <span className="block text-sm text-muted">{facts.join(" · ")}</span> : null}
      {x.note ? <span className="block text-sm text-muted">{x.note}</span> : null}
    </span>
  );
}

/** "Given by {gym}, not medical advice" (M24-FR-69), on every plan view. */
function Safety({ text }: { text: Bilingual }) {
  const locale = useLocale();
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted" data-testid="plan-safety">
      <Warning size={14} className="mt-0.5 shrink-0" aria-hidden /> {textOf(text, locale)}
    </p>
  );
}

/**
 * One assignment's day: each group (the workout day, or each meal) with its items and a **Done** tick
 * and an optional note per item (M24-FR-65). Ticks are saved one by one (the log is append-only; the
 * latest tick per item and date wins) and shown at once, put back if the save fails.
 */
function PlanDay({ item, date, ticks, onTick }: { item: MyPlanItem; date: string; ticks: Ticks; onTick: (ref: string, done: boolean, note: string | null) => Promise<void> }) {
  const t = useTranslations("gp.plan");
  const locale = useLocale();
  const groups = groupsOn(item, date);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const ask = useConfirm();
  if (!groups) return <p className="text-sm text-muted">{t("notToday")}</p>;
  const refs = groups.flatMap((g) => g.refs);
  const p = progressOn(refs, ticks, date);
  const save = async (ref: string, done: boolean, note: string | null) => {
    setSaving(ref);
    try {
      await onTick(ref, done, note);
    } finally {
      setSaving(null);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      {refs.length ? (
        <div>
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>{t("progress", { done: p.done, total: p.total })}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-pill bg-surface-2" aria-hidden>
            <div className="h-full bg-brand transition-[width]" style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} />
          </div>
        </div>
      ) : null}
      {groups.map((g) => (
        <div key={g.key}>
          <h3 className="flex items-baseline gap-2 font-display text-lg font-bold">
            {textOf(g.name, locale)}
            {g.time ? <span className="text-sm font-normal text-muted tabular-nums">{g.time}</span> : null}
          </h3>
          {!g.refs.length ? <p className="text-sm text-muted">{item.kind === "workout" ? t("restDay") : t("noItems")}</p> : null}
          <ul className="mt-2 flex flex-col divide-y divide-line rounded-control border border-line">
            {g.refs.map((ref) => {
              const tick = ticks.get(tickKey(date, ref));
              const done = Boolean(tick?.done);
              return (
                <li key={ref} className="flex flex-col gap-2 p-3" data-testid="plan-item">
                  <div className="flex items-start gap-3">
                    <ItemFacts content={item.content} itemRef={ref} />
                    {item.readOnly ? null : (
                      <button
                        type="button"
                        aria-pressed={done}
                        disabled={saving === ref}
                        onClick={async () => {
                          // Tester feedback, 28 Nov 2026: taking a tick back asks first; ticking stays one tap.
                          if (done && !(await ask({ title: t("undoTitle"), body: t("undoBody"), confirmLabel: t("undoYes") }))) return;
                          void save(ref, !done, tick?.note ?? null);
                        }}
                        className={cn(
                          "ml-auto inline-flex min-h-11 min-w-24 shrink-0 items-center justify-center gap-1.5 rounded-control border px-3 font-bold",
                          done ? "border-brand bg-brand text-on-brand" : "border-line hover:border-brand",
                        )}
                        data-testid="plan-done"
                      >
                        <Check size={18} weight={done ? "bold" : "regular"} aria-hidden /> {done ? t("done") : t("markDone")}
                      </button>
                    )}
                  </div>
                  {tick?.note && noteFor !== ref ? <p className="rounded-control bg-surface-2 px-3 py-2 text-sm">{tick.note}</p> : null}
                  {item.readOnly ? null : noteFor === ref ? (
                    <form
                      className="flex flex-col gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void save(ref, done, draft.trim() || null).then(() => setNoteFor(null));
                      }}
                    >
                      <Textarea id={`note-${ref}`} label={t("myNote")} value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 300))} rows={2} maxLength={300} placeholder={t("notePlaceholder")} />
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" busy={saving === ref} confirm="save">
                          {t("saveNote")}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setNoteFor(null)}>
                          {t("cancel")}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(tick?.note ?? "");
                        setNoteFor(ref);
                      }}
                      className="inline-flex min-h-8 w-fit items-center gap-1 text-sm font-semibold text-brand-text"
                    >
                      <NotePencil size={16} aria-hidden /> {tick?.note ? t("editNote") : t("addNote")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Tick one item: shown at once in the cache, put back if the API refuses (M24-FR-65). */
function useTick() {
  const qc = useQueryClient();
  const err = useGymError();
  const [problem, setProblem] = useState<string | null>(null);
  const tick = useMutation({
    mutationFn: (v: { assignmentId: string; localDate: string; itemRef: string; done: boolean; note: string | null }) => gymMe.logPlan(v.assignmentId, { localDate: v.localDate, itemRef: v.itemRef, done: v.done, note: v.note }),
    onMutate: async (v) => {
      setProblem(null);
      await qc.cancelQueries({ queryKey: KEY });
      const before = qc.getQueryData<MyPlansData>(KEY);
      if (before)
        qc.setQueryData<MyPlansData>(KEY, {
          ...before,
          items: before.items.map((it) =>
            it.assignmentId === v.assignmentId ? { ...it, ticks: [{ id: "pending", assignmentId: v.assignmentId, localDate: v.localDate, itemRef: v.itemRef, done: v.done, note: v.note, createdAt: new Date().toISOString() }, ...it.ticks] } : it,
          ),
        });
      return { before };
    },
    onError: (e, _v, c) => {
      if (c?.before) qc.setQueryData(KEY, c.before);
      setProblem(err(e));
    },
    onSettled: (_d, _e, v) => {
      void qc.invalidateQueries({ queryKey: KEY });
      void qc.invalidateQueries({ queryKey: ["my-gym-plan", v.assignmentId] });
    },
  });
  return { problem, tick: (v: Parameters<typeof tick.mutateAsync>[0]) => tick.mutateAsync(v).then(() => undefined, () => undefined) };
}

/**
 * /me/plans (M24 §4.1, M24-FR-64 to FR-69): today's workout and today's meals first, with a **Done**
 * tick and a note per item, then the coming week. I can also tick the last few days
 * (gym_manage.plan_log_back_days). Plans I can no longer tick (ended, replaced, or a gym I left) are
 * listed apart and open read-only.
 */
export function MyPlans() {
  const t = useTranslations("gp.plan");
  const f = useFmt();
  const err = useGymError();
  const { status, plans } = useMyPlans();
  const { problem, tick } = useTick();
  const [day, setDay] = useState(0);
  if (status === "signed_out") return <SignedOutCard signInHref="/sign-in?next=/me/plans" />;
  const data = plans.data;
  const items = data ? todayFirst(data.items) : [];
  const live = items.filter((i) => !i.readOnly);
  const past = items.filter((i) => i.readOnly);
  const back = Math.min(data?.logBackDays ?? 0, 3);
  const date = data ? addDays(data.today, -day) : "";
  return (
    <section className="mx-auto w-full max-w-[960px] px-4 py-6 sm:px-6 md:py-10" data-testid="me-plans">
      <h1 className="font-display text-3xl font-extrabold">{t("title")}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">{t("lead")}</p>
      {plans.isPending ? (
        <Skeleton className="mt-6 h-64 rounded-card" />
      ) : plans.isError ? (
        <Notice tone="error" className="mt-6">
          {err(plans.error)}
        </Notice>
      ) : !items.length ? (
        <EmptyState className="mt-6" icon={<ClipboardText size={32} aria-hidden />} title={t("none")} body={t("noneBody")} action={<ButtonLink href="/me">{t("myGyms")}</ButtonLink>} />
      ) : (
        <>
          {back > 0 && live.length ? (
            <SegmentedControl
              className="mt-5"
              label={t("day")}
              value={String(day)}
              onChange={(v) => setDay(Number(v))}
              options={Array.from({ length: back + 1 }, (_, i) => ({ value: String(i), label: i === 0 ? t("today") : i === 1 ? t("yesterday") : f.short(addDays(data!.today, -i)) }))}
            />
          ) : null}
          {problem ? (
            <Notice tone="error" className="mt-4">
              {problem}
            </Notice>
          ) : null}
          <div className="mt-5 flex flex-col gap-5">
            {live.map((it) => (
              <PlanCard key={it.assignmentId} item={it} date={date} today={data!.today} onTick={(ref, done, note) => tick({ assignmentId: it.assignmentId, localDate: date, itemRef: ref, done, note })} />
            ))}
          </div>
          {past.length ? (
            <div className="mt-8">
              <h2 className="font-display text-lg font-bold">{t("past")}</h2>
              <ul className="mt-2 grid gap-3 md:grid-cols-2">
                {past.map((it) => (
                  <li key={it.assignmentId}>
                    <Link href={`/me/plans/${it.assignmentId}`} className="block">
                      <Card className="flex flex-col gap-1 hover:border-brand">
                        <span className="font-display font-bold">{it.title}</span>
                        <span className="text-sm text-muted">
                          {it.gym?.name ?? ""} · {t(`kind.${it.kind}`)} · {t(`status.${it.status}`)}
                        </span>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

/** One live plan on /me/plans: the chosen day, then (workouts) the week ahead. */
function PlanCard({ item, date, today, onTick }: { item: MyPlanItem; date: string; today: string; onTick: (ref: string, done: boolean, note: string | null) => Promise<void> }) {
  const t = useTranslations("gp.plan");
  const locale = useLocale();
  const f = useFmt();
  const ticks = latestTicks(item.ticks);
  const Icon = item.kind === "workout" ? Barbell : ForkKnife;
  return (
    <Card className="flex flex-col gap-4" data-testid="plan-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-brand-soft text-brand-text">
            <Icon size={22} aria-hidden />
          </span>
          <div className="min-w-0">
            <Link href={`/me/plans/${item.assignmentId}`} className="block font-display text-xl font-bold hover:underline">
              {item.title}
            </Link>
            <p className="text-sm text-muted">
              {item.gym?.name ?? ""} · {t(`kind.${item.kind}`)} · {t("version", { n: item.version })}
            </p>
          </div>
        </div>
        {item.endsOn ? <Badge>{t("until", { date: f.date(item.endsOn) })}</Badge> : null}
      </div>
      <Safety text={item.safety} />
      <PlanDay item={item} date={date} ticks={ticks} onTick={onTick} />
      {item.kind === "workout" && date === today ? (
        <div>
          <h3 className="text-sm font-semibold text-muted">{t("week")}</h3>
          <ol className="mt-2 grid grid-cols-7 gap-1 text-center text-xs" data-testid="plan-week">
            {item.week.map((w) => {
              const d = w.index !== null && item.content.kind === "workout" ? item.content.days[w.index] : null;
              return (
                <li key={w.date} className={cn("rounded-control border px-1 py-2", w.date === today ? "border-brand" : "border-line", !d && "text-muted")}>
                  <span className="block font-semibold tabular-nums">{f.weekday(w.date)}</span>
                  <span className="mt-0.5 block truncate" title={d ? textOf(d.name, locale) : undefined}>
                    {d ? textOf(d.name, locale) : "–"}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </Card>
  );
}

/** /me (M24 §4.1): today's workout and meals in one card, linking to /me/plans. Hidden without a live plan. */
export function TodayPlans() {
  const t = useTranslations("gp.plan");
  const locale = useLocale();
  const { plans } = useMyPlans();
  const today = plans.data?.today;
  const live = plans.data ? todayFirst(plans.data.items).filter((i) => !i.readOnly && i.todayIndex !== null) : [];
  if (!today || !live.length) return null;
  return (
    <Card className="mt-4 flex flex-col gap-3" data-testid="me-today-plans">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">{t("todayTitle")}</h2>
        <ButtonLink href="/me/plans" size="sm" variant="secondary">
          {t("open")}
        </ButtonLink>
      </div>
      <ul className="flex flex-col gap-2">
        {live.map((it) => {
          const groups = groupsOn(it, today) ?? [];
          const refs = groups.flatMap((g) => g.refs);
          const p = progressOn(refs, latestTicks(it.ticks), today);
          const Icon = it.kind === "workout" ? Barbell : ForkKnife;
          return (
            <li key={it.assignmentId} className="flex items-center gap-3">
              <Icon size={20} className="shrink-0 text-brand-text" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{it.kind === "workout" ? groups.map((g) => textOf(g.name, locale)).join(", ") || it.title : it.title}</span>
                <span className="block text-xs text-muted">{it.gym?.name ?? ""}</span>
              </span>
              <span className="text-sm font-semibold tabular-nums">{t("progress", { done: p.done, total: p.total })}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/**
 * /me/plans/[assignmentId] (M24 §4.1): one plan in full, every day or meal, the versions the gym gave
 * me (newest first) and my ticks. Read-only once it ended, was replaced, or I left the gym (M24-FR-67).
 */
export function MyPlanDetail({ assignmentId }: { assignmentId: string }) {
  const t = useTranslations("gp.plan");
  const locale = useLocale();
  const f = useFmt();
  const err = useGymError();
  const { status } = useAuth();
  const q = useQuery({ queryKey: ["my-gym-plan", assignmentId], queryFn: () => gymMe.plan(assignmentId), enabled: status === "signed_in", retry: false });
  const [version, setVersion] = useState<number | null>(null);
  if (status === "signed_out") return <SignedOutCard signInHref={`/sign-in?next=/me/plans/${assignmentId}`} />;
  const p = q.data;
  const shown = p ? (p.versions.find((v) => v.version === (version ?? p.version))?.content ?? p.content) : null;
  return (
    <section className="mx-auto w-full max-w-[960px] px-4 py-6 sm:px-6 md:py-10" data-testid="me-plan">
      <Link href="/me/plans" className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-brand-text hover:underline">
        <ArrowLeft size={16} aria-hidden /> {t("title")}
      </Link>
      {q.isPending ? (
        <Skeleton className="mt-4 h-80 rounded-card" />
      ) : q.isError || !p || !shown ? (
        <Notice tone="error" className="mt-4">
          {err(q.error)}
        </Notice>
      ) : (
        <div className="mt-2 flex flex-col gap-5">
          <div>
            <h1 className="font-display text-3xl font-extrabold">{p.title}</h1>
            <p className="mt-1 text-sm text-muted">
              {p.gym?.name ?? ""} · {t(`kind.${p.kind}`)} · {t("from", { date: f.date(p.startsOn) })}
              {p.endsOn ? ` · ${t("until", { date: f.date(p.endsOn) })}` : ""}
            </p>
            {p.readOnly ? (
              <Notice tone="info" className="mt-3">
                {t("readOnly")}
              </Notice>
            ) : null}
          </div>
          <Safety text={p.safety} />
          {p.versions.length > 1 ? (
            <SegmentedControl label={t("versions")} value={String(version ?? p.version)} onChange={(v) => setVersion(Number(v))} options={p.versions.map((v) => ({ value: String(v.version), label: t("versionOn", { n: v.version, date: f.short(v.createdAt) }) }))} />
          ) : null}
          {shown.kind === "workout" ? (
            shown.days.map((d, i) => (
              <Card key={d.key} className="flex flex-col gap-2">
                <h2 className="font-display text-lg font-bold">
                  {t("dayN", { n: i + 1 })} · {textOf(d.name, locale)}
                  {!p.readOnly && p.todayIndex === i ? (
                    <Badge tone="brand" className="ml-2">
                      {t("today")}
                    </Badge>
                  ) : null}
                </h2>
                {d.items.length ? (
                  <ul className="flex flex-col divide-y divide-line">
                    {d.items.map((x) => (
                      <li key={x.ref} className="py-2">
                        <ItemFacts content={shown} itemRef={x.ref} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">{t("restDay")}</p>
                )}
              </Card>
            ))
          ) : (
            <>
              {shown.meals.map((m) => (
                <Card key={m.ref} className="flex flex-col gap-2">
                  <h2 className="flex items-baseline gap-2 font-display text-lg font-bold">
                    {textOf(m.name, locale)}
                    {m.time ? <span className="text-sm font-normal text-muted tabular-nums">{m.time}</span> : null}
                  </h2>
                  <ul className="flex flex-col divide-y divide-line">
                    {m.items.map((x) => (
                      <li key={x.ref} className="py-2">
                        <ItemFacts content={shown} itemRef={x.ref} />
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
              {shown.notes ? <Notice tone="info">{textOf(shown.notes, locale)}</Notice> : null}
            </>
          )}
          <div>
            <h2 className="font-display text-lg font-bold">{t("history")}</h2>
            {p.logs.length ? (
              <ul className="mt-2 flex flex-col divide-y divide-line rounded-control border border-line" data-testid="plan-history">
                {p.logs.slice(0, 60).map((l) => (
                  <li key={l.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 p-3 text-sm">
                    <span className="w-24 shrink-0 tabular-nums text-muted">{f.short(l.localDate)}</span>
                    <span className="min-w-0 flex-1">
                      <ItemName content={p.content} itemRef={l.itemRef} versions={p.versions.map((v) => v.content)} />
                      {l.note ? <span className="block text-muted">{l.note}</span> : null}
                    </span>
                    <Badge tone={l.done ? "brand" : "neutral"}>{l.done ? t("done") : t("notDone")}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-muted">{t("noHistory")}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** An item's name from the current version, or an older one when the gym took it out since. */
function ItemName({ content, itemRef, versions }: { content: PlanContent; itemRef: string; versions: PlanContent[] }) {
  const locale = useLocale();
  for (const c of [content, ...versions]) {
    const items = c.kind === "workout" ? c.days.flatMap((d) => d.items) : c.meals.flatMap((m) => m.items);
    const x = items.find((i) => i.ref === itemRef);
    if (x) return <span className="block font-semibold">{textOf(x.name, locale)}</span>;
  }
  return <span className="block font-semibold">{itemRef}</span>;
}

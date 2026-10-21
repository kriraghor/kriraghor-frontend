"use client";

import type { ReactNode } from "react";
import { CaretRight, CheckCircle, Circle } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { isExternal } from "@kriraghor/session/links";
import { Link } from "../i18n/navigation";
import { cn } from "../cn";
import { Card } from "./Display";

export type ChecklistStep = {
  key: string;
  label: ReactNode;
  done: boolean;
  /** Where the step is fixed: an app route, a "#anchor" on this page, or another site. */
  href?: string | null;
  /** Or an action on this page (a dialog), used instead of `href`. */
  onSelect?: () => void;
  /** One line under the label (why it matters). */
  hint?: ReactNode;
};

const row = "flex min-h-11 w-full items-center gap-3 rounded-control px-2 py-2 text-left";
const todoRow = cn(row, "font-semibold text-ink no-underline transition-colors hover:bg-surface-2 focus-visible:bg-surface-2");

/**
 * A profile checklist (Round B1): a score bar and the steps, done or to do; each step to do links to
 * where it is fixed. Hidden once every step is done (score 100), unless `keepWhenComplete`.
 */
export function ChecklistCard({ title, description, score, steps, keepWhenComplete = false, className, testId = "checklist" }: { title: ReactNode; description?: ReactNode; score: number; steps: ChecklistStep[]; keepWhenComplete?: boolean; className?: string; testId?: string }) {
  const t = useTranslations("kit.checklist");
  const done = steps.filter((s) => s.done).length;
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  if (pct >= 100 && !keepWhenComplete) return null;
  const titleId = `${testId}-title`;
  return (
    <Card className={cn("flex flex-col gap-4", className)} data-testid={testId} aria-labelledby={titleId} role="region">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={titleId} className="text-lg font-bold">
          {title}
        </h2>
        <p className="text-sm font-semibold tabular-nums text-muted">{t("progress", { done, total: steps.length })}</p>
      </div>
      {description ? <p className="-mt-2 text-sm text-muted">{description}</p> : null}
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={t("score", { score: pct })} aria-labelledby={titleId} className="h-2 w-full overflow-hidden rounded-pill bg-surface-2" data-testid={`${testId}-bar`}>
        <span className="block h-full rounded-pill bg-brand transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <ul className="flex flex-col gap-1">
        {steps.map((s) => (
          <li key={s.key} data-testid={`${testId}-step-${s.key}`} data-done={s.done ? "true" : "false"}>
            <Step step={s} doneLabel={t("done")} todoLabel={t("todo")} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Step({ step, doneLabel, todoLabel }: { step: ChecklistStep; doneLabel: string; todoLabel: string }) {
  const body = (
    <>
      {step.done ? <CheckCircle size={22} weight="fill" aria-hidden className="shrink-0 text-brand" /> : <Circle size={22} aria-hidden className="shrink-0 text-muted" />}
      <span className="min-w-0 flex-1">
        <span className={cn("block", step.done && "text-muted line-through decoration-1")}>{step.label}</span>
        {step.hint && !step.done ? <span className="block text-sm font-normal text-muted">{step.hint}</span> : null}
        <span className="sr-only">{step.done ? doneLabel : todoLabel}</span>
      </span>
      {step.done ? null : <CaretRight size={18} aria-hidden className="shrink-0 text-muted" />}
    </>
  );
  if (step.done) return <div className={row}>{body}</div>;
  if (step.onSelect)
    return (
      <button type="button" className={todoRow} onClick={step.onSelect}>
        {body}
      </button>
    );
  if (!step.href) return <div className={row}>{body}</div>;
  if (step.href.startsWith("#") || isExternal(step.href))
    return (
      <a href={step.href} className={todoRow}>
        {body}
      </a>
    );
  return (
    <Link href={step.href} className={todoRow}>
      {body}
    </Link>
  );
}

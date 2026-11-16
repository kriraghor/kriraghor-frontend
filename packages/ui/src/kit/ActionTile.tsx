"use client";

import type { ReactNode } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { isExternal } from "@kriraghor/session/links";
import { Link } from "../i18n/navigation";
import { cn } from "../cn";
import { badgeText } from "../shell-parts";

/**
 * A big link to start a task (UI v2, the panels' start-here homes): an icon in a soft square, what it
 * does, one line on when to use it, and a count when something is waiting there. `tone="accent"` is the
 * one task the page wants done first.
 */
export function ActionTile({
  href,
  icon,
  title,
  hint,
  count,
  tone = "brand",
  testId,
  className,
}: {
  href: string;
  icon: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  count?: number;
  tone?: "brand" | "accent";
  testId?: string;
  className?: string;
}) {
  const badge = badgeText(count);
  const cls = cn(
    "group surface-card flex min-h-[88px] items-start gap-3 p-4 no-underline transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-kg)]",
    "hover:-translate-y-0.5 hover:border-line-strong/50 hover:shadow-md focus-visible:-translate-y-0.5 motion-reduce:transform-none",
    tone === "accent" && "border-accent/40 bg-accent-soft/40",
    className,
  );
  const body = (
    <>
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-control [&>svg]:size-6", tone === "accent" ? "bg-accent text-on-accent" : "bg-brand-soft text-brand-text")}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-semibold text-ink">
          <span className="min-w-0 truncate">{title}</span>
          {badge ? <span className="tabular rounded-pill bg-accent px-1.5 text-xs font-bold leading-5 text-on-accent">{badge}</span> : null}
        </span>
        {hint ? <span className="mt-0.5 block text-sm text-muted">{hint}</span> : null}
      </span>
      <ArrowRight size={18} aria-hidden className="mt-1 shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none" />
    </>
  );
  if (isExternal(href))
    return (
      <a href={href} className={cls} data-testid={testId}>
        {body}
      </a>
    );
  return (
    <Link href={href} className={cls} data-testid={testId}>
      {body}
    </Link>
  );
}

/** A grid of ActionTiles: one column on phones, two from tablets, three on wide screens. */
export function ActionGrid({ children, className, testId }: { children: ReactNode; className?: string; testId?: string }) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", className)} data-testid={testId}>
      {children}
    </div>
  );
}

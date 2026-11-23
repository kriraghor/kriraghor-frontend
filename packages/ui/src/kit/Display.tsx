"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { CheckCircle, Info, WarningCircle, XCircle } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { cn } from "../cn";
import { Button } from "./Button";

/** A card: solid surface, 1px line, the card radius. `interactive` lifts a little on hover (links). */
export function Card({ className, interactive, padded = true, ...rest }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean; padded?: boolean }) {
  return (
    <div
      className={cn(
        "surface-card",
        padded && "p-5 sm:p-6",
        interactive && "transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-kg)] hover:-translate-y-0.5 hover:border-line-strong/50 hover:shadow-md",
        className,
      )}
      {...rest}
    />
  );
}

export type Tone = "neutral" | "brand" | "prize" | "danger" | "info" | "warning" | "live";

const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink",
  brand: "bg-brand-soft text-brand-text",
  prize: "bg-prize-soft text-prize-text",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  live: "bg-live text-white",
};

/** A small status pill. Colour never carries the meaning alone: the text says it. */
export function Badge({ tone = "neutral", icon, className, children }: { tone?: Tone; icon?: ReactNode; className?: string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2.5 py-0.5 text-xs font-semibold", toneClass[tone], className)}>{icon}{children}</span>;
}

/** A filter chip (aria-pressed): full round, 44px tall so it is easy to tap. */
export function Chip({ active, className, children, count, ...rest }: HTMLAttributes<HTMLButtonElement> & { active?: boolean; count?: number; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-pill border px-4 text-sm font-semibold transition-colors duration-150",
        active ? "border-brand bg-brand-soft text-brand-text" : "border-line bg-surface text-ink hover:border-line-strong",
        className,
      )}
      {...rest}
    >
      {children}
      {count !== undefined ? <span className={cn("tabular text-xs", active ? "text-brand-text" : "text-muted")}>{count}</span> : null}
    </button>
  );
}

/**
 * Initials on brand green, or the picture. Decorative by default; with `alt` (a person's name) the
 * picture, or the initials, is announced as that person's photo.
 */
export function Avatar({ name, src, size = 40, alt, className }: { name: string; src?: string | null; size?: number; alt?: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const label = alt?.trim() || undefined;
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-pill bg-brand-soft font-display font-bold text-brand-text", className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      {...(label ? (src ? {} : { role: "img", "aria-label": label }) : { "aria-hidden": true })}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- user pictures come from many hosts */}
      {src ? <img src={src} alt={label ?? ""} width={size} height={size} className="size-full object-cover" /> : label ? <span aria-hidden>{initials || "?"}</span> : initials || "?"}
    </span>
  );
}

/** A loading placeholder in the shape of what is coming, with a soft light sweeping across (still under reduce motion). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("kg-shimmer rounded-control bg-surface-2", className)} aria-hidden />;
}

/** A list of skeleton rows, announced once as loading. */
export function SkeletonList({ rows = 3, className, label }: { rows?: number; className?: string; label?: string }) {
  const t = useTranslations("kit");
  return (
    <div role="status" aria-label={label ?? t("loading")} className={cn("flex flex-col gap-3", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-20 rounded-card" />
      ))}
    </div>
  );
}

/** Nothing here yet: an icon, one line on why, and the way to fill it. */
export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: ReactNode; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong/50 px-6 py-10 text-center", className)}>
      {icon ? <span className="flex size-14 items-center justify-center rounded-card bg-accent-soft text-accent-text [&>svg]:size-7">{icon}</span> : null}
      <p className="font-display text-xl font-bold">{title}</p>
      {body ? <p className="max-w-[46ch] text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/** Something failed: what happened and a retry. */
export function ErrorState({ title, body, onRetry, className }: { title?: ReactNode; body?: ReactNode; onRetry?: () => void; className?: string }) {
  const t = useTranslations("kit");
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 rounded-card border border-danger/30 bg-danger-soft/40 px-6 py-10 text-center", className)}>
      <span className="flex size-12 items-center justify-center rounded-pill bg-danger-soft text-danger">
        <WarningCircle size={24} aria-hidden />
      </span>
      <p className="font-display text-lg font-semibold">{title ?? t("errorTitle")}</p>
      <p className="max-w-[46ch] text-sm text-muted">{body ?? t("errorBody")}</p>
      {onRetry ? (
        <Button type="button" variant="secondary" onClick={onRetry}>
          {t("retry")}
        </Button>
      ) : null}
    </div>
  );
}

const noticeIcon = { info: Info, error: XCircle, success: CheckCircle, warning: WarningCircle } as const;
const noticeTone = {
  info: "border-info/25 bg-info-soft text-ink [&>svg]:text-info",
  error: "border-danger/25 bg-danger-soft text-ink [&>svg]:text-danger",
  success: "border-brand/25 bg-brand-soft text-ink [&>svg]:text-brand-text",
  warning: "border-warning/25 bg-warning-soft text-ink [&>svg]:text-warning",
} as const;

/** An inline message with an icon; errors are announced as alerts. */
export function Notice({ tone = "info", title, children, action, className }: { tone?: keyof typeof noticeIcon; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  const Icon = noticeIcon[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-control border px-4 py-3 text-sm", noticeTone[tone], className)}>
      <Icon size={20} weight="fill" aria-hidden className="mt-px shrink-0" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5 text-muted" : undefined}>{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

/** A page title block: optional eyebrow and back link above, actions on the right. */
export function PageTitle({ title, eyebrow, description, actions, back, className }: { title: ReactNode; eyebrow?: ReactNode; description?: ReactNode; actions?: ReactNode; back?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {back ? <div className="mb-3">{back}</div> : null}
        {eyebrow ? <p className="mb-1 text-sm font-semibold text-brand-text">{eyebrow}</p> : null}
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-[60ch] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * A section's heading (UI v2): the slanted orange mark taken from the logo's K, the title in the heading
 * face, and an optional action on the right ("See all"). The mark is decoration only.
 */
export function SectionHeading({ title, action, id, as: Tag = "h2", size, className }: { title: ReactNode; action?: ReactNode; id?: string; as?: "h2" | "h3"; /** "display": the public sites' bigger section titles. */ size?: "display"; className?: string }) {
  const big = size === "display";
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-1", className)}>
      <Tag id={id} className={cn("flex items-center gap-2.5 font-display font-bold", big ? "gap-3 text-2xl font-extrabold md:text-3xl" : Tag === "h2" ? "text-xl" : "text-lg")}>
        <span aria-hidden className={cn("inline-block shrink-0 -skew-x-[18deg] rounded-[2px] bg-accent", big ? "h-6 w-2 md:h-7" : Tag === "h2" ? "h-5 w-[7px]" : "h-4 w-1.5")} />
        {title}
      </Tag>
      {action}
    </div>
  );
}

/** A horizontal rule with a word in the middle ("or"). */
export function Divider({ children, className }: { children?: ReactNode; className?: string }) {
  if (!children) return <hr className={cn("border-line", className)} />;
  return (
    <div className={cn("flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-muted", className)} role="separator">
      <span className="h-px flex-1 bg-line" />
      {children}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** A metric: label, big number, optional hint. Money in prize amber when `tone="prize"`. */
export function Stat({ label, value, hint, icon, tone = "neutral", className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: "neutral" | "prize" | "brand"; className?: string }) {
  return (
    <Card className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2 text-sm font-semibold text-muted">
        <span>{label}</span>
        {icon ? <span className="[&>svg]:size-5">{icon}</span> : null}
      </div>
      <p className={cn("font-display text-3xl font-bold tabular", tone === "prize" && "text-prize-text", tone === "brand" && "text-brand-text")}>{value}</p>
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
    </Card>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { countdown, fill, pad, takaOf, dhakaTime, type Money, type TournamentCard } from "@/lib/esports";

/** Small shared pieces for the esports pages (UI v2: the shape rule; the orange accent marks prize money and the one action to start). */

export function Chip({ tone = "muted", children }: { tone?: "ok" | "warn" | "bad" | "muted" | "live"; children: ReactNode }) {
  const cls = {
    ok: "border-brand/40 text-brand-text bg-brand-soft",
    warn: "border-warning/50 text-warning bg-warning-soft",
    bad: "border-danger/50 text-danger bg-danger-soft",
    muted: "border-line text-muted",
    live: "border-live bg-live text-white",
  }[tone];
  return (
    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-pill border px-2.5 text-xs font-bold uppercase tracking-wide ${cls}`}>
      {tone === "live" ? <span className="kg-pulse size-1.5 rounded-pill bg-white" aria-hidden /> : null}
      {children}
    </span>
  );
}

/** Prize money in the accent (the logo's orange in UI v2). */
export function Prize({ money, className = "" }: { money: Money | null | undefined; className?: string }) {
  const locale = useLocale();
  return <span className={`font-display font-extrabold tabular-nums text-accent-text ${className}`}>{takaOf(money, locale)}</span>;
}

export function SlotsBar({ taken, max }: { taken: number; max: number }) {
  const t = useTranslations("esports");
  const pct = fill(taken, max);
  return (
    <div>
      <div className="flex justify-between text-xs font-semibold text-muted">
        <span>{t("slots", { taken, max })}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-pill bg-surface-2" role="progressbar" aria-valuenow={taken} aria-valuemin={0} aria-valuemax={max} aria-label={t("slots", { taken, max })}>
        <div className={`h-2 origin-left rounded-pill transition-[width] duration-500 ease-[var(--ease-kg)] ${pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-accent" : "bg-brand"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** A live countdown (re-renders each second while mounted). */
export function Countdown({ to, done }: { to: string; done?: ReactNode }) {
  const t = useTranslations("esports");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const c = countdown(to, now);
  if (c.total === 0) return <>{done ?? null}</>;
  return (
    <span className="font-display tabular-nums" aria-live="off">
      {c.d > 0 ? `${t("days", { n: c.d })} ` : ""}
      {pad(c.h)}:{pad(c.m)}:{pad(c.s)}
    </span>
  );
}

const STATUS_TONE: Record<string, "ok" | "warn" | "bad" | "muted" | "live"> = {
  scheduled: "muted",
  registration_open: "ok",
  registration_closed: "warn",
  check_in: "warn",
  live: "live",
  results_pending: "warn",
  finalised: "muted",
  paid_out: "muted",
  cancelled: "bad",
};
export function StatusChip({ status }: { status: string }) {
  const t = useTranslations("esports.status");
  return <Chip tone={STATUS_TONE[status] ?? "muted"}>{t.has(status) ? t(status) : status}</Chip>;
}

export function Card({ t: item }: { t: TournamentCard }) {
  const t = useTranslations("esports");
  const locale = useLocale();
  const title = locale === "bn" ? item.titleBn : item.titleEn;
  return (
    <Link href={`/events/${item.slug}`} className="rv group flex flex-col surface-card p-5 transition-colors hover:border-line-strong focus-visible:border-brand" data-testid="tournament-card">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-muted">{locale === "bn" ? item.game?.nameBn : item.game?.nameEn}</span>
        <span className="text-xs text-muted">·</span>
        <span className="text-xs font-semibold text-muted">{locale === "bn" ? item.mode?.nameBn : item.mode?.nameEn}</span>
        <span className="ml-auto">
          <StatusChip status={item.status} />
        </span>
      </div>
      <h3 className="mt-3 text-lg font-extrabold leading-snug group-hover:underline">{title}</h3>
      {item.organiser ? <p className="mt-1 text-xs font-semibold text-muted" data-testid="card-organiser">{t("organiser.by", { name: item.organiser.name })}</p> : null}
      <p className="mt-1 text-sm text-muted">{dhakaTime(item.startsAt, locale)}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t("prizePool")}</dt>
          <dd>
            <Prize money={item.prizePool} className="text-xl" />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t("entryFee")}</dt>
          <dd className="text-xl font-extrabold tabular-nums">{item.entryFee.amount === 0 ? t("free") : takaOf(item.entryFee, locale)}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <SlotsBar taken={item.slotsTaken} max={item.maxSlots} />
      </div>
    </Link>
  );
}

export function CardSkeleton() {
  return <div className="kg-shimmer h-64 rounded-card border border-line bg-surface-2" aria-hidden />;
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line-strong/60 px-6 py-10 text-center">
      <p className="font-display text-lg font-bold">{title}</p>
      {body ? <p className="mx-auto mt-2 max-w-[48ch] text-muted">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LinkButton({ href, children, tone = "brand", testId }: { href: string; children: ReactNode; tone?: "brand" | "outline" | "prize"; testId?: string }) {
  const cls = {
    brand: "bg-brand text-on-brand hover:bg-brand-hover",
    outline: "border border-line-strong hover:bg-surface-2",
    prize: "bg-accent text-on-accent shadow-[0_10px_28px_-12px_var(--kg-accent)] hover:bg-accent-hover",
  }[tone];
  return (
    <Link href={href} className={`inline-flex min-h-12 items-center justify-center rounded-control px-5 font-bold transition-[background-color,transform] active:scale-[0.98] ${cls}`} data-testid={testId}>
      {children}
    </Link>
  );
}

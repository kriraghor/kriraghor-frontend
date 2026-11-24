"use client";

import type { ComponentType } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CaretRight, CheckCircle, CurrencyCircleDollar, Flag, GameController, Gavel, Lightning, ListChecks, ShieldWarning, SlidersHorizontal, Trophy, WarningCircle, type IconProps } from "@phosphor-icons/react";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { count } from "@kriraghor/ui/charts";
import { Badge, Card } from "@kriraghor/ui/kit";
import type { ActionItem } from "@/lib/dashboard";
import { queueCards, type StaffQueue } from "@/lib/admin/queues";

const ICONS: Record<StaffQueue, ComponentType<IconProps>> = {
  disputes_escalated: Gavel,
  disputes_to_review: Gavel,
  reports_escalated: Flag,
  reports_open: Flag,
  payouts_failed: CurrencyCircleDollar,
  payouts_to_approve: CurrencyCircleDollar,
  review_queue: ShieldWarning,
  risk_flags: Lightning,
  settings_to_approve: SlidersHorizontal,
  results_to_enter: GameController,
  tournaments_to_review: Trophy,
};

/**
 * "Needs your action" on the admin home (M19-FR-29, dashboards round 3): one card per queue the
 * signed-in staff member works, with its count, what it is, "Urgent" (icon and word, never colour
 * alone) when something in it is past its time limit, and the earliest time limit. Each card opens
 * its desk. An empty list is the "all clear" card.
 */
export function StaffQueues({ items }: { items: readonly ActionItem[] }) {
  const t = useTranslations("admin.queues");
  const ta = useTranslations("admin");
  const td = useTranslations("dashboard.actions");
  const locale = useLocale();
  const cards = queueCards(items);
  if (!cards.length) {
    return (
      <Card className="flex items-center gap-3" data-testid="admin-all-clear">
        <CheckCircle size={28} weight="fill" aria-hidden className="shrink-0 text-brand" />
        <div>
          <p className="font-semibold">{ta("clearTitle")}</p>
          <p className="text-sm text-muted">{ta("clearBody")}</p>
        </div>
      </Card>
    );
  }
  const due = (iso: string) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" }).format(new Date(iso));
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="staff-queues">
      {cards.map((c) => {
        const Icon = c.known ? ICONS[c.key as StaffQueue] : ListChecks;
        return (
          <li key={`${c.key}-${c.href}`}>
            <Link
              href={c.href}
              className={`group flex h-full min-h-32 flex-col gap-2 rounded-card border bg-surface p-3 no-underline transition-colors hover:bg-surface-2 sm:p-4 ${c.urgent ? "border-danger/50" : "border-line"}`}
              data-testid={`queue-${c.key}`}
              data-urgent={c.urgent || undefined}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-soft text-brand-text">
                  <Icon size={18} aria-hidden />
                </span>
                {c.urgent ? (
                  <Badge tone="danger" icon={<WarningCircle size={14} weight="fill" aria-hidden />}>
                    {td("urgent")}
                  </Badge>
                ) : null}
              </span>
              <span className="font-display text-3xl font-bold leading-none tabular-nums text-ink">{count(c.count, locale)}</span>
              <span className="font-semibold leading-snug text-ink">{c.known ? t(c.key) : td("other", { n: c.count })}</span>
              <span className="mt-auto flex items-center justify-between gap-2 text-xs text-muted">
                <span>{c.dueAt ? td("due", { time: due(c.dueAt) }) : t("open")}</span>
                <CaretRight size={16} aria-hidden className="shrink-0 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

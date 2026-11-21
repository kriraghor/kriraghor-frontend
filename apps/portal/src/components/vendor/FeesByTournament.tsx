"use client";

import { useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { ChartCard, type ChartTable, type LegendItem } from "@kriraghor/ui/charts";
import { cn } from "@kriraghor/ui/kit";
import { FEE_PARTS, feeSplit, type FeePart } from "@/lib/vendor/analytics";
import { useFmt } from "./chart-parts";

type Row = { tournamentId: string; name: string; status: string; collected: number; held: number; released: number; refunded: number };

const COLOR: Record<FeePart, string> = { held: "var(--viz-1)", released: "var(--viz-2)", refunded: "var(--viz-3)", fee: "var(--viz-4)" };

/**
 * Entry fees by tournament (all time, round 2): one horizontal bar per tournament, its length the
 * fees collected (the figure at its end), split into where that money is now: held by Kriraghor,
 * released to the organiser, refunded to teams and the Kriraghor fee (lib feeSplit). Biggest first;
 * each row opens the tournament. The Table view lists every part.
 */
export function FeesByTournament({ items, eventsHref }: { items: Row[]; eventsHref: string }) {
  const t = useTranslations("dashboard");
  const ts = useTranslations("sportsConsole");
  const f = useFmt();
  const rows = items.map((e) => ({ ...e, split: feeSplit(e) })).sort((a, b) => b.split.total - a.split.total || a.name.localeCompare(b.name));
  const max = Math.max(1, ...rows.map((r) => r.split.total));
  const label = (k: FeePart) => t(`fees.${k}`);
  const legend: LegendItem[] = FEE_PARTS.map((k) => ({ label: label(k), color: COLOR[k], kind: "rect" }));
  const table: ChartTable = {
    columns: [t("fees.tournament"), t("fees.collected"), ...FEE_PARTS.map(label)],
    rows: rows.map((r) => [r.name, f.money(r.collected), ...r.split.parts.map((p) => f.money(p.value))]),
  };
  const status = (s: string) => (ts.has(`status.${s}`) ? ts(`status.${s}`) : null);
  return (
    <ChartCard title={t("charts.feesByEvent")} subtitle={t("charts.feesByEventSub")} legend={legend} table={table} state={rows.some((r) => r.split.total > 0) ? "ready" : "empty"} emptyText={t("empty")} height={120} testId="fees-by-event">
      <ol className="space-y-3">
        {rows.map((r) => {
          const parts = r.split.parts.filter((p) => p.value > 0);
          const said = parts.map((p) => `${label(p.key)} ${f.money(p.value)}`).join(", ");
          return (
            <li key={r.tournamentId}>
              <Link href={`${eventsHref}/e/${r.tournamentId}`} className="block rounded-[6px] no-underline outline-offset-2 hover:opacity-85" aria-label={`${r.name}: ${t("fees.collected")} ${f.money(r.collected)}. ${said}`}>
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink">
                    {r.name}
                    {status(r.status) ? <span className="ml-2 text-xs text-muted">{status(r.status)}</span> : null}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-ink">{f.money(r.collected)}</span>
                </span>
                <span className="mt-1 flex h-2.5 overflow-hidden rounded-r-[4px] bg-[var(--viz-track)]" aria-hidden>
                  <span className="viz-grow-x flex h-full gap-px" style={{ width: `${r.split.total > 0 ? Math.max(1, (r.split.total / max) * 100) : 0}%` }}>
                    {parts.map((p, i) => (
                      <span key={p.key} className={cn("h-full", i === parts.length - 1 && "rounded-r-[4px]")} style={{ width: `${(p.value / r.split.total) * 100}%`, background: COLOR[p.key] }} title={`${label(p.key)}: ${f.money(p.value)}`} />
                    ))}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </ChartCard>
  );
}

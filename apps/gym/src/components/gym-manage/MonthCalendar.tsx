"use client";

import { useTranslations } from "next-intl";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { IconButton } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { dhakaToday, monthGrid, monthOf, shiftMonth } from "@/lib/gym-manage";
import { useFmt } from "./common";

/** A month of check-ins, Saturday first; the days the member came are filled. Used by the profile and the member area. */
export function MonthCalendar({ month, days, onMonth, count, testId = "checkin-calendar" }: { month: string; days: readonly string[]; onMonth: (m: string) => void; count: number; testId?: string }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const today = dhakaToday();
  const weeks = monthGrid(month, days);
  const dow = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"] as const;
  return (
    <div data-testid={testId}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <IconButton label={t("cal.prev")} variant="secondary" onClick={() => onMonth(shiftMonth(month, -1))}>
          <CaretLeft size={16} aria-hidden />
        </IconButton>
        <p className="text-sm font-semibold">
          {f.month(month)} · {t("cal.count", { n: count })}
        </p>
        <IconButton label={t("cal.next")} variant="secondary" onClick={() => onMonth(shiftMonth(month, 1))} disabled={month >= monthOf(today)}>
          <CaretRight size={16} aria-hidden />
        </IconButton>
      </div>
      <table className="w-full table-fixed text-center text-xs">
        <thead>
          <tr>
            {dow.map((d) => (
              <th key={d} className="pb-1 font-semibold text-muted">
                {t(`cal.dow.${d}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((w, i) => (
            <tr key={i}>
              {w.map((c, j) => (
                <td key={j} className="p-0.5">
                  {c ? (
                    <span
                      className={cn("mx-auto grid size-8 place-items-center rounded-full tabular-nums", c.came ? "bg-brand font-bold text-on-brand" : "text-ink", c.date === today && !c.came && "ring-2 ring-brand/50")}
                      aria-label={c.came ? t("cal.came", { date: f.date(c.date) }) : undefined}
                    >
                      {f.n(c.day)}
                    </span>
                  ) : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

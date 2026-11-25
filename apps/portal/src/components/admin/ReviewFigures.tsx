"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@kriraghor/ui/i18n/navigation";
import { BarChart, DeltaBadge, KpiTile, RankBars, count } from "@kriraghor/ui/charts";
import { Badge, DataTable, Notice, SectionHeading, SegmentedControl, Skeleton } from "@kriraghor/ui/kit";
import { dayLabel, dhakaToday, pct } from "@/lib/dashboard";
import { decisionSeries, formatDuration, reviewFigures, weekdayName, type ReviewFigures as Data, type ReviewScope } from "@/lib/admin/reviews";
import { AsOf, todayIndex, useFmt } from "../vendor/chart-parts";

const OUTCOME_TONE = { approved: "brand", changes_requested: "warning", rejected: "danger" } as const;

/**
 * "Your reviews" on the admin home (M19 §6.4, FR-33) for masters and reviewers: the queue, reviewed
 * today against the same weekday last week, the median time to a decision, the approval rate, the
 * decisions per day, why we said no, and (for "me") my latest decisions. "Me" or "Team" lives in
 * the URL (?reviews=).
 */
export function ReviewFigures({ scope, onScope }: { scope: ReviewScope; onScope: (s: ReviewScope) => void }) {
  const t = useTranslations("admin.reviews");
  const td = useTranslations("dashboard");
  const tk = useTranslations("moderation.kind");
  const locale = useLocale();
  const f = useFmt();
  const router = useRouter();
  const q = useQuery({ queryKey: ["review-figures", scope, locale], placeholderData: keepPreviousData, queryFn: () => reviewFigures(scope, locale) });
  const d = q.data;
  const unit = (u: "d" | "h" | "m", n: number) => t(`unit.${u}`, { n: count(n, locale) });
  const duration = (min: number | null | undefined) => formatDuration(min, unit) ?? "–";
  const today = dhakaToday();
  const lastWeekday = weekdayName(today, locale);

  return (
    <section className="flex flex-col gap-4" data-testid="review-figures" aria-busy={q.isFetching || undefined}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionHeading title={t("title")} />
          <div className="-mt-1 flex flex-wrap gap-x-2 text-xs text-muted">
            {d ? <span>{t("window", { n: count(d.window.days, locale) })}</span> : null}
            <AsOf iso={d?.asOf} />
          </div>
        </div>
        <SegmentedControl
          size="sm"
          label={t("scopeLabel")}
          value={scope}
          onChange={onScope}
          options={[
            { value: "me", label: t("scope.me"), testId: "reviews-me" },
            { value: "team", label: t("scope.team"), testId: "reviews-team" },
          ]}
        />
      </div>

      {q.isPending ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="reviews-loading">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-card" />
          ))}
        </div>
      ) : q.isError || !d ? (
        <Notice tone="error">{td("loadFailed")}</Notice>
      ) : (
        body(d)
      )}
    </section>
  );

  function body(d: Data) {
    const s = decisionSeries(d.perDay);
    const overdue = d.tiles.waiting.note.overdue;
    return (
      <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile
            testId="tile-review-waiting"
            label={t("tiles.waiting")}
            help={d.definitions.review_waiting}
            value={f.n(d.tiles.waiting.value)}
            note={td("notes.overdue", { n: count(overdue, locale) })}
            tone={overdue > 0 ? "warning" : undefined}
          />
          <KpiTile
            testId="tile-reviewed-today"
            label={t("tiles.reviewedToday")}
            help={d.definitions.reviewed_today}
            value={f.n(d.tiles.reviewedToday.value)}
            delta={<DeltaBadge value={d.tiles.reviewedToday.delta} kind="pct" label={t("vsLastWeekday", { day: lastWeekday })} locale={locale} />}
            note={t("lastWeekday", { n: count(d.tiles.reviewedToday.note.lastWeek, locale), day: lastWeekday })}
          />
          <KpiTile
            testId="tile-median"
            label={t("tiles.median")}
            help={d.definitions.median_decision}
            value={duration(d.tiles.medianMinutes.value)}
            delta={<DeltaBadge value={d.tiles.medianMinutes.delta} kind="pct" label={t("vsBefore", { n: count(d.window.days, locale) })} better="down" locale={locale} />}
          />
          <KpiTile
            testId="tile-approval"
            label={t("tiles.approval")}
            help={d.definitions.approval_rate}
            value={pct(d.tiles.approvalRate.value, locale)}
            delta={<DeltaBadge value={d.tiles.approvalRate.delta} kind="pts" label={t("vsBefore", { n: count(d.window.days, locale) })} better="neither" locale={locale} />}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <BarChart
            className="lg:col-span-2"
            title={t("charts.perDay")}
            subtitle={t("window", { n: count(d.window.days, locale) })}
            labels={s.days.map((day) => dayLabel(day, locale))}
            short={s.days.map((day) => dayLabel(day, locale).split(" ").slice(1).join(" "))}
            series={[
              { key: "approved", label: t("outcome.approved"), values: s.approved },
              { key: "changes", label: t("outcome.changes_requested"), values: s.changes },
              { key: "rejected", label: t("outcome.rejected"), values: s.rejected },
            ]}
            stacked
            highlight={todayIndex(s.days, today)}
            format={f.n}
            axis={f.axisCount}
            integer
            emptyText={t("charts.none")}
            testId="chart-decisions"
          />
          <RankBars
            title={t("charts.whyNo")}
            subtitle={t("window", { n: count(d.window.days, locale) })}
            items={d.whyNo.map((r) => ({ key: r.code, label: r.label, value: r.count }))}
            format={f.n}
            emptyText={t("charts.noReasons")}
            testId="chart-why-no"
          />
        </div>

        {scope === "me" ? (
          <div className="flex flex-col gap-2" data-testid="recent-decisions">
            <h3 className="font-semibold">{t("recent.title")}</h3>
            <DataTable
              label={t("recent.title")}
              rows={d.recent}
              rowId={(r) => `${r.submissionId}-${r.decidedAt}`}
              rowTestId="recent-decision"
              onRowClick={(r) => router.push(`/admin/moderation?id=${r.submissionId}`)}
              rowProps={(r) => ({ data: { decision: r.decision } })}
              empty={{ title: t("recent.none") }}
              columns={[
                { id: "kind", header: t("recent.kind"), primary: true, sort: (r) => r.kind, cell: (r) => (tk.has(r.kind) ? tk(r.kind) : r.kind) },
                { id: "outcome", header: t("recent.outcome"), sort: (r) => r.decision, cell: (r) => <Badge tone={OUTCOME_TONE[r.decision]}>{t(`outcome.${r.decision}`)}</Badge> },
                { id: "reason", header: t("recent.reason"), cell: (r) => <span className="text-muted">{r.reason ?? "–"}</span> },
                {
                  id: "when",
                  header: t("recent.when"),
                  align: "end",
                  sort: (r) => r.decidedAt,
                  cell: (r) => <span className="whitespace-nowrap text-muted">{new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" }).format(new Date(r.decidedAt))}</span>,
                },
              ]}
            />
          </div>
        ) : null}
      </>
    );
  }
}

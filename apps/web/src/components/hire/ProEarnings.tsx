"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Wallet } from "@phosphor-icons/react";
import { ChartBars, ChartRank, DeltaBadge, KpiTile } from "@kriraghor/ui/charts";
import { ButtonLink, ErrorState, SegmentedControl, Skeleton } from "@kriraghor/ui/kit";
import { formatTaka } from "@/lib/payments";
import { bucketLabel, compactTaka, hasEarnings, insights, percent, PERIODS, ratingText, replyTime, type Period } from "@/lib/insights";

const DASH = "—";

/**
 * /pro/earnings (M11 §4 Earnings, §9, M19 §6.3 "Pro"; Round B1): what the pro earned in the period
 * (net of the fee, from the ledger) against the period before, what releases soon, jobs, acceptance
 * rate, reply time and rating, earnings by Dhaka week or month, and who hires them. Links to payouts.
 */
export function ProEarnings() {
  const t = useTranslations("hire.earn");
  const locale = useLocale();
  const [period, setPeriod] = useState<Period>("7w");
  const q = useQuery({ queryKey: ["pro-insights", period], queryFn: () => insights.read(period), placeholderData: (prev) => prev });
  const money = (n: number) => formatTaka(n, locale);
  const when = (iso: string) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" }).format(new Date(iso));

  return (
    <div className="flex flex-col gap-6" data-testid="pro-earnings">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label={t("period")}
          value={period}
          onChange={setPeriod}
          options={PERIODS.map((p) => ({ value: p, label: t(`periods.${p}`), testId: `earn-period-${p}` }))}
        />
        <ButtonLink href="/me/payouts" variant="secondary" icon={<Wallet size={18} aria-hidden />} data-testid="earn-payouts">
          {t("payouts")}
        </ButtonLink>
      </div>
      {q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : !q.data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3" role="status" aria-label={t("loading")}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-card" />
          ))}
        </div>
      ) : (
        <Body data={q.data} money={money} when={when} stale={q.isPlaceholderData} />
      )}
    </div>
  );
}

function Body({ data: d, money, when, stale }: { data: Awaited<ReturnType<typeof insights.read>>; money: (n: number) => string; when: (iso: string) => string; stale: boolean }) {
  const t = useTranslations("hire.earn");
  const locale = useLocale();
  const reply = replyTime(d.medianReplyMinutes);
  const accept = percent(d.acceptanceRate, locale);
  const rating = ratingText(d.rating, locale);
  const earned = hasEarnings(d);
  return (
    <div className={`flex flex-col gap-6 transition-opacity ${stale ? "opacity-60" : ""}`} aria-busy={stale || undefined}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiTile
          testId="earn-total"
          label={t(`earned.${d.period}`)}
          value={money(d.earned.total)}
          delta={<DeltaBadge value={d.earned.delta} kind="pct" label={t("vsPrevious")} />}
          note={d.earned.total || d.earned.previous ? null : t("afterFirstJob")}
          spark={earned ? d.buckets.map((b) => b.amount) : null}
        />
        <KpiTile
          testId="earn-releasing"
          label={t("releasing")}
          value={money(d.releasingSoon.net)}
          note={d.releasingSoon.count ? t("releasingNote", { n: d.releasingSoon.count, when: d.releasingSoon.nextAt ? when(d.releasingSoon.nextAt) : DASH }) : t("nothingReleasing")}
        />
        <KpiTile testId="earn-jobs" label={t("jobsDone")} value={String(d.jobs.done)} note={t("upcoming", { n: d.jobs.upcoming })} />
        <KpiTile testId="earn-accept" label={t("acceptance")} value={accept ?? DASH} note={accept ? t("acceptanceNote") : t("afterFirstRequest")} />
        <KpiTile testId="earn-reply" label={t("reply")} value={reply ? t(`replyIn.${reply.unit}`, { n: reply.n }) : DASH} note={reply ? t("replyNote") : t("afterFirstReply")} />
        <KpiTile testId="earn-rating" label={t("rating")} value={rating ?? DASH} note={rating ? t("reviews", { n: d.rating.count }) : t("afterFirstReview")} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div data-testid="earn-chart">
          <ChartBars title={t(d.period === "yr" ? "byMonth" : "byWeek")} bars={d.buckets.map((b) => ({ label: bucketLabel(b, d.period, locale), value: b.amount }))} format={(n) => compactTaka(n, locale)} />
          {earned ? null : <p className="mt-2 text-sm text-muted">{t("noEarnings")}</p>}
        </div>
        <div data-testid="earn-hirers">
          <ChartRank
            title={t("whoHires")}
            items={d.whoHiresYou.map((h) => ({ label: h.key === "individual" ? t("individual") : h.label, value: h.jobs }))}
            format={(n) => t("jobsN", { n })}
            empty={t("noHirers")}
          />
        </div>
      </div>
    </div>
  );
}

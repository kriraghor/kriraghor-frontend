"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "@phosphor-icons/react";
import { api, problemOf } from "@kriraghor/api-client";
import { KpiTile } from "@kriraghor/ui/charts";
import { DeskAccessNotice, deskAccessKey } from "@kriraghor/ui/desk";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Card, Notice, Skeleton } from "@kriraghor/ui/kit";
import { useUrlFilters } from "@kriraghor/ui/url-filters";
import { RangePicker, lastOfMonth, periodFromParams, periodParams } from "@kriraghor/ui/charts";
import { dhakaToday } from "@/lib/gym-manage";
import { unwrap } from "@/lib/manage";
import { gymMoney, type AllReports as AllReportsData } from "@/lib/gym-money";
import { Upsell, useFmt, useGymError } from "./common";
import { ReportFigures } from "./report-parts";

const SPEC = { month: { default: "" }, from: { default: "" }, to: { default: "" } };

/**
 * /manage/reports (owner; feature reports; M24-FR-74): every gym of the owner together for a month,
 * the gyms side by side when the plan has multi_gym, and the M19 gym dashboard's pass sales.
 */
export function AllReports() {
  const t = useTranslations("gm");
  const err = useGymError();
  const { values, set } = useUrlFilters(SPEC);
  const today = dhakaToday();
  const period = periodFromParams(values, today);
  const span = "month" in period ? { from: `${period.month}-01`, to: lastOfMonth(period.month) } : period;
  const q = useQuery({ queryKey: ["gm-all-reports", period], queryFn: () => gymMoney.allReports(period), retry: false, placeholderData: (prev) => prev });
  const code = problemOf(q.error)?.code;
  return (
    <section className="mx-auto w-full max-w-[1280px] px-4 py-5 sm:px-6 md:py-8" data-testid="gm-all-reports">
      <Link href="/manage" className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-brand-text hover:underline">
        <ArrowLeft size={16} aria-hidden /> {t("myGyms")}
      </Link>
      <h1 className="mt-1 font-display text-2xl font-extrabold md:text-3xl">{t("reports.allTitle")}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">{t("reports.allLead")}</p>
      <div className="mt-4 flex flex-col gap-4">
        <RangePicker value={period} today={today} onChange={(p) => set(periodParams(p, today))} />
        {q.isPending ? (
          <Skeleton className="h-96 rounded-card" />
        ) : code === "GYM_TIER_REQUIRED" ? (
          <Upsell feature="reports" owner />
        ) : q.isError ? (
          deskAccessKey(code) ? <DeskAccessNotice error={q.error} /> : <Notice tone="error">{err(q.error)}</Notice>
        ) : (
          <Body r={q.data} span={span} today={today} />
        )}
      </div>
    </section>
  );
}

function Body({ r, span, today }: { r: AllReportsData; span: { from: string; to: string }; today: string }) {
  const t = useTranslations("gm");
  const f = useFmt();
  return (
    <>
      <p className="text-sm text-muted" data-testid="all-gyms">
        {t("reports.gymsIncluded", { n: r.gyms.length })}: {r.gyms.map((g) => g.name).join(", ")}
      </p>
      <ReportFigures r={r.totals} previous={r.previous} period={span} today={today} testId="all-totals" />
      {r.multiGym && r.perGym ? (
        <Card padded={false} className="p-4" data-testid="per-gym">
          <h2 className="font-display text-lg font-bold">{t("reports.compare")}</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="py-1.5 pr-3 font-semibold">{t("reports.gym")}</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-semibold">{t("reports.activeAtEnd")}</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-semibold">{t("reports.new")}</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-semibold">{t("reports.left")}</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-semibold">{t("reports.collected")}</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-semibold">{t("reports.outstanding")}</th>
                  <th scope="col" className="py-1.5 text-right font-semibold">{t("reports.visits")}</th>
                </tr>
              </thead>
              <tbody>
                {r.perGym.map((g) => (
                  <tr key={g.gym.id} className="border-t border-line">
                    <td className="py-1.5 pr-3">
                      <Link href={`/manage/${g.gym.id}/reports${r.period.month ? `?month=${r.period.month}` : ""}`} className="font-semibold hover:underline">
                        {g.gym.name}
                      </Link>
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{f.n(g.members.activeAtEnd)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{f.n(g.members.new)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{f.n(g.members.left.total)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{f.taka(g.money.collectedPoisha)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{f.taka(g.money.outstandingPoisha)}</td>
                    <td className="py-1.5 text-right tabular-nums">{f.n(g.attendance.visits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : r.gyms.length > 1 ? (
        <Upsell feature="multi_gym" owner />
      ) : null}
      {r.passSales.available ? <PassSales /> : null}
    </>
  );
}

/** M19's gym dashboard (GET /me/dashboard?role=gym_owner, last 7 weeks): pass sales next to the members' fees. */
function PassSales() {
  const t = useTranslations("gm");
  const f = useFmt();
  const q = useQuery({
    queryKey: ["gm-pass-sales", f.locale],
    queryFn: async () => unwrap(await api().GET("/me/dashboard", { params: { query: { role: "gym_owner", period: "7w", locale: f.locale === "bn" ? "bn" : "en" } } })),
    retry: false,
    staleTime: 5 * 60_000,
  });
  const d = q.data && "role" in q.data && q.data.role === "gym_owner" ? q.data : null;
  return (
    <section data-testid="pass-sales">
      <h2 className="mb-2 font-display text-lg font-bold">{t("reports.passSales")}</h2>
      <p className="mb-2 text-sm text-muted">{t("reports.passSalesLead")}</p>
      {q.isPending ? (
        <Skeleton className="h-28 rounded-card" />
      ) : !d ? (
        <Notice tone="info">{t("reports.passSalesNone")}</Notice>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile label={t("reports.passSalesValue")} value={f.taka(d.tiles.passSales.value ?? 0)} spark={d.tiles.passSales.spark} />
          <KpiTile label={t("reports.passesSold")} value={f.n(d.tiles.passesSold.value ?? 0)} spark={d.tiles.passesSold.spark} />
          <KpiTile label={t("reports.admissions")} value={f.n(d.tiles.admissions.value ?? 0)} spark={d.tiles.admissions.spark} />
          <KpiTile label={t("reports.unusedShare")} value={d.tiles.unusedShare.value == null ? "–" : `${f.n(Math.round(d.tiles.unusedShare.value * 1000) / 10)}%`} />
        </div>
      )}
    </section>
  );
}

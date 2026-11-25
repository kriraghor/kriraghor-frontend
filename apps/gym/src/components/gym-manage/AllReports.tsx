"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "@phosphor-icons/react";
import { api, problemOf } from "@kriraghor/api-client";
import { KpiTile } from "@kriraghor/ui/charts";
import { DeskAccessNotice, deskAccessKey } from "@kriraghor/ui/desk";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { DataTable, Notice, Skeleton, type Column } from "@kriraghor/ui/kit";
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
  return (
    <>
      <p className="text-sm text-muted" data-testid="all-gyms">
        {t("reports.gymsIncluded", { n: r.gyms.length })}: {r.gyms.map((g) => g.name).join(", ")}
      </p>
      <ReportFigures r={r.totals} previous={r.previous} period={span} today={today} testId="all-totals" />
      {r.multiGym && r.perGym ? (
        <section data-testid="per-gym">
          <h2 className="mb-2 font-display text-lg font-bold">{t("reports.compare")}</h2>
          <PerGym r={r} />
        </section>
      ) : r.gyms.length > 1 ? (
        <Upsell feature="multi_gym" owner />
      ) : null}
      {r.passSales.available ? <PassSales /> : null}
    </>
  );
}

type GymRow = NonNullable<AllReportsData["perGym"]>[number];

/** The gyms side by side (dashboards round 4): sortable figures and a totals row. */
function PerGym({ r }: { r: AllReportsData }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const sum = (by: (g: GymRow) => number) => (rows: GymRow[]) => rows.reduce((s, g) => s + by(g), 0);
  const num = (id: string, header: string, by: (g: GymRow) => number, money = false): Column<GymRow> => ({
    id,
    header,
    align: "end",
    sort: by,
    cell: (g) => (money ? f.taka(by(g)) : f.n(by(g))),
    total: (rows) => (money ? f.taka(sum(by)(rows)) : f.n(sum(by)(rows))),
  });
  const columns: Column<GymRow>[] = [
    {
      id: "gym",
      header: t("reports.gym"),
      primary: true,
      sort: (g) => g.gym.name,
      cell: (g) => (
        <Link href={`/manage/${g.gym.id}/reports${r.period.month ? `?month=${r.period.month}` : ""}`} className="font-semibold hover:underline">
          {g.gym.name}
        </Link>
      ),
    },
    num("active", t("reports.activeAtEnd"), (g) => g.members.activeAtEnd),
    num("new", t("reports.new"), (g) => g.members.new),
    num("left", t("reports.left"), (g) => g.members.left.total),
    num("collected", t("reports.collected"), (g) => g.money.collectedPoisha, true),
    num("outstanding", t("reports.outstanding"), (g) => g.money.outstandingPoisha, true),
    num("visits", t("reports.visits"), (g) => g.attendance.visits),
  ];
  return <DataTable label={t("reports.compare")} columns={columns} rows={r.perGym ?? []} rowId={(g) => g.gym.id} rowTestId="per-gym-row" maxHeight="70vh" />;
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

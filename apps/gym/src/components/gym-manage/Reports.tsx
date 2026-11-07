"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { UserCircleMinus } from "@phosphor-icons/react";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Button, Card, Field, Notice, Select, Skeleton } from "@kriraghor/ui/kit";
import { useUrlFilters } from "@kriraghor/ui/url-filters";
import { dhakaToday } from "@/lib/gym-manage";
import { gymMoney, monthParam } from "@/lib/gym-money";
import { GymPage, useFmt, useGymError, type GymCtx } from "./common";
import { ExportButtons, MonthPicker, ReportFigures } from "./report-parts";

const SPEC = { month: { default: "" } };

/**
 * /manage/[gymId]/reports (reports.view; feature reports, Standard and up; M24-FR-71 to FR-73): the
 * month in the URL (?month=YYYY-MM, the monthly report links here), members, money and attendance,
 * the overdue list, members not seen lately (members.view) and, for the owner, CSV exports.
 */
export function Reports({ gymId }: { gymId: string }) {
  const t = useTranslations("gm");
  return (
    <GymPage gymId={gymId} page="reports" feature="reports" title={t("reports.title")} description={t("reports.lead")} testId="gm-reports" wide>
      {(ctx) => <Body ctx={ctx} />}
    </GymPage>
  );
}

function Body({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gm");
  const err = useGymError();
  const { values, set } = useUrlFilters(SPEC);
  const today = dhakaToday();
  const max = today.slice(0, 7);
  const month = monthParam(values.month, today);
  const q = useQuery({ queryKey: ["gm-report", ctx.gymId, month], queryFn: () => gymMoney.report(ctx.gymId, { month }), retry: false });
  return (
    <div className="flex flex-col gap-4">
      <MonthPicker month={month} max={max} onChange={(m) => set({ month: m === max ? null : m })} />
      {q.isPending ? (
        <Skeleton className="h-96 rounded-card" />
      ) : q.isError ? (
        <Notice tone="error">{err(q.error)}</Notice>
      ) : (
        <ReportFigures r={q.data} gymId={ctx.gymId} testId="report-figures" />
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {ctx.can("members.view") ? <Absent gymId={ctx.gymId} /> : null}
        {ctx.owner ? <ExportButtons gymId={ctx.gymId} month={month} /> : null}
      </div>
      {!ctx.owner ? <p className="text-xs text-muted">{t("reports.exportsOwner")}</p> : null}
    </div>
  );
}

/** Members not seen for the gym's absent days or a chosen 7, 14, 30 or any number of days (GET reports/absent, M27-FR-31), most days first. */
function Absent({ gymId }: { gymId: string }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const err = useGymError();
  const [days, setDays] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const q = useQuery({ queryKey: ["gm-absent", gymId, days], queryFn: () => gymMoney.absent(gymId, days ?? undefined), retry: false });
  const pick = (v: string) => {
    if (v === "custom") return setCustom(custom || String(q.data?.days ?? ""));
    setCustom("");
    setDays(v ? Number(v) : null);
  };
  return (
    <Card padded={false} className="p-4" data-testid="absent-list">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <UserCircleMinus size={20} aria-hidden /> {q.data ? t("reports.absent", { days: q.data.days }) : t("reports.absentTitle")}
      </h2>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <Select id="absent-days" label={t("reports.absentFor")} value={custom ? "custom" : days ? String(days) : ""} onChange={(e) => pick(e.target.value)} className="w-44">
          <option value="">{t("reports.absentGymDays")}</option>
          {[7, 14, 30].map((n) => (
            <option key={n} value={n}>
              {t("reports.absentDaysN", { n })}
            </option>
          ))}
          <option value="custom">{t("reports.absentCustom")}</option>
        </Select>
        {custom !== "" ? (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(custom);
              if (Number.isInteger(n) && n >= 1 && n <= 365) setDays(n);
            }}
          >
            <Field id="absent-custom" label={t("reports.absentDaysLabel")} inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 3))} className="w-28" />
            <Button type="submit" variant="secondary" size="sm">
              {t("reports.absentShow")}
            </Button>
          </form>
        ) : null}
      </div>
      {q.isPending ? (
        <Skeleton className="mt-2 h-24" />
      ) : q.isError ? (
        <Notice tone="error">{err(q.error)}</Notice>
      ) : !q.data.items.length ? (
        <p className="mt-2 text-sm text-muted">{t("reports.absentNone")}</p>
      ) : (
        <ul className="mt-2 max-h-96 divide-y divide-line overflow-y-auto text-sm">
          {q.data.items.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 py-2">
              <span className="min-w-0">
                <Link href={`/manage/${gymId}/members/${m.id}`} className="font-semibold hover:underline">
                  {m.displayName}
                </Link>{" "}
                <span className="text-xs text-muted tabular-nums">
                  {m.memberCode} · …{m.phoneLast4}
                </span>
              </span>
              <span className="shrink-0 text-xs text-muted">{m.lastCheckInOn ? t("reports.lastSeen", { date: f.short(m.lastCheckInOn), n: m.daysSince ?? 0 }) : t("reports.neverSeen")}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

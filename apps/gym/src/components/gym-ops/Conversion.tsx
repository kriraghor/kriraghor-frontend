"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { DownloadSimple } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { ChartRank } from "@kriraghor/ui/charts";
import { csvErrorKey, downloadCsv } from "@kriraghor/ui/csv";
import { Button, Card, Notice, Skeleton } from "@kriraghor/ui/kit";
import { conversionGroups, gymOps2, type Conversion as Report } from "@/lib/gym-ops";
import { useFmt, useGymError } from "../gym-manage/common";

/**
 * "Where members come from" on the Reports page (M27-FR-87 to FR-91): for the enquiries, free trial visits
 * and join requests that came in during the month, what became of them by today, and the month's new
 * members by source. Counts only. A group the plan lacks is left out. The owner can save it as a CSV.
 */
export function ConversionCard({ gymId, month, owner }: { gymId: string; month: string; owner: boolean }) {
  const t = useTranslations("go.conversion");
  const tg = useTranslations("gm");
  const err = useGymError();
  const q = useQuery({ queryKey: ["go-conversion", gymId, month], queryFn: () => gymOps2.conversion(gymId, month), retry: false });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await downloadCsv("api", `/manage/gyms/${gymId}/reports/conversion/export`, { month }, `conversion-${month}.csv`);
    } catch (e) {
      setProblem(tg(`reports.${csvErrorKey(problemOf(e)?.code)}`));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="flex flex-col gap-3" data-testid="conversion-report">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">{t("title")}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">{t("lead")}</p>
        </div>
        {owner ? (
          <Button type="button" size="sm" variant="secondary" icon={<DownloadSimple size={16} aria-hidden />} busy={busy} onClick={() => void save()} data-testid="conversion-export">
            {t("csv")}
          </Button>
        ) : null}
      </div>
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      {q.isPending ? <Skeleton className="h-56 rounded-card" /> : q.isError ? <Notice tone="error">{err(q.error)}</Notice> : <Figures r={q.data} />}
    </section>
  );
}

function Figures({ r }: { r: Report }) {
  const t = useTranslations("go.conversion");
  const f = useFmt();
  const groups = conversionGroups(r);
  const m = r.members;
  return (
    <>
      <div className="grid gap-3 lg:grid-cols-3">
        {groups.map((g) => (
          <div key={g.key} className="flex min-w-0 flex-col gap-1" data-testid={`conversion-${g.key}`}>
            <ChartRank title={t(`group.${g.key}`)} items={g.stages.map((s) => ({ label: t(`stage.${s.key}`), value: s.value }))} format={f.n} empty={t("nothing")} />
            <p className="px-1 text-sm">
              {g.joinedPct == null ? <span className="text-muted">{t("noShare")}</span> : <span className="font-bold">{t(`share.${g.key}`, { pct: f.n(g.joinedPct) })}</span>}
            </p>
          </div>
        ))}
      </div>
      <Card padded={false} className="p-4" data-testid="conversion-members">
        <h3 className="font-bold">{t("members", { n: f.n(m.total) })}</h3>
        <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-5">
          {(
            [
              ["desk", m.bySource.desk],
              ["platform", m.bySource.platform],
              ["import", m.bySource.import],
              ["fromVisit", m.fromVisit],
              ["fromEnquiry", m.fromEnquiry],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="flex items-baseline justify-between gap-3 border-b border-line py-1 sm:border-0">
              <dt className="text-muted">{t(`source.${key}`)}</dt>
              <dd className="font-bold tabular-nums">{f.n(value)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted">{t("membersNote")}</p>
      </Card>
    </>
  );
}

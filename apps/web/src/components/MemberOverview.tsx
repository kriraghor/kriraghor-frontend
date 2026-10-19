"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { formatTaka } from "@/lib/payments";
import { ChartSplit, DeltaBadge, KpiTile } from "./charts/Charts";
import { Notice } from "./ui";

type Period = "7w" | "qtr" | "yr";
type Data = components["schemas"]["MemberDashboard"];

async function ok<T>(res: { data?: T; error?: unknown }): Promise<T> {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
}

/** /me (M19 §6.3): what I spent online, my bookings, what is coming, where it went, and what needs me. */
export function MemberOverview() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const [period, setPeriod] = useState<Period>("7w");
  const [csvFailed, setCsvFailed] = useState(false);
  const d = useQuery({ queryKey: ["member-dashboard", period], queryFn: async () => (await ok(await api().GET("/me/dashboard", { params: { query: { role: "member", period } } }))) as Data });
  const actions = useQuery({ queryKey: ["member-actions"], queryFn: async () => ok(await api().GET("/me/dashboard/actions", { params: { query: { role: "member" } } })) });
  const money = (n: number) => formatTaka(n, locale);
  const vs = t(`vs.${period}`);

  async function csv() {
    const client = api() as unknown as { GET: (p: string, o: unknown) => Promise<{ data?: Blob; error?: unknown; response: Response }> };
    const { data, error, response } = await client.GET("/me/dashboard/export", { params: { query: { dataset: "member_payments", period } }, parseAs: "blob" });
    if (error || !data) return setCsvFailed(true);
    const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? "kriraghor-payments.csv";
    const url = URL.createObjectURL(data);
    Object.assign(document.createElement("a"), { href: url, download: name }).click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-8 space-y-5 border-t-2 border-line-strong pt-6" data-testid="member-overview">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold">{t("title")}</h2>
        <div className="flex gap-1" role="tablist" aria-label={t("period")}>
          {(["7w", "qtr", "yr"] as Period[]).map((p) => (
            <button key={p} type="button" role="tab" aria-selected={p === period} onClick={() => setPeriod(p)} className={`min-h-11 border-2 px-3 text-sm font-semibold ${p === period ? "border-brand bg-brand text-white" : "border-line"}`}>
              {t(`periods.${p}`)}
            </button>
          ))}
        </div>
      </div>
      {actions.data?.items.length ? (
        <ul className="glass-card divide-y divide-[var(--glass-edge)] px-4" data-testid="member-actions">
          {actions.data.items.map((a) => (
            <li key={`${a.key}-${a.href}`}>
              <Link href={a.href} className="flex min-h-12 items-center gap-3 py-2 hover:bg-surface-2">
                <span className={`h-2.5 w-2.5 shrink-0 ${a.severity === "high" ? "bg-danger" : "bg-brand"}`} aria-hidden="true" />
                <span className="flex-1">{t(`actions.${a.key}`, { n: a.count })}</span>
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {d.isPending ? (
        <div className="h-32 animate-pulse bg-surface-2" />
      ) : d.isError || !d.data ? (
        <Notice tone="error">{t("loadFailed")}</Notice>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiTile testId="tile-spent" label={t("tiles.spent")} help={d.data.definitions.spent} value={money(d.data.tiles.spent.value ?? 0)} delta={<DeltaBadge value={d.data.tiles.spent.delta} kind="pct" label={vs} />} spark={d.data.tiles.spent.spark} />
            <KpiTile label={t("tiles.bookings")} help={d.data.definitions.member_bookings} value={String(d.data.tiles.bookings.value ?? 0)} delta={<DeltaBadge value={d.data.tiles.bookings.delta} kind="pct" label={vs} />} spark={d.data.tiles.bookings.spark} />
            <KpiTile label={t("tiles.upcoming")} value={String(d.data.tiles.upcoming.value ?? 0)} />
          </div>
          <ChartSplit title={t("whereItWent")} parts={d.data.charts.whereItWent.map((w) => ({ label: t(`verticals.${w.vertical}`), value: w.value }))} format={money} empty={t("empty")} />
          <button type="button" onClick={() => void csv()} className="min-h-11 border-2 border-line px-4 font-semibold">
            {t("csv")}
          </button>
          {csvFailed ? <Notice tone="error">{t("csvFailed")}</Notice> : null}
        </>
      )}
    </div>
  );
}

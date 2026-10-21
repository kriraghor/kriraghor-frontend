"use client";

import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Button, DataTable, DetailLayout, Field, FilterBar, Notice, PageTitle, Skeleton, type Column } from "@kriraghor/ui/kit";
import { formatTaka } from "@/lib/admin/finance";
import { stepUp } from "@/lib/admin/stepUp";
import { problemOf } from "@kriraghor/api-client";
import { tournamentsAdmin } from "@/lib/vendor/tournaments";
import { useUrlFilters } from "@/lib/use-url-filters";
import { StatusBadge } from "../../StatusBadge";
import { CodeDialog } from "../CodeDialog";
import { useAdminMe } from "../useAdminMe";

type Row = Awaited<ReturnType<typeof tournamentsAdmin.list>>["items"][number];
const STATUSES = ["pending_review", "registration_open", "registration_closed", "live", "completed", "cancelled"] as const;

/**
 * /admin/tournaments (M14, approve_listings or manage_organisers): physical-sport tournaments with
 * their registrations and escrow; masters cancel with refunds (step-up escrow.manage). Reviews are on
 * the Moderation desk (kind tournament).
 */
export function TournamentsAdmin() {
  // The filters and the open event live in the URL (useSearchParams), so the desk renders inside Suspense.
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-10 h-64 max-w-[1320px]" />}>
      <Desk />
    </Suspense>
  );
}

function Desk() {
  const t = useTranslations("tournamentsAdmin");
  const locale = useLocale();
  const { ready } = useAdminMe();
  const { values, set, clear, params } = useUrlFilters({ status: { default: "", allowed: ["", ...STATUSES] }, q: { default: "" } });
  const status = values.status as (typeof STATUSES)[number] | "";
  const search = values.q;
  const open = params.get("id");
  const list = useQuery({ queryKey: ["admin-tournaments", status, search], queryFn: () => tournamentsAdmin.list({ status: status || undefined, q: search || undefined }), enabled: ready });
  const openName = list.data?.items.find((x) => x.id === open)?.name;

  const columns: Column<Row>[] = [
    {
      id: "name",
      header: t("name"),
      primary: true,
      sort: (x) => x.name,
      cell: (x) => (
        <>
          <span className="block font-semibold">{x.name}</span>
          <span className="block text-xs font-normal text-muted">
            {x.organisation?.name ?? "–"} · {locale === "bn" ? x.sport.nameBn : x.sport.nameEn}
          </span>
        </>
      ),
    },
    { id: "teams", header: t("teams"), align: "end", sort: (x) => x.approved, cell: (x) => `${x.approved}/${x.maxTeams}` },
    {
      id: "status",
      header: t("status"),
      sort: (x) => x.status,
      cell: (x) => (
        <StatusBadge status={x.status} domain="tournament">
          {t(`st.${x.status}`)}
        </StatusBadge>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
      <PageTitle title={t("title")} description={t("intro")} />
      <DetailLayout className="mt-6" open={Boolean(open)} onClose={() => set({ id: null })} title={openName ?? t("title")} pane={open ? <TournamentPane key={open} id={open} /> : null} testId="admin-tournament">
        <div className="flex flex-col gap-4">
          <FilterBar
            search={{ value: search, onChange: (v) => set({ q: v }), label: t("name") }}
            selects={[{ id: "status", label: t("status"), value: status, onChange: (v) => set({ status: v }), anyLabel: t("all"), options: STATUSES.map((s) => ({ value: s, label: t(`st.${s}`) })) }]}
            onClear={clear}
          />
          <DataTable
            label={t("title")}
            testId="admin-tournaments"
            columns={columns}
            rows={list.data?.items}
            rowId={(x) => x.id}
            loading={list.isPending}
            error={list.error}
            onRetry={() => void list.refetch()}
            empty={{ title: t("none") }}
            onRowClick={(x) => set({ id: x.id })}
            selectedId={open}
          />
        </div>
      </DetailLayout>
    </div>
  );
}

function TournamentPane({ id }: { id: string }) {
  const t = useTranslations("tournamentsAdmin");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready, me } = useAdminMe();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const one = useQuery({ queryKey: ["admin-tournament", id], queryFn: () => tournamentsAdmin.get(id), enabled: ready });
  const money = (p: number) => formatTaka(p, locale);
  if (one.isError) return <Notice tone="error">{problemOf(one.error)?.title ?? t("failed")}</Notice>;
  if (!one.data) return <Skeleton className="h-64" />;
  const d = one.data;
  return (
    <div className="flex flex-col gap-4">
      <StatusBadge status={d.status} domain="tournament" className="self-start">
        {t(`st.${d.status}`)}
      </StatusBadge>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        {(
          [
            ["collected", d.money.collected],
            ["held", d.money.held],
            ["released", d.money.released],
            ["refunded", d.money.refunded],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="rounded-control bg-surface-2 px-3 py-2">
            <dt className="text-muted">{t(k)}</dt>
            <dd className="font-semibold tabular">{money(v)}</dd>
          </div>
        ))}
      </dl>
      <section>
        <h3 className="font-semibold">{t("registrations", { n: d.registrationList.length })}</h3>
        <ul className="mt-2 divide-y divide-line rounded-card border border-line text-sm">
          {d.registrationList.map((r) => (
            <li key={r.id} className="flex flex-wrap gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 font-semibold">{r.team}</span>
              <span className="text-muted">{t(`reg.${r.status}`)}</span>
              <span className="tabular">{r.feeWaived ? t("waived") : money(r.feePoisha)}</span>
            </li>
          ))}
        </ul>
      </section>
      {me?.isMaster && !["completed", "cancelled", "rejected"].includes(d.status) ? (
        <div className="flex flex-col gap-2">
          <Field id="tournament-cancel-reason" label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} />
          <Button type="button" variant="danger" disabled={reason.trim().length < 5} onClick={() => setCancelling(true)} className="self-start">
            {t("cancel")}
          </Button>
        </div>
      ) : null}
      {cancelling ? (
        <CodeDialog
          title={t("cancelTitle")}
          help={t("cancelHelp")}
          onClose={() => setCancelling(false)}
          onConfirm={async (code) => {
            await tournamentsAdmin.cancel(id, reason.trim(), await stepUp(code, "escrow.manage"));
            setCancelling(false);
            setReason("");
            await Promise.all([qc.invalidateQueries({ queryKey: ["admin-tournaments"] }), qc.invalidateQueries({ queryKey: ["admin-tournament", id] })]);
          }}
        />
      ) : null}
    </div>
  );
}

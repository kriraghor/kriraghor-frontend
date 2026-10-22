"use client";

import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Prohibit } from "@phosphor-icons/react";
import { Button, DataTable, DetailLayout, ErrorState, Field, FilterBar, Notice, PageTitle, Skeleton, type Column } from "@kriraghor/ui/kit";
import { bookingsAdmin } from "@/lib/admin/bookings";
import { formatTaka } from "@/lib/admin/finance";
import { stepUp } from "@/lib/admin/stepUp";
import { hhmm } from "@/lib/vendor/bookings";
import { useCursorList } from "@/lib/use-cursor-list";
import { useUrlFilters } from "@/lib/use-url-filters";
import { StatusBadge } from "../../StatusBadge";
import { CodeDialog } from "../CodeDialog";
import { formatDhaka, useAdminMe } from "../useAdminMe";

const STATUSES = ["pending_payment", "confirmed", "checked_in", "completed", "no_show", "cancelled", "cancelled_by_owner", "cancelled_by_platform", "expired"] as const;

type Row = Awaited<ReturnType<typeof bookingsAdmin.list>>["items"][number];

/**
 * /admin/bookings (M10): every booking with its money and status; a booking's ledger trail (escrow
 * release with the fee on the full value, refunds, venue fees owed); masters cancel for the platform
 * with a full refund after an authenticator code (step-up escrow.manage).
 */
export function BookingsAdmin() {
  // The desk keeps its filters and the open booking in the URL (useSearchParams), so it renders inside Suspense.
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-8 h-40 max-w-[1320px]" />}>
      <Desk />
    </Suspense>
  );
}

function Desk() {
  const t = useTranslations("bookingsAdmin");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready, me } = useAdminMe();
  const { values, set, clear, params } = useUrlFilters({ status: { default: "", allowed: ["", ...STATUSES] }, code: { default: "" } });
  const { status, code } = values;
  const open = params.get("id");
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const can = (p: string) => Boolean(me && (me.isMaster || me.permissions.includes(p as never)));
  const allowed = can("manage_users") || can("view_payouts");
  const list = useCursorList<Row>(["admin-bookings", status, code], (cursor) => bookingsAdmin.list({ status, code: code.trim().toUpperCase(), cursor }), { enabled: ready && allowed });
  const detail = useQuery({ queryKey: ["admin-booking", open], enabled: Boolean(open), queryFn: () => bookingsAdmin.get(open!) });
  const money = (n: number) => formatTaka(n, locale);
  const select = (id: string | null) => set({ id });

  const columns: Column<Row>[] = [
    { id: "code", header: t("col.code"), primary: true, sort: (b) => b.code, cell: (b) => <span className="font-mono">{b.code}</span> },
    {
      id: "when",
      header: t("col.when"),
      sort: (b) => b.start,
      cell: (b) => (
        <span className="whitespace-nowrap">
          {formatDhaka(b.start, locale)}–{hhmm(b.end)}
        </span>
      ),
    },
    { id: "status", header: t("col.status"), sort: (b) => b.status, cell: (b) => <StatusBadge status={b.status} domain="booking">{t(`status.${b.status}`)}</StatusBadge> },
    { id: "online", header: t("col.online"), align: "end", sort: (b) => b.money.paidOnline, cell: (b) => money(b.money.paidOnline) },
    { id: "total", header: t("col.total"), align: "end", sort: (b) => b.money.total, cell: (b) => money(b.money.total) },
  ];

  const b = detail.data?.booking;
  const pane = !open ? null : detail.isPending ? (
    <Skeleton className="h-64" />
  ) : detail.isError || !detail.data || !b ? (
    <ErrorState onRetry={() => void detail.refetch()} />
  ) : (
    <div data-testid="admin-booking">
      <p className="font-mono text-xs text-muted">{b.code}</p>
      <p className="text-lg font-bold">{b.teamName ?? b.contactName ?? t(`source.${b.source}`)}</p>
      <div className="mt-2">
        <StatusBadge status={b.status} domain="booking">
          {t(`status.${b.status}`)}
        </StatusBadge>
      </div>
      <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-sm">
        {(["total", "paidOnline", "dueAtVenue", "fee", "released", "retained", "refund"] as const).map((k) => (
          <div key={k} className="contents">
            <dt className="text-muted">{t(`money.${k}`)}</dt>
            {/* The shared BookingMoney schema marks fee, released and retained optional (absent for business staff); the admin desk always gets them. */}
            <dd className="tabular text-right">{b.money[k] === undefined ? "—" : money(b.money[k])}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">{t("ledger")}</h3>
      <ul className="mt-1 divide-y divide-line text-sm">
        {detail.data.ledger.map((l) => (
          <li key={l.id} className="flex justify-between gap-3 py-1.5">
            <span>{l.kind}</span>
            <span className="tabular">{money(l.total)}</span>
          </li>
        ))}
        {!detail.data.ledger.length ? <li className="py-1.5 text-muted">{t("noLedger")}</li> : null}
      </ul>
      {me?.isMaster && ["pending_payment", "confirmed"].includes(b.status) ? (
        <Button type="button" variant="danger" className="mt-5" icon={<Prohibit size={18} aria-hidden />} onClick={() => setCancelling(true)}>
          {t("cancel")}
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
      <PageTitle title={t("title")} description={t("intro")} />
      {ready && !allowed ? (
        <Notice tone="error" className="mt-6 max-w-3xl">
          {t("noAccess")}
        </Notice>
      ) : (
        <DetailLayout className="mt-6" open={Boolean(open)} onClose={() => select(null)} title={b?.code ?? list.rows?.find((r) => r.id === open)?.code ?? t("pick")} pane={pane} width={420} testId="booking-pane">
          <div className="flex flex-col gap-4">
            <FilterBar
              search={{ value: code, onChange: (v) => set({ code: v }), label: t("code"), placeholder: "BK-26-000123", testId: "booking-code" }}
              selects={[
                {
                  id: "status",
                  label: t("statusFilter"),
                  value: status,
                  onChange: (v) => set({ status: v }),
                  anyLabel: t("allStatuses"),
                  options: STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) })),
                },
              ]}
              onClear={clear}
            />
            <DataTable
              label={t("title")}
              testId="admin-bookings"
              columns={columns}
              rows={list.rows}
              rowId={(r) => r.id}
              loading={list.loading}
              error={list.error}
              onRetry={list.retry}
              empty={{ title: t("empty") }}
              hasMore={list.hasMore}
              onMore={list.more}
              busy={list.busy}
              onRowClick={(r) => select(r.id)}
              selectedId={open}
            />
          </div>
        </DetailLayout>
      )}
      {cancelling && open ? (
        <CodeDialog
          title={t("cancelTitle")}
          help={t("cancelHelp")}
          onClose={() => setCancelling(false)}
          onConfirm={async (c) => {
            if (reason.trim().length < 5) throw { code: "VALIDATION_FAILED", title: t("reasonNeeded"), status: 422 };
            const token = await stepUp(c, "escrow.manage");
            await bookingsAdmin.cancel(open, reason.trim(), token);
            setCancelling(false);
            await qc.invalidateQueries({ queryKey: ["admin-bookings"] });
            await qc.invalidateQueries({ queryKey: ["admin-booking", open] });
          }}
        >
          <Field id="booking-cancel-reason" className="mt-4" label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        </CodeDialog>
      ) : null}
    </div>
  );
}

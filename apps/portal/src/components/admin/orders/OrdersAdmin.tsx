"use client";

import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Prohibit } from "@phosphor-icons/react";
import { Button, DataTable, DetailLayout, Field, FilterBar, Notice, PageTitle, Skeleton, type Column } from "@kriraghor/ui/kit";
import { formatTaka } from "@/lib/admin/finance";
import { ordersAdmin, type StaffOrder } from "@/lib/admin/orders";
import { stepUp } from "@/lib/admin/stepUp";
import { useCursorList } from "@/lib/use-cursor-list";
import { useUrlFilters } from "@/lib/use-url-filters";
import { StatusBadge } from "../../StatusBadge";
import { CodeDialog } from "../CodeDialog";
import { formatDhaka, useAdminMe } from "../useAdminMe";

const STATUSES = ["pending_payment", "placed", "completed", "cancelled"] as const;
type OrderStatus = (typeof STATUSES)[number];
type Row = Awaited<ReturnType<typeof ordersAdmin.list>>["items"][number];
type Sub = StaffOrder["subOrders"][number];
type Hold = { held?: number; released?: number; refunded?: number; feeTaken?: number; status?: string; available?: number } | null;

/**
 * /admin/orders (M13): find an order by its code (or a sub-order's), see each shop's part with its
 * timeline and escrow hold (held, released, refunded, fee), never the buyer's phone or address; a
 * master cancels a sub-order not yet shipped for the platform with a full refund (step-up escrow.manage).
 */
export function OrdersAdmin() {
  // The desk keeps its filters and the open order in the URL (useSearchParams), so it renders inside Suspense.
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-8 h-40 max-w-[1200px]" />}>
      <Desk />
    </Suspense>
  );
}

function Desk() {
  const t = useTranslations("ordersAdmin");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready, me } = useAdminMe();
  const { values, set, clear, params } = useUrlFilters({ status: { default: "", allowed: ["", ...STATUSES] }, code: { default: "" } });
  const status = values.status as OrderStatus | "";
  const search = values.code.trim().toUpperCase();
  // ?id= is the order's code (the API looks orders up by code).
  const open = params.get("id");
  const [cancelling, setCancelling] = useState<Sub | null>(null);
  const [reason, setReason] = useState("");
  const list = useCursorList<Row>(["admin-orders", status, search], (cursor) => ordersAdmin.list({ code: search || undefined, status: status || undefined, cursor }), { enabled: ready });
  const detail = useQuery({ queryKey: ["admin-order", open], queryFn: () => ordersAdmin.get(open!), enabled: ready && Boolean(open) });
  const money = (n: number | undefined) => formatTaka(n ?? 0, locale);
  const select = (code: string | null) => set({ id: code });

  const columns: Column<Row>[] = [
    { id: "code", header: t("order"), primary: true, sort: (o) => o.code, cell: (o) => <span className="font-mono font-semibold">{o.code}</span> },
    {
      id: "parts",
      header: t("parts"),
      cell: (o) => (
        <span className="flex flex-wrap gap-1">
          {o.subOrders.map((s, i) => (
            <StatusBadge key={i} status={s} domain="order">
              {t(`subStatus.${s}`)}
            </StatusBadge>
          ))}
        </span>
      ),
    },
    { id: "status", header: t("status"), hideBelow: "lg", sort: (o) => o.status, cell: (o) => <StatusBadge status={o.status} domain="order">{t(`orderStatus.${o.status}`)}</StatusBadge> },
    { id: "created", header: t("created"), hideBelow: "xl", sort: (o) => o.createdAt, cell: (o) => <span className="whitespace-nowrap">{formatDhaka(o.createdAt, locale)}</span> },
    { id: "total", header: t("total"), align: "end", sort: (o) => o.total, cell: (o) => money(o.total) },
  ];

  const d = detail.data;
  const pane = !open ? null : detail.isPending ? (
    <Skeleton className="h-64" />
  ) : detail.isError || !d ? (
    <Notice tone="error">{t("failed")}</Notice>
  ) : (
    <div data-testid="order-detail">
      <p className="text-sm text-muted">{t("placedIn", { area: d.area ? (locale === "bn" ? d.area.nameBn : d.area.nameEn) : "—", when: formatDhaka(d.placedAt ?? d.createdAt, locale) })}</p>
      <div className="mt-3 flex flex-col gap-3">
        {d.subOrders.map((s) => {
          const hold = s.escrow as Hold;
          return (
            <section key={s.id} className="rounded-card border border-line p-4" data-testid="staff-sub">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  <span className="font-mono">{s.code}</span> · {s.shop?.name}
                </p>
                <StatusBadge status={s.status} domain="order">
                  {t(`subStatus.${s.status}`)}
                </StatusBadge>
              </div>
              <p className="mt-1 text-sm text-muted">{s.items.map((i) => `${i.qty} × ${i.title}`).join(", ")}</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-muted">{t("total")}</dt>
                  <dd className="tabular">{money(s.money.total)}</dd>
                </div>
                <div>
                  <dt className="text-muted">{t("held")}</dt>
                  <dd className="tabular">{hold ? `${money(hold.available)} · ${hold.status}` : "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted">{t("released")}</dt>
                  <dd className="tabular">{money(hold?.released)}</dd>
                </div>
                <div>
                  <dt className="text-muted">{t("refunded")}</dt>
                  <dd className="tabular">{money(hold?.refunded)}</dd>
                </div>
              </dl>
              <ol className="mt-3 space-y-0.5 text-xs text-muted">
                {(["placedAt", "acceptedAt", "shippedAt", "deliveredAt", "completedAt", "cancelledAt"] as const)
                  .filter((k) => s[k])
                  .map((k) => (
                    <li key={k}>
                      {t(`at.${k}`)}: {formatDhaka(s[k], locale)}
                    </li>
                  ))}
              </ol>
              {s.courier ? <p className="mt-2 text-sm">{t("courier", { name: s.courier.name, no: s.courier.trackingNo })}</p> : null}
              {me?.isMaster && ["placed", "accepted"].includes(s.status) ? (
                <Button type="button" variant="danger" size="sm" className="mt-3" icon={<Prohibit size={16} aria-hidden />} onClick={() => setCancelling(s)}>
                  {t("cancel")}
                </Button>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-8">
      <PageTitle title={t("title")} description={t("intro")} />
      <DetailLayout className="mt-6" open={Boolean(open)} onClose={() => select(null)} title={<span className="font-mono">{open}</span>} pane={pane} width={520} testId="order-pane">
        <div className="flex flex-col gap-4">
          <FilterBar
            search={{ value: values.code, onChange: (v) => set({ code: v.toUpperCase() }), label: t("code"), placeholder: "KG-26-000123", testId: "order-code" }}
            selects={[
              {
                id: "status",
                label: t("status"),
                value: status,
                onChange: (v) => set({ status: v }),
                anyLabel: t("all"),
                options: STATUSES.map((s) => ({ value: s, label: t(`orderStatus.${s}`) })),
              },
            ]}
            onClear={clear}
          />
          <DataTable
            label={t("title")}
            testId="orders-list"
            columns={columns}
            rows={list.rows}
            rowId={(o) => o.id}
            loading={list.loading}
            error={list.error}
            onRetry={list.retry}
            empty={{ title: t("none") }}
            hasMore={list.hasMore}
            onMore={list.more}
            busy={list.busy}
            onRowClick={(o) => select(o.code)}
            selectedId={list.rows?.find((o) => o.code === open)?.id ?? null}
            rowTestId="order-row"
          />
        </div>
      </DetailLayout>
      {cancelling ? (
        <CodeDialog
          title={t("cancelTitle", { code: cancelling.code })}
          help={t("cancelHelp", { amount: money(cancelling.money.total - cancelling.money.refunded) })}
          onClose={() => setCancelling(null)}
          onConfirm={async (c) => {
            if (reason.trim().length < 5) throw { code: "VALIDATION_FAILED", title: t("reasonNeeded"), status: 422 };
            const token = await stepUp(c, "escrow.manage");
            await ordersAdmin.cancel(cancelling.id, reason.trim(), token);
            setCancelling(null);
            await qc.invalidateQueries({ queryKey: ["admin-orders"] });
            await qc.invalidateQueries({ queryKey: ["admin-order", open] });
          }}
        >
          <Field id="order-cancel-reason" className="mt-4" label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        </CodeDialog>
      ) : null}
    </div>
  );
}

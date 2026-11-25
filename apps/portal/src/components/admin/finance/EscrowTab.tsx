"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { HandCoins, LockSimple, LockSimpleOpen } from "@phosphor-icons/react";
import { DataTable, Field, FilterBar, Stat, type Column, type MenuItem } from "@kriraghor/ui/kit";
import { stepUp } from "@/lib/admin/stepUp";
import { finance, formatTaka, parseTaka, type Hold } from "@/lib/admin/finance";
import { useCursorList } from "@/lib/use-cursor-list";
import { useUrlFilters } from "@/lib/use-url-filters";
import { StatusBadge } from "../../StatusBadge";
import { CodeDialog } from "../CodeDialog";
import { formatDhaka } from "../useAdminMe";
import type { DeskMe } from "./FinanceDesk";

type Page = Awaited<ReturnType<typeof finance.holds>>;
type Row = Page["items"][number];

const STATUSES = ["holding", "partially_released", "frozen", "released", "refunded", "closed"] as const;
type Action = "release" | "freeze" | "unfreeze";

/** Escrow holds with totals; masters release (all or part), freeze and unfreeze with step-up escrow.manage. */
export function EscrowTab({ me }: { me: DeskMe }) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const qc = useQueryClient();
  const { values, set, clear } = useUrlFilters({ status: { default: "holding", allowed: ["", ...STATUSES] } });
  const status = values.status as Hold["status"] | "";
  const [acting, setActing] = useState<{ hold: Row; action: Action } | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const list = useCursorList<Row, Page>(["finance-escrow", status], (cursor) => finance.holds({ status: status || undefined, cursor }));
  const totals = list.first?.totals ?? {};
  const close = () => {
    setActing(null);
    setAmount("");
    setReason("");
  };

  const columns: Column<Row>[] = [
    {
      id: "purpose",
      header: t("purpose"),
      primary: true,
      sort: (h) => h.purpose,
      cell: (h) => (
        <>
          {t.has(`purposes.${h.purpose}`) ? t(`purposes.${h.purpose}`) : h.purpose}
          <span className="block font-mono text-xs font-normal text-muted">{h.id.slice(0, 8)}</span>
        </>
      ),
    },
    { id: "held", header: t("held"), align: "end", sort: (h) => h.held, cell: (h) => formatTaka(h.held, locale) },
    { id: "available", header: t("available"), align: "end", sort: (h) => h.available, cell: (h) => formatTaka(h.available, locale) },
    { id: "fee", header: t("fee"), align: "end", hideBelow: "lg", sort: (h) => h.fee.bps, cell: (h) => `${h.fee.bps / 100}%` },
    {
      id: "status",
      header: t("status"),
      sort: (h) => h.status,
      cell: (h) => (
        <>
          <StatusBadge status={h.status}>{t(`holdStatus.${h.status}`)}</StatusBadge>
          {h.frozenReason ? <span className="block text-xs text-danger">{h.frozenReason}</span> : null}
        </>
      ),
    },
    { id: "when", header: t("when"), sort: (h) => h.createdAt, cell: (h) => <span className="whitespace-nowrap">{formatDhaka(h.createdAt, locale)}</span> },
  ];

  const rowActions = (h: Row): MenuItem[] => {
    if (!me.isMaster) return [];
    const open = h.status === "holding" || h.status === "partially_released";
    const out: MenuItem[] = [];
    if (open && h.payeeId) out.push({ label: <span data-testid="release-hold">{t("release")}</span>, icon: <HandCoins />, onSelect: () => setActing({ hold: h, action: "release" }) });
    if (open) out.push({ label: t("freeze"), icon: <LockSimple />, danger: true, onSelect: () => setActing({ hold: h, action: "freeze" }) });
    if (h.status === "frozen") out.push({ label: t("unfreeze"), icon: <LockSimpleOpen />, onSelect: () => setActing({ hold: h, action: "unfreeze" }) });
    return out;
  };

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
        {(["holding", "partially_released", "frozen"] as const).map((s) => (
          <Stat key={s} label={t(`holdStatus.${s}`)} value={formatTaka(totals[s]?.amount ?? 0, locale)} hint={t("holdsCount", { n: totals[s]?.count ?? 0 })} />
        ))}
      </div>
      <FilterBar
        selects={[
          {
            id: "status",
            label: t("status"),
            value: status,
            onChange: (v) => set({ status: v }),
            anyLabel: t("all"),
            options: STATUSES.map((s) => ({ value: s, label: t(`holdStatus.${s}`) })),
          },
        ]}
        onClear={status !== "holding" ? clear : undefined}
      />
      <DataTable
        label={t("tabs.escrow")}
        testId="finance-escrow"
        columns={columns}
        rows={list.rows}
        rowId={(h) => h.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.retry}
        empty={{ title: t("empty") }}
        hasMore={list.hasMore}
        total={list.total}
        onMore={list.more}
        busy={list.busy}
        rowActions={me.isMaster ? rowActions : undefined}
      />

      {acting ? (
        <CodeDialog
          title={t(`${acting.action}Title`, { amount: formatTaka(acting.hold.available, locale) })}
          help={t(`${acting.action}Help`)}
          onClose={close}
          onConfirm={async (code) => {
            if (reason.trim().length < 3) throw { code: "VALIDATION_FAILED", title: t("reasonNeeded"), status: 422 };
            const part = parseTaka(amount);
            const token = await stepUp(code, "escrow.manage");
            if (acting.action === "release") await finance.release(acting.hold.id, { amount: part ?? undefined, reason: reason.trim() }, token);
            else await finance.freeze(acting.hold.id, acting.action, reason.trim(), token);
            close();
            await qc.invalidateQueries({ queryKey: ["finance-escrow"] });
          }}
        >
          <div className="mt-4 flex flex-col gap-4">
            {acting.action === "release" ? (
              <Field id="release-amount" label={t("releaseAmount")} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={t("everything")} inputClassName="tabular" />
            ) : null}
            <Field id="escrow-reason" label={t("reasonRequired")} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
          </div>
        </CodeDialog>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { Badge, Button, Card, DataTable, FilterBar, type Column } from "@kriraghor/ui/kit";
import { finance, formatTaka } from "@/lib/admin/finance";
import { useCursorList } from "@/lib/use-cursor-list";
import { useUrlFilters } from "@/lib/use-url-filters";
import { formatDhaka } from "../useAdminMe";

type Account = Awaited<ReturnType<typeof finance.accounts>>["items"][number];
type EntryPage = Awaited<ReturnType<typeof finance.entries>>;
type Entry = EntryPage["items"][number];

/** Trial balance, invariant checks on demand, account search and an account's entries (expanding rows). */
export function LedgerTab() {
  const t = useTranslations("finance");
  const locale = useLocale();
  const { values, set, clear } = useUrlFilters({ code: { default: "" } });
  const code = values.code;
  const [account, setAccount] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const tb = useQuery({ queryKey: ["finance-tb"], queryFn: finance.trialBalance });
  const inv = useQuery({ queryKey: ["finance-invariants"], queryFn: finance.invariants, enabled: checking });
  // The accounts endpoint has no cursor: one page of up to 100.
  const accounts = useQuery({ queryKey: ["finance-accounts", code], queryFn: () => finance.accounts(code.trim()) });
  const toggle = (id: string) => setAccount((a) => (a === id ? null : id));

  const columns: Column<Account>[] = [
    {
      id: "code",
      header: t("account"),
      primary: true,
      sort: (a) => a.code,
      cell: (a) => (
        <button type="button" className="inline-flex items-center gap-1.5 font-mono font-semibold hover:underline" onClick={() => toggle(a.id)} aria-expanded={account === a.id}>
          {account === a.id ? <CaretDown size={14} weight="bold" aria-hidden /> : <CaretRight size={14} weight="bold" aria-hidden />}
          {a.code}
        </button>
      ),
    },
    { id: "type", header: t("type"), sort: (a) => a.type, cell: (a) => a.type },
    { id: "debit", header: t("debit"), align: "end", hideBelow: "lg", sort: (a) => a.debit, cell: (a) => formatTaka(a.debit, locale) },
    { id: "credit", header: t("credit"), align: "end", hideBelow: "lg", sort: (a) => a.credit, cell: (a) => formatTaka(a.credit, locale) },
    { id: "balance", header: t("balance"), align: "end", sort: (a) => a.balance, cell: (a) => <span className="font-semibold">{formatTaka(a.balance, locale)}</span> },
  ];

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-4">
        <Card className="min-w-64 flex-1 sm:max-w-sm">
          <p className="text-sm font-semibold text-muted">{t("trialBalance")}</p>
          {tb.data ? (
            <p className="mt-1 font-display text-2xl font-bold tabular" data-testid="trial-balance">
              {tb.data.difference === 0 ? t("balanced") : t("offBy", { amount: formatTaka(tb.data.difference, locale) })}
            </p>
          ) : (
            <p className="mt-1 text-muted">–</p>
          )}
          {tb.data ? <p className="text-xs text-muted tabular">{t("tbLine", { debit: formatTaka(tb.data.debit, locale), credit: formatTaka(tb.data.credit, locale) })}</p> : null}
        </Card>
        <Card className="min-w-64 flex-1 sm:max-w-md">
          <p className="text-sm font-semibold text-muted">{t("invariants")}</p>
          {inv.data ? (
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {inv.data.checks.map((c) => (
                <li key={c.name}>
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone={c.ok ? "brand" : "danger"}>{c.ok ? t("ok") : t("failed")}</Badge>
                    {t.has(`checks.${c.name}`) ? t(`checks.${c.name}`) : c.name}
                  </span>
                  {c.detail ? <span className="block text-xs text-danger">{c.detail}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3">
            <Button type="button" variant="secondary" size="sm" busy={inv.isFetching} onClick={() => (checking ? void inv.refetch() : setChecking(true))}>
              {t("runChecks")}
            </Button>
          </div>
        </Card>
      </div>

      <FilterBar search={{ value: code, onChange: (v) => set({ code: v }), label: t("accountSearch"), placeholder: "escrow, payable, fee_revenue…" }} onClear={clear} />
      <DataTable
        label={t("tabs.ledger")}
        testId="finance-accounts"
        columns={columns}
        rows={accounts.data?.items}
        rowId={(a) => a.id}
        loading={accounts.isPending}
        error={accounts.error}
        onRetry={() => void accounts.refetch()}
        empty={{ title: t("empty") }}
        selectedId={account}
        onRowClick={(a) => toggle(a.id)}
        expanded={(a) => (account === a.id ? <Entries id={a.id} /> : null)}
      />
    </div>
  );
}

/** An account's postings, newest first, with Load more (cursor pages of 100). */
function Entries({ id }: { id: string }) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const list = useCursorList<Entry, EntryPage>(["finance-entries", id], (cursor) => finance.entries(id, cursor));
  const columns: Column<Entry>[] = [
    { id: "when", header: t("when"), primary: true, cell: (e) => <span className="whitespace-nowrap">{formatDhaka(e.postedAt, locale)}</span> },
    { id: "kind", header: t("kind"), cell: (e) => <span className="font-mono">{e.kind}</span> },
    { id: "debit", header: t("debit"), align: "end", cell: (e) => (e.debit ? formatTaka(e.debit, locale) : "") },
    { id: "credit", header: t("credit"), align: "end", cell: (e) => (e.credit ? formatTaka(e.credit, locale) : "") },
    { id: "memo", header: t("memo"), cell: (e) => e.memo ?? "" },
  ];
  return (
    <DataTable
      label={t("ledger")}
      testId="finance-entries"
      columns={columns}
      rows={list.rows}
      rowId={(e) => String(e.id)}
      loading={list.loading}
      error={list.error}
      onRetry={list.retry}
      empty={{ title: t("empty") }}
      hasMore={list.hasMore}
      onMore={list.more}
      busy={list.busy}
    />
  );
}

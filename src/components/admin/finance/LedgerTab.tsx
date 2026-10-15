"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { finance, formatTaka } from "@/lib/admin/finance";
import { Button, Notice } from "../../ui";
import { formatDhaka } from "../useAdminMe";
import { Chip, DataTable, Field, inputCls } from "./shared";

/** Trial balance, invariant checks on demand, account search and an account's entries. */
export function LedgerTab() {
  const t = useTranslations("finance");
  const locale = useLocale();
  const [code, setCode] = useState("");
  const [account, setAccount] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const tb = useQuery({ queryKey: ["finance-tb"], queryFn: finance.trialBalance });
  const inv = useQuery({ queryKey: ["finance-invariants"], queryFn: finance.invariants, enabled: checking });
  const accounts = useQuery({ queryKey: ["finance-accounts", code], queryFn: () => finance.accounts(code.trim()) });
  const entries = useQuery({ queryKey: ["finance-entries", account], enabled: Boolean(account), queryFn: () => finance.entries(account as string) });

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-64 border-2 border-line bg-surface p-4">
          <p className="text-sm font-semibold text-muted">{t("trialBalance")}</p>
          {tb.data ? (
            <p className="mt-1 text-2xl font-extrabold tabular-nums" data-testid="trial-balance">
              {tb.data.difference === 0 ? t("balanced") : t("offBy", { amount: formatTaka(tb.data.difference, locale) })}
            </p>
          ) : (
            <p className="mt-1 text-muted">–</p>
          )}
          {tb.data ? <p className="text-xs text-muted tabular-nums">{t("tbLine", { debit: formatTaka(tb.data.debit, locale), credit: formatTaka(tb.data.credit, locale) })}</p> : null}
        </div>
        <div className="min-w-64 border-2 border-line bg-surface p-4">
          <p className="text-sm font-semibold text-muted">{t("invariants")}</p>
          {inv.data ? (
            <ul className="mt-2 space-y-1 text-sm">
              {inv.data.checks.map((c) => (
                <li key={c.name}>
                  <Chip tone={c.ok ? "ok" : "bad"}>{c.ok ? t("ok") : t("failed")}</Chip> {t.has(`checks.${c.name}`) ? t(`checks.${c.name}`) : c.name}
                  {c.detail ? <span className="block text-xs text-danger">{c.detail}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3">
            <Button type="button" busy={inv.isFetching} onClick={() => (checking ? void inv.refetch() : setChecking(true))}>
              {t("runChecks")}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <Field label={t("accountSearch")}>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="escrow, payable, fee_revenue…" className={`${inputCls} w-80 font-mono`} />
        </Field>
      </div>
      <DataTable head={[t("account"), t("type"), t("debit"), t("credit"), t("balance")]} loading={accounts.isPending} error={accounts.isError} empty={!accounts.data?.items.length} testId="finance-accounts">
        {accounts.data?.items.map((a) => (
          <tr key={a.id} className={account === a.id ? "bg-surface-2" : undefined}>
            <td className="px-3 py-2 font-mono">
              <button type="button" className="underline" onClick={() => setAccount(account === a.id ? null : a.id)} aria-expanded={account === a.id}>
                {a.code}
              </button>
            </td>
            <td className="px-3 py-2">{a.type}</td>
            <td className="px-3 py-2 tabular-nums">{formatTaka(a.debit, locale)}</td>
            <td className="px-3 py-2 tabular-nums">{formatTaka(a.credit, locale)}</td>
            <td className="px-3 py-2 font-bold tabular-nums">{formatTaka(a.balance, locale)}</td>
          </tr>
        ))}
      </DataTable>

      {account ? (
        entries.isError ? (
          <div className="mt-4">
            <Notice tone="error">{t("loadFailed")}</Notice>
          </div>
        ) : (
          <DataTable head={[t("when"), t("kind"), t("debit"), t("credit"), t("memo")]} loading={entries.isPending} error={false} empty={!entries.data?.items.length}>
            {entries.data?.items.map((e) => (
              <tr key={e.id}>
                <td className="px-3 py-2 whitespace-nowrap">{formatDhaka(e.postedAt, locale)}</td>
                <td className="px-3 py-2 font-mono">{e.kind}</td>
                <td className="px-3 py-2 tabular-nums">{e.debit ? formatTaka(e.debit, locale) : ""}</td>
                <td className="px-3 py-2 tabular-nums">{e.credit ? formatTaka(e.credit, locale) : ""}</td>
                <td className="px-3 py-2">{e.memo ?? ""}</td>
              </tr>
            ))}
          </DataTable>
        )
      ) : null}
    </div>
  );
}

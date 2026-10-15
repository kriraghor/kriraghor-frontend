"use client";

import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { stepUp } from "@/lib/admin/stepUp";
import { finance, formatTaka, parseTaka, type Hold } from "@/lib/admin/finance";
import { CodeDialog } from "../CodeDialog";
import { formatDhaka } from "../useAdminMe";
import type { DeskMe } from "./FinanceDesk";
import { Chip, DataTable, Field, inputCls, MoreButton, TONE } from "./shared";

const STATUSES = ["holding", "partially_released", "frozen", "released", "refunded", "closed"] as const;
type Action = "release" | "freeze" | "unfreeze";

/** Escrow holds with totals; masters release (all or part), freeze and unfreeze with step-up escrow.manage. */
export function EscrowTab({ me }: { me: DeskMe }) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const qc = useQueryClient();
  const [status, setStatus] = useState<Hold["status"] | "">("holding");
  const [acting, setActing] = useState<{ hold: Hold; action: Action } | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const q = useInfiniteQuery({
    queryKey: ["finance-escrow", status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => finance.holds({ status: status || undefined, cursor: pageParam }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const totals = q.data?.pages[0]?.totals ?? {};
  const close = () => {
    setActing(null);
    setAmount("");
    setReason("");
  };

  return (
    <div className="mt-6">
      <dl className="grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
        {(["holding", "partially_released", "frozen"] as const).map((s) => (
          <div key={s} className="border-2 border-line bg-surface p-4">
            <dt className="text-sm font-semibold text-muted">{t(`holdStatus.${s}`)}</dt>
            <dd className="text-2xl font-extrabold tabular-nums">{formatTaka(totals[s]?.amount ?? 0, locale)}</dd>
            <dd className="text-xs text-muted">{t("holdsCount", { n: totals[s]?.count ?? 0 })}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4">
        <Field label={t("status")}>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={`${inputCls} w-64`}>
            <option value="">{t("all")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`holdStatus.${s}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <DataTable head={[t("purpose"), t("held"), t("available"), t("fee"), t("status"), t("when"), ""]} loading={q.isPending} error={q.isError} empty={!items.length} testId="finance-escrow">
        {items.map((h) => (
          <tr key={h.id}>
            <td className="px-3 py-2">
              {t.has(`purposes.${h.purpose}`) ? t(`purposes.${h.purpose}`) : h.purpose}
              <span className="block font-mono text-xs text-muted">{h.id.slice(0, 8)}</span>
            </td>
            <td className="px-3 py-2 tabular-nums">{formatTaka(h.held, locale)}</td>
            <td className="px-3 py-2 tabular-nums">{formatTaka(h.available, locale)}</td>
            <td className="px-3 py-2 tabular-nums">{h.fee.bps / 100}%</td>
            <td className="px-3 py-2">
              <Chip tone={TONE[h.status] ?? "muted"}>{t(`holdStatus.${h.status}`)}</Chip>
              {h.frozenReason ? <span className="block text-xs text-danger">{h.frozenReason}</span> : null}
            </td>
            <td className="px-3 py-2 whitespace-nowrap">{formatDhaka(h.createdAt, locale)}</td>
            <td className="px-3 py-2 whitespace-nowrap">
              {me.isMaster ? (
                <span className="flex gap-2">
                  {(h.status === "holding" || h.status === "partially_released") && h.payeeId ? (
                    <button type="button" className="min-h-9 border-2 border-brand px-3 font-semibold" onClick={() => setActing({ hold: h, action: "release" })} data-testid="release-hold">
                      {t("release")}
                    </button>
                  ) : null}
                  {h.status === "holding" || h.status === "partially_released" ? (
                    <button type="button" className="min-h-9 border-2 border-line px-3 font-semibold" onClick={() => setActing({ hold: h, action: "freeze" })}>
                      {t("freeze")}
                    </button>
                  ) : null}
                  {h.status === "frozen" ? (
                    <button type="button" className="min-h-9 border-2 border-line px-3 font-semibold" onClick={() => setActing({ hold: h, action: "unfreeze" })}>
                      {t("unfreeze")}
                    </button>
                  ) : null}
                </span>
              ) : null}
            </td>
          </tr>
        ))}
      </DataTable>
      <MoreButton show={Boolean(q.hasNextPage)} busy={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} />

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
          {acting.action === "release" ? (
            <>
              <label htmlFor="release-amount" className="mt-4 block text-sm font-semibold text-muted">
                {t("releaseAmount")}
              </label>
              <input id="release-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={t("everything")} className={`${inputCls} mt-1 w-40`} />
            </>
          ) : null}
          <label htmlFor="escrow-reason" className="mt-4 block text-sm font-semibold text-muted">
            {t("reasonRequired")}
          </label>
          <input id="escrow-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className={`${inputCls} mt-1 w-full`} />
        </CodeDialog>
      ) : null}
    </div>
  );
}

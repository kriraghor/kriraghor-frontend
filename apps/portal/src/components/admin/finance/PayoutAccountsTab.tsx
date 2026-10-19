"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { payouts, type ReviewRow } from "@/lib/admin/payouts";
import { problemOf, type Problem } from "@/lib/api/client";
import { Notice } from "../../ui";
import { formatDhaka } from "../useAdminMe";
import type { DeskMe } from "./FinanceDesk";
import { Chip, DataTable, Field, inputCls } from "./shared";

const STATUSES = ["pending_verification", "active", "rejected"] as const;

/**
 * Payout-account review (M07 §4.1, until M02 takes it over): the account name next to the payee's NID
 * legal name, and a warning when the same wallet is on another user (edge case 8).
 */
export function PayoutAccountsTab({ me }: { me: DeskMe }) {
  const t = useTranslations("payouts");
  const locale = useLocale();
  const qc = useQueryClient();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("pending_verification");
  const [deciding, setDeciding] = useState<{ row: ReviewRow; action: "verify" | "reject" } | null>(null);
  const q = useQuery({ queryKey: ["payout-accounts", status], queryFn: () => payouts.accounts(status) });
  const canDecide = me.isMaster || me.permissions.includes("release_payouts");
  const items = q.data?.items ?? [];

  return (
    <div className="mt-6">
      <Field label={t("statusLabel")}>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={`${inputCls} w-64`}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`accountStatus.${s}`)}
            </option>
          ))}
        </select>
      </Field>
      <DataTable head={[t("account"), t("nameOnAccount"), t("nidName"), t("checks"), t("created"), ""]} loading={q.isPending} error={q.isError} empty={!items.length} testId="payout-accounts">
        {items.map((a) => {
          const legal = a.user.legalName;
          const match = legal ? legal.trim().toLowerCase() === a.accountName.trim().toLowerCase() : null;
          return (
            <tr key={a.id}>
              <td className="px-3 py-2 font-mono">
                {a.masked}
                <span className="block font-sans text-xs text-muted">{a.user.displayName ?? "–"}</span>
              </td>
              <td className="px-3 py-2 font-semibold">{a.accountName}</td>
              <td className="px-3 py-2">{legal ?? <span className="text-muted">{t("noNid")}</span>}</td>
              <td className="px-3 py-2">
                <span className="flex flex-wrap gap-1">
                  {match === true ? <Chip tone="ok">{t("namesMatch")}</Chip> : match === false ? <Chip tone="warn">{t("namesDiffer")}</Chip> : null}
                  {a.sameWalletUsers > 0 ? <Chip tone="bad">{t("sharedWallet", { n: a.sameWalletUsers })}</Chip> : null}
                  {a.user.kycStatus !== "verified" ? <Chip tone="muted">{t("kycNot", { status: a.user.kycStatus ?? "–" })}</Chip> : null}
                </span>
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{formatDhaka(a.createdAt, locale)}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {canDecide && a.status === "pending_verification" ? (
                  <span className="flex gap-2">
                    <button type="button" className="min-h-9 border-2 border-brand px-3 font-semibold" onClick={() => setDeciding({ row: a, action: "verify" })} data-testid="verify-account">
                      {t("verify")}
                    </button>
                    <button type="button" className="min-h-9 border-2 border-line px-3 font-semibold" onClick={() => setDeciding({ row: a, action: "reject" })}>
                      {t("reject")}
                    </button>
                  </span>
                ) : a.reviewNote ? (
                  <span className="text-xs text-muted">{a.reviewNote}</span>
                ) : null}
              </td>
            </tr>
          );
        })}
      </DataTable>
      {deciding ? (
        <Decide
          row={deciding.row}
          action={deciding.action}
          onClose={() => setDeciding(null)}
          onDone={async () => {
            setDeciding(null);
            await qc.invalidateQueries({ queryKey: ["payout-accounts"] });
          }}
        />
      ) : null}
    </div>
  );
}

function Decide({ row, action, onClose, onDone }: { row: ReviewRow; action: "verify" | "reject"; onClose: () => void; onDone: () => Promise<void> }) {
  const t = useTranslations("payouts");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="decide-title"
        className="w-full max-w-md border-2 border-line-strong bg-surface p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setProblem(null);
          try {
            if (action === "verify") await payouts.verify(row.id, note.trim() || undefined);
            else await payouts.reject(row.id, note.trim());
            await onDone();
          } catch (err) {
            setProblem(problemOf(err) ?? { code: "UNKNOWN", title: "Something went wrong", status: 0 });
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 id="decide-title" className="text-xl font-extrabold">
          {t(action === "verify" ? "verifyTitle" : "rejectTitle", { account: row.masked })}
        </h2>
        <p className="mt-2 text-sm text-muted">{t(action === "verify" ? "verifyHelp" : "rejectHelp")}</p>
        <div className="mt-4">
          <Field label={t(action === "verify" ? "noteOptional" : "noteRequired")}>
            <input value={note} onChange={(e) => setNote(e.target.value)} required={action === "reject"} minLength={action === "reject" ? 3 : 0} maxLength={300} className={inputCls} />
          </Field>
        </div>
        {problem ? (
          <div className="mt-3">
            <Notice tone="error">{problem.title}</Notice>
          </div>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="min-h-11 border-2 border-line px-4 font-semibold" onClick={onClose} disabled={busy}>
            {t("cancelForm")}
          </button>
          <button type="submit" className="min-h-11 border-2 border-brand px-4 font-semibold disabled:opacity-50" disabled={busy}>
            {t(action === "verify" ? "verify" : "reject")}
          </button>
        </div>
      </form>
    </div>
  );
}

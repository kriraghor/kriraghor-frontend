"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle, XCircle } from "@phosphor-icons/react";
import { problemOf, type Problem } from "@kriraghor/api-client";
import { Badge, Button, DataTable, Dialog, Field, FilterBar, Notice, ReasonDialog, type Column } from "@kriraghor/ui/kit";
import { payouts, type ReviewRow } from "@/lib/admin/payouts";
import { useCursorList } from "@/lib/use-cursor-list";
import { useUrlFilters } from "@/lib/use-url-filters";
import { formatDhaka } from "../useAdminMe";
import type { DeskMe } from "./FinanceDesk";

const STATUSES = ["pending_verification", "active", "rejected"] as const;

/**
 * Payout-account review (M07 §4.1, until M02 takes it over): the account name next to the payee's NID
 * legal name, and a warning when the same wallet is on another user (edge case 8).
 */
export function PayoutAccountsTab({ me }: { me: DeskMe }) {
  const t = useTranslations("payouts");
  const tf = useTranslations("finance");
  const locale = useLocale();
  const qc = useQueryClient();
  const { values, set } = useUrlFilters({ status: { default: "pending_verification", allowed: STATUSES } });
  const status = values.status as (typeof STATUSES)[number];
  const [deciding, setDeciding] = useState<{ row: ReviewRow; action: "verify" | "reject" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const list = useCursorList<ReviewRow>(["payout-accounts", status], (cursor) => payouts.accounts(status, cursor));
  const canDecide = me.isMaster || me.permissions.includes("release_payouts");

  const close = () => {
    setDeciding(null);
    setProblem(null);
  };
  const decide = async (note: string) => {
    if (!deciding) return;
    setBusy(true);
    setProblem(null);
    try {
      if (deciding.action === "verify") await payouts.verify(deciding.row.id, note.trim() || undefined);
      else await payouts.reject(deciding.row.id, note.trim());
      setDeciding(null);
      await qc.invalidateQueries({ queryKey: ["payout-accounts"] });
    } catch (err) {
      setProblem(problemOf(err) ?? { code: "UNKNOWN", title: "Something went wrong", status: 0 });
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<ReviewRow>[] = [
    {
      id: "account",
      header: t("account"),
      primary: true,
      sort: (a) => a.masked,
      cell: (a) => (
        <>
          <span className="font-mono">{a.masked}</span>
          <span className="block text-xs font-normal text-muted">{a.user.displayName ?? "–"}</span>
        </>
      ),
    },
    { id: "name", header: t("nameOnAccount"), sort: (a) => a.accountName, cell: (a) => <span className="font-semibold">{a.accountName}</span> },
    { id: "nid", header: t("nidName"), cell: (a) => a.user.legalName ?? <span className="text-muted">{t("noNid")}</span> },
    {
      id: "checks",
      header: t("checks"),
      cell: (a) => {
        const legal = a.user.legalName;
        const match = legal ? legal.trim().toLowerCase() === a.accountName.trim().toLowerCase() : null;
        return (
          <>
            <span className="flex flex-wrap gap-1">
              {match === true ? <Badge tone="brand">{t("namesMatch")}</Badge> : match === false ? <Badge tone="warning">{t("namesDiffer")}</Badge> : null}
              {a.sameWalletUsers > 0 ? <Badge tone="danger">{t("sharedWallet", { n: a.sameWalletUsers })}</Badge> : null}
              {a.user.kycStatus !== "verified" ? <Badge>{t("kycNot", { status: a.user.kycStatus ?? "–" })}</Badge> : null}
            </span>
            {a.reviewNote && !(canDecide && a.status === "pending_verification") ? <span className="mt-1 block text-xs text-muted">{a.reviewNote}</span> : null}
          </>
        );
      },
    },
    { id: "created", header: t("created"), hideBelow: "lg", sort: (a) => a.createdAt, cell: (a) => <span className="whitespace-nowrap">{formatDhaka(a.createdAt, locale)}</span> },
  ];

  return (
    <div className="mt-6 flex flex-col gap-4">
      <FilterBar
        chips={{
          label: t("statusLabel"),
          value: status,
          onChange: (v) => set({ status: v }),
          options: STATUSES.map((s) => ({ value: s, label: t(`accountStatus.${s}`) })),
        }}
      />
      <DataTable
        label={tf("tabs.accounts")}
        testId="payout-accounts"
        columns={columns}
        rows={list.rows}
        rowId={(a) => a.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.retry}
        empty={{ title: tf("empty") }}
        hasMore={list.hasMore}
        total={list.total}
        onMore={list.more}
        busy={list.busy}
        rowActions={(a) =>
          canDecide && a.status === "pending_verification"
            ? [
                { label: <span data-testid="verify-account">{t("verify")}</span>, icon: <CheckCircle />, onSelect: () => setDeciding({ row: a, action: "verify" }) },
                { label: t("reject"), icon: <XCircle />, danger: true, onSelect: () => setDeciding({ row: a, action: "reject" }) },
              ]
            : []
        }
      />

      {deciding?.action === "verify" ? (
        <VerifyDialog row={deciding.row} busy={busy} problem={problem} onClose={close} onConfirm={(note) => void decide(note)} />
      ) : null}
      {deciding?.action === "reject" ? (
        <ReasonDialog
          open
          onOpenChange={(o) => (o || busy ? undefined : close())}
          title={t("rejectTitle", { account: deciding.row.masked })}
          description={t("rejectHelp")}
          label={t("noteRequired")}
          confirmLabel={t("reject")}
          danger
          maxLength={300}
          busy={busy}
          error={problem?.title}
          onConfirm={(note) => void decide(note)}
        />
      ) : null}
    </div>
  );
}

/** Verify with an optional note (the payee sees it). */
function VerifyDialog({ row, busy, problem, onClose, onConfirm }: { row: ReviewRow; busy: boolean; problem: Problem | null; onClose: () => void; onConfirm: (note: string) => void }) {
  const t = useTranslations("payouts");
  const [note, setNote] = useState("");
  return (
    <Dialog
      open
      onOpenChange={(o) => (o || busy ? undefined : onClose())}
      title={t("verifyTitle", { account: row.masked })}
      description={t("verifyHelp")}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancelForm")}
          </Button>
          <Button type="submit" form="verify-account-form" busy={busy}>
            {t("verify")}
          </Button>
        </>
      }
    >
      <form
        id="verify-account-form"
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(note);
        }}
      >
        <Field id="verify-note" label={t("noteOptional")} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} autoFocus />
        {problem ? <Notice tone="error">{problem.title}</Notice> : null}
      </form>
    </Dialog>
  );
}

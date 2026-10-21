"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@kriraghor/ui/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { finance, isTab, TABS, type Tab } from "@/lib/admin/finance";
import { Notice } from "@kriraghor/ui/primitives";
import { useAdminMe } from "../useAdminMe";
import { PaymentsTab } from "./PaymentsTab";
import { RefundsTab } from "./RefundsTab";
import { EscrowTab } from "./EscrowTab";
import { LedgerTab } from "./LedgerTab";
import { ReconTab } from "./ReconTab";
import { TestChargeTab } from "./TestChargeTab";
import { PayoutsTab } from "./PayoutsTab";
import { PayoutBatchesTab } from "./PayoutBatchesTab";
import { PayoutAccountsTab } from "./PayoutAccountsTab";

/**
 * /admin/finance (M06 §4, M07 §4.3): payments, refunds (with the escalation queue), escrow holds,
 * payouts, payout runs and payout-account review, the ledger and reconciliation, plus master test
 * charges where the environment allows them. The tab lives in the URL (?tab=payouts&id=…) so
 * notification links land on the right one.
 */
export function FinanceDesk() {
  const t = useTranslations("finance");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { ready, me } = useAdminMe();
  const raw = params.get("tab");
  const tab: Tab = isTab(raw) ? raw : "payments";
  const cfg = useQuery({ queryKey: ["finance-config"], enabled: ready, queryFn: finance.config, retry: false });

  const canView = Boolean(me && (me.isMaster || me.permissions.includes("view_payouts") || me.permissions.includes("release_payouts")));
  const tabs = TABS.filter((x) => x !== "test" || (cfg.data?.testCharges && me?.isMaster));
  const select = (next: Tab) => router.replace(`${pathname}?tab=${next}`);

  return (
    <>
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-3xl font-extrabold">{t("title")}</h1>
          {cfg.data?.simulator ? <span className="border-2 border-amber-500 px-2 text-xs font-bold">{t("simulator")}</span> : null}
        </div>
        <p className="mt-2 max-w-3xl text-muted">{t("intro")}</p>
        {ready && !canView ? (
          <div className="mt-6 max-w-3xl">
            <Notice tone="error">{t("noAccess")}</Notice>
          </div>
        ) : (
          <>
            <div role="tablist" aria-label={t("title")} className="mt-6 flex gap-1 overflow-x-auto border-b-2 border-line">
              {tabs.map((x) => (
                <button
                  key={x}
                  role="tab"
                  type="button"
                  id={`tab-${x}`}
                  aria-selected={tab === x}
                  aria-controls={`panel-${x}`}
                  onClick={() => select(x)}
                  className={`min-h-11 whitespace-nowrap border-b-4 px-4 text-sm font-bold ${tab === x ? "border-brand text-ink" : "border-transparent text-muted"}`}
                >
                  {t(`tabs.${x}`)}
                </button>
              ))}
            </div>
            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
              {!ready || !me ? null : tab === "payments" ? (
                <PaymentsTab me={me} />
              ) : tab === "refunds" ? (
                <RefundsTab me={me} />
              ) : tab === "escrow" ? (
                <EscrowTab me={me} />
              ) : tab === "payouts" ? (
                <PayoutsTab me={me} openId={params.get("id")} />
              ) : tab === "batches" ? (
                <PayoutBatchesTab me={me} />
              ) : tab === "accounts" ? (
                <PayoutAccountsTab me={me} />
              ) : tab === "ledger" ? (
                <LedgerTab />
              ) : tab === "reconciliation" ? (
                <ReconTab me={me} />
              ) : (
                <TestChargeTab max={cfg.data?.testChargeMax ?? 0} onCreated={() => select("payments")} />
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export type DeskMe = { isMaster: boolean; permissions: string[] };

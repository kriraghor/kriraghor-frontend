"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@kriraghor/ui/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Badge, Notice, Tabs } from "@kriraghor/ui/kit";
import { finance, isTab, TABS, type Tab } from "@/lib/admin/finance";
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
 * notification links land on the right one; switching tabs drops the other tab's filters and ?id=.
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
  // A ?tab=test link still opens its panel (as before); the API decides whether test charges are allowed.
  const tabs = TABS.filter((x) => x !== "test" || x === tab || (cfg.data?.testCharges && me?.isMaster));
  const select = (next: Tab) => router.replace(`${pathname}?tab=${next}`);

  const panel = (x: Tab) => {
    if (!ready || !me) return null;
    switch (x) {
      case "payments":
        return <PaymentsTab me={me} />;
      case "refunds":
        return <RefundsTab me={me} />;
      case "escrow":
        return <EscrowTab me={me} />;
      case "payouts":
        return <PayoutsTab me={me} />;
      case "batches":
        return <PayoutBatchesTab me={me} />;
      case "accounts":
        return <PayoutAccountsTab me={me} />;
      case "ledger":
        return <LedgerTab />;
      case "reconciliation":
        return <ReconTab me={me} />;
      default:
        return <TestChargeTab max={cfg.data?.testChargeMax ?? 0} onCreated={() => select("payments")} />;
    }
  };

  return (
    <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        {cfg.data?.simulator ? <Badge tone="warning">{t("simulator")}</Badge> : null}
      </div>
      <p className="mt-2 max-w-3xl text-muted">{t("intro")}</p>
      {ready && !canView ? (
        <div className="mt-6 max-w-3xl">
          <Notice tone="error">{t("noAccess")}</Notice>
        </div>
      ) : (
        <Tabs
          className="mt-6"
          variant="line"
          label={t("title")}
          value={tab}
          onValueChange={(v) => isTab(v) && select(v)}
          items={tabs.map((x) => ({ value: x, label: t(`tabs.${x}`), testId: `tab-${x}`, content: x === tab ? panel(x) : null }))}
        />
      )}
    </div>
  );
}

export type DeskMe = { isMaster: boolean; permissions: string[] };

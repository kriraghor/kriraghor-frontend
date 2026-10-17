"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { problemOf } from "@/lib/api/client";
import { formatTaka } from "@/lib/admin/finance";
import { shopOrders } from "@/lib/vendor/orders";
import { Notice } from "../../ui";
import { Gate } from "../market/ShopDesk";

/**
 * /vendor/settlement (M13): what the shop's orders are worth. Completed orders are in the shop's
 * balance (Kriraghor's 5% on the items already taken) and are paid out on the weekly shop run (M07);
 * open orders are held in escrow until the buyer confirms; refunds went back to buyers.
 */
export function SettlementDesk() {
  const t = useTranslations("vendorOrders");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["shop-settlement"], queryFn: () => shopOrders.settlement(), retry: false });
  const problem = problemOf(q.error);
  const money = (n: number) => formatTaka(n, locale);
  if (problem && ["ROLE_REQUIRED", "ROLE_PENDING", "KYC_REQUIRED", "KYC_PENDING"].includes(problem.code)) return <Gate />;
  return (
    <section className="mx-auto max-w-[1100px] px-5 py-10">
      <Link href="/vendor/orders" className="text-sm font-semibold text-brand underline">
        ← {t("title")}
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold">{t("settlementTitle")}</h1>
      <p className="mt-1 max-w-3xl text-muted">{t("settlementLead")}</p>
      {q.isPending ? <div className="mt-6 h-32 animate-pulse bg-surface-2" /> : null}
      {q.isError && !problem?.code.startsWith("ROLE") ? (
        <div className="mt-6">
          <Notice tone="error">{t("failed")}</Notice>
        </div>
      ) : null}
      {q.data ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-3" data-testid="settlement">
          <div className="border-2 border-line p-5">
            <p className="text-sm text-muted">{t("completedTile", { n: q.data.completed.count })}</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums" data-testid="settlement-net">
              {money(q.data.completed.net)}
            </p>
            <p className="mt-1 text-sm text-muted">{t("afterCommission", { amount: money(q.data.completed.commission) })}</p>
          </div>
          <div className="border-2 border-line p-5">
            <p className="text-sm text-muted">{t("inEscrowTile", { n: q.data.inEscrow.count })}</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums">{money(q.data.inEscrow.net)}</p>
            <p className="mt-1 text-sm text-muted">{t("inEscrowNote")}</p>
          </div>
          <div className="border-2 border-line p-5">
            <p className="text-sm text-muted">{t("refundedTile")}</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums">{money(q.data.refunded)}</p>
          </div>
        </div>
      ) : null}
      <p className="mt-6 text-sm text-muted">{t("payoutNote")}</p>
    </section>
  );
}

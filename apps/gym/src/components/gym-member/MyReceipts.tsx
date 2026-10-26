"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Receipt } from "@phosphor-icons/react";
import { useAuth } from "@kriraghor/ui/auth";
import { SignedOutCard } from "@kriraghor/ui/account";
import { Badge, EmptyState, Notice, Skeleton } from "@kriraghor/ui/kit";
import { gymMe } from "@/lib/gym-manage";
import { useFmt, useGymError } from "@/components/gym-manage/common";
import { ReceiptLink } from "@/components/gym-manage/money";

/** /me/receipts (M24-FR-37): my gym receipts across gyms, newest first; each opens the receipt page with its PDF. */
export function MyReceipts() {
  const t = useTranslations("gm");
  const f = useFmt();
  const err = useGymError();
  const { status } = useAuth();
  const q = useQuery({ queryKey: ["my-gym-receipts"], queryFn: () => gymMe.receipts(), enabled: status === "signed_in" });
  if (status === "signed_out") return <SignedOutCard signInHref="/sign-in?next=/me/receipts" />;
  const items = q.data?.items ?? [];
  return (
    <section className="mx-auto w-full max-w-[960px] px-4 py-6 sm:px-6 md:py-10" data-testid="me-receipts-page">
      <h1 className="font-display text-3xl font-extrabold">{t("me.receipts")}</h1>
      <div className="mt-6">
        {q.isPending ? (
          <Skeleton className="h-40 rounded-card" />
        ) : q.isError ? (
          <Notice tone="error">{err(q.error)}</Notice>
        ) : !items.length ? (
          <EmptyState icon={<Receipt size={32} aria-hidden />} title={t("me.noReceipts")} />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface" data-testid="me-receipt-list">
            {items.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{r.gym?.name ?? t("me.gym")}</span>
                  <span className="text-xs text-muted tabular-nums">
                    {r.receiptNo} · {f.date(r.paidOn)} · {t(`method.${r.method}`)}
                  </span>
                </span>
                <span className="font-display text-lg font-bold tabular-nums">{f.taka(r.amountPoisha)}</span>
                {r.reversedOn ? <Badge tone="danger">{t("receipt.reversedOn", { date: f.short(r.reversedOn) })}</Badge> : null}
                <ReceiptLink url={r.url} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { DownloadSimple } from "@phosphor-icons/react";
import { Button, Notice, Skeleton } from "@kriraghor/ui/kit";
import { gymManage, receiptLines, receiptState, type Receipt } from "@/lib/gym-manage";
import { useFmt } from "./common";

/**
 * /r/[token] (M24-FR-37): the digital receipt behind a signed link, no sign-in, never indexed. The
 * gym's name and address, the TIN or BIN only when the owner entered one, the member, the package and
 * period, the amount and method, who received it and what is still outstanding; "Reversed on" when a
 * reversal followed. **Download PDF** prints it (the print styles keep only the receipt).
 */
export function PublicReceipt({ token }: { token: string }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const q = useQuery({ queryKey: ["gym-receipt", token], queryFn: () => gymManage.publicReceipt(token), retry: false });
  const state = receiptState(q);
  return (
    <section className="mx-auto w-full max-w-[640px] px-4 py-6 sm:py-10" data-testid="public-receipt" data-state={state}>
      {state === "loading" ? (
        <Skeleton className="h-[480px] rounded-card" />
      ) : state === "notFound" ? (
        <Notice tone="warning" title={t("receipt.notFound")}>
          {t("receipt.notFoundBody")}
        </Notice>
      ) : state === "error" || !q.data ? (
        <Notice tone="error">{t("receipt.error")}</Notice>
      ) : (
        <ReceiptCard r={q.data} f={f} />
      )}
    </section>
  );
}

function ReceiptCard({ r, f }: { r: Receipt; f: ReturnType<typeof useFmt> }) {
  const t = useTranslations("gm");
  const lines = receiptLines(r);
  const row = (label: string, value: React.ReactNode, testId?: string) => (
    <div className="flex items-baseline justify-between gap-4 py-1.5" data-testid={testId}>
      <dt className="text-sm text-[#55574f]">{label}</dt>
      <dd className="text-right font-semibold tabular-nums">{value}</dd>
    </div>
  );
  return (
    <>
      <article className="print-area relative overflow-hidden rounded-card border border-[#d9dbd2] bg-white p-5 text-[#111210] shadow-sm sm:p-8" data-testid="receipt">
        {lines.reversedOn ? (
          <div className="mb-4 rounded-control border-2 border-[#c62828] px-3 py-2 text-center font-bold uppercase tracking-wide text-[#c62828]" data-testid="receipt-reversed">
            {t("receipt.reversedOn", { date: f.date(lines.reversedOn) })}
          </div>
        ) : null}
        <header className="border-b border-[#d9dbd2] pb-4 text-center">
          <h1 className="text-2xl font-extrabold">{r.gym.name}</h1>
          {r.gym.addressLine ? <p className="mt-1 text-sm text-[#55574f]">{r.gym.addressLine}</p> : null}
          {lines.tin ? (
            <p className="mt-1 text-xs text-[#55574f]" data-testid="receipt-tin">
              {t("receipt.tin", { tin: lines.tin })}
            </p>
          ) : null}
          {lines.bin ? (
            <p className="text-xs text-[#55574f]" data-testid="receipt-bin">
              {t("receipt.bin", { bin: lines.bin })}
            </p>
          ) : null}
          <p className="mt-3 text-sm font-bold uppercase tracking-[0.2em]">{t("receipt.title")}</p>
        </header>
        <dl className="mt-4 divide-y divide-[#ecede6]">
          {row(t("receipt.no"), r.receiptNo, "receipt-no")}
          {row(t("receipt.issued"), `${f.date(r.issuedAt)} ${f.time(r.issuedAt)}`)}
          {row(t("receipt.member"), `${r.member.displayName} · ${r.member.memberCode}`)}
          {r.membership ? row(t("receipt.package"), r.membership.title) : null}
          {r.membership ? row(t("receipt.period"), `${f.date(r.membership.startsOn)} – ${f.date(r.membership.endsOn)}`) : null}
          {row(t("receipt.paidOn"), f.date(r.paidOn))}
          {row(t("receipt.method"), t(`method.${r.method}`))}
          {r.receivedBy ? row(t("receipt.receivedBy"), r.receivedBy) : null}
        </dl>
        <div className="mt-4 flex items-baseline justify-between gap-4 rounded-control bg-[#f3f4ee] px-4 py-3">
          <span className="font-semibold">{t("receipt.amount")}</span>
          <span className="text-3xl font-extrabold tabular-nums" data-testid="receipt-amount">
            {f.taka(r.amountPoisha)}
          </span>
        </div>
        <dl className="mt-2">{row(t("receipt.outstandingAfter"), f.taka(r.outstandingAfterPoisha))}</dl>
        {r.gym.footer ? <p className="mt-4 border-t border-[#d9dbd2] pt-3 text-center text-sm text-[#55574f]">{r.gym.footer}</p> : null}
        <p className="mt-4 text-center text-xs text-[#55574f]">{t("receipt.issuedBy")}</p>
      </article>
      <div className="no-print mt-4 flex flex-wrap gap-2">
        <Button type="button" icon={<DownloadSimple size={18} aria-hidden />} onClick={() => window.print()} data-testid="receipt-pdf">
          {t("receipt.pdf")}
        </Button>
      </div>
      <p className="no-print mt-2 text-xs text-muted">{t("receipt.pdfHint")}</p>
    </>
  );
}

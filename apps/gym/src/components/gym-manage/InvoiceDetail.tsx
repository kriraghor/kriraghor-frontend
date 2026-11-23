"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowLeft, DownloadSimple } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { DeskAccessNotice, deskAccessKey } from "@kriraghor/ui/desk";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Button, Notice, Skeleton } from "@kriraghor/ui/kit";
import { gymMoney, lineText, type Invoice } from "@/lib/gym-money";
import { useFmt, useGymError } from "./common";
import { InvoiceStatus, PayInvoiceButton } from "./billing-parts";

/**
 * /manage/billing/invoices/[invoiceId] (owner; M24-FR-84, FR-85): Kriraghor's invoice for one month,
 * its lines in the page's language (tier, proration, founding partner, referrals, SMS, VAT), the
 * totals, **Pay** while issued or overdue, and **Download PDF** (prints the invoice only, like the receipt).
 */
export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const t = useTranslations("gm");
  const err = useGymError();
  const q = useQuery({ queryKey: ["gm-invoice", invoiceId], queryFn: () => gymMoney.invoice(invoiceId), retry: false });
  return (
    <section className="mx-auto w-full max-w-[860px] px-4 py-5 sm:px-6 md:py-8" data-testid="gm-invoice">
      <Link href="/manage/billing" className="no-print inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-brand-text hover:underline">
        <ArrowLeft size={16} aria-hidden /> {t("billing.title")}
      </Link>
      <div className="mt-2">
        {q.isPending ? (
          <Skeleton className="h-[480px] rounded-card" />
        ) : q.isError ? (
          deskAccessKey(problemOf(q.error)?.code) ? <DeskAccessNotice error={q.error} /> : <Notice tone="error">{err(q.error)}</Notice>
        ) : (
          <Body i={q.data} />
        )}
      </div>
    </section>
  );
}

function Body({ i }: { i: Invoice }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const lines = (i.lines ?? []).filter((l) => l.kind !== "vat");
  const row = (label: string, value: React.ReactNode, testId?: string) => (
    <div className="flex items-baseline justify-between gap-4 py-1.5" data-testid={testId}>
      <dt className="text-sm text-[#55574f]">{label}</dt>
      <dd className="text-right font-semibold tabular-nums">{value}</dd>
    </div>
  );
  return (
    <>
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <InvoiceStatus status={i.status} />
        <PayInvoiceButton invoice={i} size="md" />
      </div>
      {i.status === "void" ? (
        <Notice tone="info" className="no-print mb-3">
          {t("invoice.voided", { reason: i.voidReason ?? "–" })}
        </Notice>
      ) : null}
      <article className="print-area relative overflow-hidden rounded-card border border-[#d9dbd2] bg-white p-5 text-[#111210] shadow-sm sm:p-8" data-testid="invoice">
        {i.status === "void" ? <div className="mb-4 rounded-control border-2 border-[#c62828] px-3 py-2 text-center font-bold uppercase tracking-wide text-[#c62828]">{t("invoice.status.void")}</div> : null}
        {i.status === "paid" ? <div className="mb-4 rounded-control border border-[#1f7a3a] px-3 py-2 text-center font-bold uppercase tracking-wide text-[#1f7a3a]">{t("invoice.paidStamp", { date: f.date(i.paidAt) })}</div> : null}
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#d9dbd2] pb-4">
          <div>
            <p className="text-xl font-extrabold">Kriraghor</p>
            <p className="text-xs text-[#55574f]">{t("invoice.from")}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold uppercase tracking-[0.2em]">{t("invoice.heading")}</p>
            <p className="font-semibold tabular-nums" data-testid="invoice-number">
              {i.number}
            </p>
          </div>
        </header>
        <dl className="mt-4 divide-y divide-[#ecede6]">
          {i.period ? row(t("invoice.period"), f.month(i.period)) : null}
          {i.billedTier ? row(t("invoice.tier"), t(`tier.${i.billedTier}`)) : null}
          {i.peakActive != null ? row(t("invoice.peak"), f.n(i.peakActive)) : null}
          {row(t("invoice.issued"), f.date(i.issuedAt))}
          {row(t("invoice.due"), f.date(i.dueOn))}
        </dl>
        <div className="mt-4">
          <table className="w-full text-left text-sm" data-testid="invoice-lines">
            <thead className="border-b border-[#d9dbd2] text-xs uppercase tracking-wide text-[#55574f]">
              <tr>
                <th scope="col" className="py-1.5 pr-3 font-semibold">{t("invoice.line")}</th>
                <th scope="col" className="hidden py-1.5 pr-3 text-right font-semibold sm:table-cell">{t("invoice.qty")}</th>
                <th scope="col" className="hidden py-1.5 pr-3 text-right font-semibold sm:table-cell">{t("invoice.unit")}</th>
                <th scope="col" className="py-1.5 text-right font-semibold">{t("invoice.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-b border-[#ecede6]">
                  <td className="py-1.5 pr-3">
                    {/* The server describes every line; suspension_pause (23 Nov 2026) is a credit like the founding discount. */}
                    {lineText(l, f.locale) || (l.kind === "suspension_pause" ? t("invoice.suspensionPause") : l.kind)}
                    {l.quantity !== 1 ? <span className="block text-xs text-[#55574f] tabular-nums sm:hidden">{f.n(l.quantity)} x {f.taka(l.unitPoisha)}</span> : null}
                  </td>
                  <td className="hidden py-1.5 pr-3 text-right tabular-nums sm:table-cell">{f.n(l.quantity)}</td>
                  <td className="hidden py-1.5 pr-3 text-right tabular-nums sm:table-cell">{f.taka(l.unitPoisha)}</td>
                  <td className="whitespace-nowrap py-1.5 text-right tabular-nums">{f.taka(l.amountPoisha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="ml-auto mt-3 max-w-xs">
          {row(t("invoice.subtotal"), f.taka(i.subtotalPoisha))}
          {i.vatPoisha ? row(t("invoice.vat"), f.taka(i.vatPoisha)) : null}
        </dl>
        <div className="mt-2 flex items-baseline justify-between gap-4 rounded-control bg-[#f3f4ee] px-4 py-3">
          <span className="font-semibold">{t("invoice.total")}</span>
          <span className="text-3xl font-extrabold tabular-nums" data-testid="invoice-total">
            {f.taka(i.totalPoisha)}
          </span>
        </div>
        <p className="mt-4 text-center text-xs text-[#55574f]">{t("invoice.footer")}</p>
      </article>
      <div className="no-print mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" icon={<DownloadSimple size={18} aria-hidden />} onClick={() => window.print()} data-testid="invoice-pdf">
          {t("receipt.pdf")}
        </Button>
      </div>
      <p className="no-print mt-2 text-xs text-muted">{t("receipt.pdfHint")}</p>
    </>
  );
}

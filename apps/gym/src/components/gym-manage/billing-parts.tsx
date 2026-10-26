"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CreditCard } from "@phosphor-icons/react";
import { newKey } from "@kriraghor/ui/format";
import { useRouter } from "@kriraghor/ui/i18n/navigation";
import { Badge, Button } from "@kriraghor/ui/kit";
import { gymMoney, INVOICE_TONE, invoicePayable, payPath, type Invoice } from "@/lib/gym-money";
import { useFmt, useGymError } from "./common";

/** An invoice's status chip (issued, overdue, paid, void). */
export function InvoiceStatus({ status }: { status: Invoice["status"] }) {
  const t = useTranslations("gm");
  return (
    <span data-testid="invoice-status" data-status={status}>
      <Badge tone={INVOICE_TONE[status]}>{t(`invoice.status.${status}`)}</Badge>
    </span>
  );
}

/** **Pay** an issued or overdue invoice (M24-FR-85): POST …/pay (one key per button), then the pay page here. */
export function PayInvoiceButton({ invoice, size = "sm", block }: { invoice: Pick<Invoice, "id" | "status" | "totalPoisha">; size?: "sm" | "md" | "lg"; block?: boolean }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const err = useGymError();
  const router = useRouter();
  const [key] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!invoicePayable(invoice)) return null;
  const pay = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const r = await gymMoney.payInvoice(invoice.id, key);
      const to = payPath(r.payment.payUrl);
      if (to.startsWith("/")) router.push(to);
      else window.location.assign(to);
    } catch (e) {
      setProblem(err(e));
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex flex-col gap-1">
      <Button type="button" size={size} block={block} icon={<CreditCard size={16} aria-hidden />} busy={busy} onClick={() => void pay()} data-testid="invoice-pay">
        {t("invoice.pay", { amount: f.taka(invoice.totalPoisha) })}
      </Button>
      {problem ? (
        <span role="alert" className="text-xs text-danger">
          {problem}
        </span>
      ) : null}
    </span>
  );
}

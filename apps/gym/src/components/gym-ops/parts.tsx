"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { MagnifyingGlass, Printer, X } from "@phosphor-icons/react";
import { Button, Field, SegmentedControl } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { gymManage, type MemberRow } from "@/lib/gym-manage";
import type { Sale } from "@/lib/gym-ops";
import { useFmt } from "../gym-manage/common";

export type PickedMember = { id: string; memberCode: string; displayName: string };

/**
 * Find a member of this gym by name, code or the last digits of the phone (members.view), then pick one.
 * Used by the counter sale (optional) and the locker rental (required).
 */
export function MemberPick({ gymId, id, label, value, onChange, optional }: { gymId: string; id: string; label: string; value: PickedMember | null; onChange: (m: PickedMember | null) => void; optional?: string }) {
  const t = useTranslations("go");
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const h = window.setTimeout(() => setQ(text.trim()), 300);
    return () => window.clearTimeout(h);
  }, [text]);
  const found = useQuery({ queryKey: ["go-member-pick", gymId, q], queryFn: () => gymManage.members(gymId, { q, limit: 6 }), enabled: q.length >= 2 && !value });
  if (value) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{label}</span>
        <div className="flex min-h-11 items-center justify-between gap-2 rounded-control border border-line bg-surface-2 px-3">
          <span className="min-w-0 truncate">
            <span className="font-semibold">{value.displayName}</span> <span className="text-sm text-muted">{value.memberCode}</span>
          </span>
          <button type="button" onClick={() => onChange(null)} className="inline-flex size-9 items-center justify-center rounded-control text-muted hover:bg-surface hover:text-ink" aria-label={t("member.clear")}>
            <X size={16} aria-hidden />
          </button>
        </div>
      </div>
    );
  }
  const items: MemberRow[] = found.data?.items ?? [];
  return (
    <div className="relative flex flex-col gap-1">
      <Field id={id} label={label} optional={optional} value={text} onChange={(e) => setText(e.target.value)} leading={<MagnifyingGlass size={16} aria-hidden />} placeholder={t("member.placeholder")} autoComplete="off" />
      {q.length >= 2 ? (
        <ul className="max-h-56 overflow-y-auto rounded-control border border-line bg-surface shadow-md" role="listbox" aria-label={label}>
          {found.isPending ? <li className="px-3 py-2 text-sm text-muted">{t("member.searching")}</li> : null}
          {!found.isPending && items.length === 0 ? <li className="px-3 py-2 text-sm text-muted">{t("member.none")}</li> : null}
          {items.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  onChange({ id: m.id, memberCode: m.memberCode, displayName: m.displayName });
                  setText("");
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-surface-2"
              >
                <span className="min-w-0 truncate font-semibold">{m.displayName}</span>
                <span className="shrink-0 text-xs text-muted">
                  {m.memberCode} · …{m.phoneLast4}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const PAPER_KEY = "kg.gym.paper";
type Paper = "80mm" | "a4";
function readPaper(): Paper {
  try {
    return window.localStorage.getItem(PAPER_KEY) === "a4" ? "a4" : "80mm";
  } catch {
    return "80mm";
  }
}

/** The paper this counter prints on (a thermal 80 mm roll or A4), remembered on this device only. */
export function usePaper(): [Paper, (p: Paper) => void] {
  // Read on first render: the receipt only shows in a dialog, after the page has loaded.
  const [paper, setPaper] = useState<Paper>(() => (typeof window === "undefined" ? "80mm" : readPaper()));
  return [
    paper,
    (p) => {
      setPaper(p);
      try {
        window.localStorage.setItem(PAPER_KEY, p);
      } catch {
        /* private mode: this page only */
      }
    },
  ];
}

/** Print controls: the paper and the Print button. */
export function PrintBar({ paper, onPaper }: { paper: Paper; onPaper: (p: Paper) => void }) {
  const t = useTranslations("go");
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <SegmentedControl
        label={t("receipt.paper")}
        value={paper}
        onChange={(v) => onPaper(v as Paper)}
        options={[
          { value: "80mm", label: t("receipt.roll") },
          { value: "a4", label: "A4" },
        ]}
      />
      <Button variant="secondary" onClick={() => window.print()} data-testid="receipt-print">
        <Printer size={18} aria-hidden />
        {t("print")}
      </Button>
    </div>
  );
}

/**
 * A counter or locker receipt (M27-FR-20): the gym's header (name, address, TIN and BIN when entered), the
 * number, lines, total with the VAT inside (FR-28), method, member and seller, the footer. Always dark ink
 * on white, also in the dark theme. 80 mm: a narrow monospace roll (the @page receipt80 rule); A4: centred.
 */
export function SaleReceipt({ sale, paper }: { sale: Sale; paper: Paper }) {
  const t = useTranslations("go");
  const f = useFmt();
  const vat = sale.vat as { bps: number; vat: number; net: number } | null;
  const gym = sale.gym ?? { name: "", addressLine: null, tin: null, bin: null, footer: null };
  return (
    <div
      className={cn(
        "print-area mx-auto bg-white text-[#111210] shadow-sm",
        paper === "80mm" ? "receipt-80 w-[302px] px-3 py-4 font-mono text-[12px] leading-snug" : "w-full max-w-[560px] rounded-card border border-[#d9dbd2] p-6 text-sm",
      )}
      data-testid="sale-receipt"
    >
      <div className="text-center">
        <p className={cn("font-bold", paper === "80mm" ? "text-[14px]" : "font-display text-xl")}>{gym.name}</p>
        {gym.addressLine ? <p className="text-[#55574f]">{gym.addressLine}</p> : null}
        {gym.tin ? <p className="text-[#55574f]">TIN {gym.tin}</p> : null}
        {gym.bin ? <p className="text-[#55574f]">BIN {gym.bin}</p> : null}
      </div>
      <Dash paper={paper} />
      <div className="flex justify-between gap-2">
        <span>{t("receipt.no")}</span>
        <span className="font-semibold">{sale.receiptNo}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span>{t("receipt.date")}</span>
        <span>
          {f.date(sale.soldOn)} {f.time(sale.createdAt)}
        </span>
      </div>
      {sale.member ? (
        <div className="flex justify-between gap-2">
          <span>{t("receipt.member")}</span>
          <span className="text-right">
            {(sale.member as PickedMember).displayName} ({(sale.member as PickedMember).memberCode})
          </span>
        </div>
      ) : null}
      <Dash paper={paper} />
      <ul className="flex flex-col gap-1">
        {sale.lines.map((l, i) => (
          <li key={i}>
            <p>{l.description}</p>
            <p className="flex justify-between gap-2 text-[#55574f]">
              <span>{t("receipt.line", { qty: f.n(l.qty), price: f.taka(l.unitPricePoisha) })}</span>
              <span className="text-[#111210]">{f.taka(l.lineTotalPoisha)}</span>
            </p>
          </li>
        ))}
      </ul>
      <Dash paper={paper} />
      <div className={cn("flex justify-between gap-2 font-bold", paper === "a4" && "text-lg")}>
        <span>{t("receipt.total")}</span>
        <span>{f.taka(sale.totalPoisha)}</span>
      </div>
      {vat ? (
        <div className="text-[#55574f]">
          <div className="flex justify-between gap-2">
            <span>{t("receipt.net")}</span>
            <span>{f.taka(vat.net)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>{t("receipt.vat", { pct: f.n(vat.bps / 100) })}</span>
            <span>{f.taka(vat.vat)}</span>
          </div>
        </div>
      ) : null}
      <div className="flex justify-between gap-2">
        <span>{t("receipt.paidBy")}</span>
        <span>{t(`method.${sale.method}`)}</span>
      </div>
      {sale.status === "reversed" ? <p className="mt-2 border border-[#c62828] p-1 text-center font-bold text-[#c62828]">{t("receipt.reversed")}</p> : null}
      <Dash paper={paper} />
      {sale.soldBy ? <p className="text-center text-[#55574f]">{t("receipt.servedBy", { name: sale.soldBy })}</p> : null}
      {gym.footer ? <p className="mt-1 text-center">{gym.footer}</p> : null}
      <p className="mt-1 text-center text-[#55574f]">{t("receipt.thanks")}</p>
    </div>
  );
}

function Dash({ paper }: { paper: Paper }) {
  return <div className={cn("my-2 border-t border-dashed", paper === "80mm" ? "border-[#111210]" : "border-[#d9dbd2]")} aria-hidden />;
}

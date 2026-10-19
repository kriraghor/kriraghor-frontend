"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { formatTaka } from "@/lib/admin/finance";
import { gymDesk, type Sold } from "@/lib/vendor/gym";
import { Notice } from "@kriraghor/ui/primitives";
import { Chip } from "../../admin/finance/shared";

const STATUSES = ["active", "redeemed", "expired", "refunded", "cancelled"] as const;
const TONE: Record<Sold["status"], "ok" | "warn" | "bad" | "muted"> = { active: "ok", redeemed: "muted", expired: "muted", cancelled: "bad", refunded: "bad", pending_payment: "warn", void: "muted" };

/** /vendor/gyms/[id]/passes (M20): passes sold, with the price, the Kriraghor fee, what the gym is paid and when. */
export function PassesSold({ id }: { id: string }) {
  const t = useTranslations("vendorGym");
  const locale = useLocale();
  const [status, setStatus] = useState<Sold["status"] | undefined>(undefined);
  const gym = useQuery({ queryKey: ["vendor-gym", id], queryFn: () => gymDesk.get(id) });
  const q = useQuery({ queryKey: ["gym-sold", id, status], queryFn: () => gymDesk.sold(id, status) });
  const money = (n: number) => formatTaka(n, locale);
  const day = (d: string) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
  return (
    <section className="mx-auto max-w-[1100px] px-5 py-8">
      <Link href={`/vendor/gyms/${id}`} className="text-sm font-semibold text-brand underline">
        ← {gym.data?.name ?? t("title")}
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold">{t("sold.title")}</h1>
      <p className="mt-1 max-w-2xl text-muted">{t("sold.lead")}</p>
      <div role="tablist" className="mt-6 flex flex-wrap gap-2">
        {[undefined, ...STATUSES].map((s) => (
          <button key={s ?? "all"} type="button" role="tab" aria-selected={status === s} onClick={() => setStatus(s)} className={`min-h-11 border-2 px-3 text-sm font-bold ${status === s ? "border-brand text-ink" : "border-line text-muted"}`}>
            {s ? t(`passStatus.${s}`) : t("sold.all")}
          </button>
        ))}
      </div>
      {q.isPending ? <div className="mt-6 h-48 animate-pulse bg-surface-2" /> : null}
      {q.isError ? (
        <div className="mt-6">
          <Notice tone="error">{problemOf(q.error)?.title ?? t("failed")}</Notice>
        </div>
      ) : null}
      {q.data && !q.data.items.length ? <p className="mt-8 border-2 border-dashed border-line p-8 text-center text-muted">{t("sold.empty")}</p> : null}
      {q.data?.items.length ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm" data-testid="gym-sold">
            <thead>
              <tr className="border-b-2 border-line text-left text-muted">
                <th className="py-2 pr-3">{t("sold.pass")}</th>
                <th className="py-2 pr-3">{t("sold.member")}</th>
                <th className="py-2 pr-3">{t("sold.valid")}</th>
                <th className="py-2 pr-3 text-right">{t("sold.price")}</th>
                <th className="py-2 pr-3 text-right">{t("sold.fee")}</th>
                <th className="py-2 pr-3 text-right">{t("sold.net")}</th>
                <th className="py-2">{t("sold.status")}</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((p) => (
                <tr key={p.id} className="border-b border-line">
                  <td className="py-2 pr-3">
                    <span className="block font-semibold">{t(`kind.${p.kind}`)}</span>
                    <span className="font-mono text-xs text-muted">{p.code}</span>
                  </td>
                  <td className="py-2 pr-3">{p.holder ?? "–"}</td>
                  <td className="py-2 pr-3">{p.validFrom === p.validTo ? day(p.validFrom) : `${day(p.validFrom)} – ${day(p.validTo)}`}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{money(p.money.price)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{money(p.money.fee)}</td>
                  <td className="py-2 pr-3 text-right font-bold tabular-nums">
                    {money(p.money.net)}
                    <span className="block text-xs font-normal text-muted">{p.money.released ? t("sold.paidOut", { amount: money(p.money.net) }) : p.money.refunded ? t("sold.refunded", { amount: money(p.money.refunded) }) : t("sold.held")}</span>
                  </td>
                  <td className="py-2">
                    <Chip tone={TONE[p.status]}>{t(`passStatus.${p.status}`)}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

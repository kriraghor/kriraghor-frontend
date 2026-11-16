"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { useAuth } from "@kriraghor/ui/auth";
import { orders, statusTone } from "@/lib/orders";
import { formatTaka } from "@/lib/payments";
import { MePanel } from "../MePanel";
import { Notice } from "@kriraghor/ui/primitives";

export const TONE: Record<string, string> = { ok: "border-green-600 text-green-700", warn: "border-warning text-ink", muted: "border-line text-muted", error: "border-danger text-danger" };

/** /me/orders (M13): my shop orders, newest first, each with its shops and their status. */
export function MyOrders() {
  const t = useTranslations("orders");
  const locale = useLocale();
  const { status } = useAuth();
  const list = useQuery({ queryKey: ["my-orders"], queryFn: () => orders.mine(), enabled: status === "signed_in" });
  if (status === "signed_out") return <MePanel />;
  const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Dhaka" }).format(new Date(iso)) : "");
  return (
    <section className="mx-auto max-w-[1100px] px-5 py-10">
      <h1 className="text-3xl font-extrabold">{t("myOrders")}</h1>
      {list.isPending ? <div className="rounded-control mt-6 h-40 kg-shimmer bg-surface-2" /> : null}
      {list.isError ? (
        <div className="mt-6">
          <Notice tone="error">{t("failed")}</Notice>
        </div>
      ) : null}
      {list.data && !list.data.items.length ? (
        <div className="mt-6">
          <p className="text-muted">{t("noOrders")}</p>
          <Link href="/shop" className="mt-3 inline-block font-semibold text-brand underline">
            {t("browse")}
          </Link>
        </div>
      ) : null}
      <ul className="mt-6 flex flex-col gap-4">
        {(list.data?.items ?? []).map((o) => (
          <li key={o.id}>
            <Link href={`/me/orders/${o.code}`} className="rounded-card block border border-line p-4 hover:border-brand" data-testid="order-row">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-extrabold">{o.code}</span>
                <span className="text-sm text-muted">{day(o.placedAt ?? o.createdAt)}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {o.subOrders.map((s) => (
                  <span key={s.id} className={`rounded-pill border px-2 py-0.5 text-xs font-bold ${TONE[statusTone(s.status)]}`}>
                    {s.shop?.name}: {t(`status.${s.status}`)}
                  </span>
                ))}
              </div>
              <p className="mt-2 font-bold">{formatTaka(o.money.total, locale)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { whenLabel } from "@/lib/bookings";
import { formatTaka } from "@/lib/payments";
import { ACTIVE_CASE, disputes } from "@/lib/trust";
import { Notice } from "../ui";

/** /me/disputes (M17): my cases, open ones first. */
export function MyDisputes() {
  const t = useTranslations("trust");
  const locale = useLocale();
  const { status } = useAuth();
  const q = useQuery({ queryKey: ["my-disputes"], queryFn: () => disputes.mine("claimant"), enabled: status === "signed_in" });
  const items = [...(q.data?.items ?? [])].sort((a, b) => Number(ACTIVE_CASE.has(b.status)) - Number(ACTIVE_CASE.has(a.status)));

  return (
    <section className="mx-auto max-w-3xl px-5 pb-16 pt-8">
      <h1 className="text-3xl font-extrabold">{t("myDisputes")}</h1>
      <p className="mt-1 text-muted">{t("listHelp")}</p>
      {status === "signed_out" ? (
        <div className="mt-6">
          <Notice>
            {t("signedOut")}{" "}
            <Link href="/sign-in?next=/me/disputes" className="underline">
              {t("signIn")}
            </Link>
          </Notice>
        </div>
      ) : null}
      {q.isPending && status === "signed_in" ? <div className="mt-6 h-40 animate-pulse bg-surface-2" /> : null}
      {q.isError ? (
        <div className="mt-6">
          <Notice tone="error">{t("loadFailed")}</Notice>
        </div>
      ) : null}
      {q.data && !items.length ? (
        <div className="mt-6 border-2 border-dashed border-line p-6">
          <p className="font-bold">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted">{t("emptyHelp")}</p>
          <Link href="/me/bookings" className="mt-3 inline-block font-semibold text-brand underline">
            {t("toBookings")}
          </Link>
        </div>
      ) : null}
      <ul className="mt-6 divide-y-2 divide-line border-y-2 border-line" data-testid="my-disputes">
        {items.map((d) => (
          <li key={d.code}>
            <Link href={`/me/disputes/${d.code}`} className="flex flex-wrap items-center justify-between gap-3 py-4 hover:bg-surface-2">
              <span>
                <span className="block font-bold">{t(`category.${d.category}`)}</span>
                <span className="block font-mono text-sm text-muted">
                  {d.code} · {d.sourceRef} · {whenLabel(d.createdAt as string, locale)}
                </span>
              </span>
              <span className="text-right">
                <span className="block border-2 border-line px-2 py-0.5 text-sm font-bold">{t(`status.${d.status}`)}</span>
                {d.money ? <span className="mt-1 block text-sm tabular-nums text-muted">{d.status === "resolved" ? t("refundedShort", { amount: formatTaka(d.refund ?? 0, locale) }) : t("heldShort", { amount: formatTaka(d.held, locale) })}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

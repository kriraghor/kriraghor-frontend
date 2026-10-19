"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { useAuth } from "@kriraghor/ui/auth";
import { formatTaka, listMyPayments, outcomeOf } from "@/lib/payments";
import { Notice } from "@kriraghor/ui/primitives";

const TONE = { paid: "text-brand", waiting: "text-muted", failed: "text-danger", expired: "text-muted" } as const;

/** /me/payments (M06 §4): my payments, newest first, with refunds nested under each. */
export function MyPayments() {
  const t = useTranslations("payments");
  const locale = useLocale();
  const { status } = useAuth();
  const q = useInfiniteQuery({
    queryKey: ["my-payments"],
    enabled: status === "signed_in",
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listMyPayments(pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const date = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });

  return (
    <section className="mx-auto max-w-3xl px-5 pb-16 pt-8">
      <h1 className="text-3xl font-extrabold">{t("myPayments")}</h1>
      {status === "signed_out" ? (
        <div className="mt-6">
          <Notice>
            {t("signedOut")}{" "}
            <Link href="/sign-in?next=/me/payments" className="underline">
              {t("signIn")}
            </Link>
          </Notice>
        </div>
      ) : q.isPending ? (
        <div className="mt-6 space-y-2" role="status" aria-label={t("loading")}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse bg-surface-2" />
          ))}
        </div>
      ) : q.isError ? (
        <div className="mt-6">
          <Notice tone="error">{t("loadFailed")}</Notice>
        </div>
      ) : !items.length ? (
        <p className="mt-6 text-muted">{t("empty")}</p>
      ) : (
        <ul className="mt-6 glass-card divide-y divide-[var(--glass-edge)] px-4" data-testid="my-payments">
          {items.map((p) => {
            const outcome = outcomeOf(p.status);
            return (
              <li key={p.id} className="py-4">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="font-bold">{p.title}</span>
                  <span className="ml-auto text-lg font-extrabold tabular-nums">{formatTaka(p.amount, locale)}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted">
                  <span>{date.format(new Date(p.createdAt))}</span>
                  <span className="font-mono">{p.code}</span>
                  {p.methodDisplay ? <span>{p.methodDisplay}</span> : null}
                  <span className={`font-semibold ${TONE[outcome]}`}>{t(`status.${p.status}`)}</span>
                  {outcome === "waiting" || p.status === "failed" ? (
                    <Link href={`/pay/${p.id}`} className="font-semibold text-ink underline">
                      {t("pay")}
                    </Link>
                  ) : null}
                </div>
                {p.refunds.length ? (
                  <ul className="mt-2 border-l-4 border-line pl-3 text-sm">
                    {p.refunds.map((r) => (
                      <li key={r.id}>
                        {t("refundLine", { amount: formatTaka(r.amount, locale) })} · {t(`refundStatus.${r.status}`)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {q.hasNextPage ? (
        <button type="button" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage} className="mt-6 min-h-11 font-semibold underline disabled:opacity-50">
          {t("more")}
        </button>
      ) : null}
    </section>
  );
}

"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { useAuth } from "@kriraghor/ui/auth";
import { bookings, whenLabel } from "@/lib/bookings";
import { formatTaka } from "@/lib/payments";
import { Notice } from "@kriraghor/ui/primitives";

/** /me/bookings (M10 FR-11): upcoming and past bookings, newest first for the past. */
export function MyBookings() {
  const t = useTranslations("bookings");
  const locale = useLocale();
  const { status } = useAuth();
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");
  const q = useInfiniteQuery({
    queryKey: ["my-bookings", scope],
    enabled: status === "signed_in",
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => bookings.mine(scope, pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section className="mx-auto max-w-3xl px-5 pb-16 pt-8">
      <h1 className="text-3xl font-extrabold">{t("myBookings")}</h1>
      <div className="mt-4 flex gap-2" role="tablist">
        {(["upcoming", "past"] as const).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={scope === s} onClick={() => setScope(s)} className={`min-h-11 border-2 px-4 font-semibold ${scope === s ? "border-brand bg-brand text-white" : "border-line"}`}>
            {t(`scope.${s}`)}
          </button>
        ))}
      </div>
      {status === "signed_out" ? (
        <div className="mt-6">
          <Notice>
            {t("signedOut")}{" "}
            <Link href="/sign-in?next=/me/bookings" className="underline">
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
        <div className="mt-6">
          <p className="text-muted">{t(`empty.${scope}`)}</p>
          <Link href="/venues" className="mt-3 inline-flex min-h-12 items-center bg-brand px-5 font-bold text-white">
            {t("findGround")}
          </Link>
        </div>
      ) : (
        <ul className="mt-6 glass-card divide-y divide-[var(--glass-edge)] px-4" data-testid="my-bookings">
          {items.map((b) => (
            <li key={b.id}>
              <Link href={`/me/bookings/${b.id}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-4 hover:bg-surface-2">
                <span className="font-bold">{whenLabel(b.start, locale)}</span>
                <span className="text-muted">{b.courts.map((k) => k.name).join(", ")}</span>
                <span className="font-mono text-sm text-muted">{b.code}</span>
                <span className="ml-auto text-sm font-semibold">{t(`status.${b.status}`)}</span>
                <span className="w-full text-sm text-muted">
                  {t("paidLine", { paid: formatTaka(b.money.paidOnline, locale), due: formatTaka(b.money.dueAtVenue, locale) })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {q.hasNextPage ? (
        <button type="button" onClick={() => q.fetchNextPage()} className="mt-4 min-h-12 border-2 border-line px-5 font-semibold">
          {t("more")}
        </button>
      ) : null}
    </section>
  );
}

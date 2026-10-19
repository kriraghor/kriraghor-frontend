"use client";

import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatTaka } from "@/lib/payments";
import { downloadStatement, getPayout, getSummary, listPayouts, toneOf } from "@/lib/payouts";
import { Notice } from "../ui";

const TONE = { ok: "text-brand", waiting: "text-ink", bad: "text-danger", muted: "text-muted" } as const;

/**
 * /me/payouts (M07 §4.2, FR-16): next payout (same calculation as the payout run), on hold, paid this
 * month, then every payout with its lines and a CSV statement.
 */
export function MyPayouts() {
  const t = useTranslations("payouts");
  const locale = useLocale();
  const { status } = useAuth();
  const signedIn = status === "signed_in";
  const s = useQuery({ queryKey: ["my-payout-summary"], enabled: signedIn, queryFn: getSummary });
  const q = useInfiniteQuery({
    queryKey: ["my-payouts"],
    enabled: signedIn,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listPayouts(pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const [open, setOpen] = useState<string | null>(null);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const date = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });
  const sum = s.data;

  return (
    <section className="mx-auto max-w-3xl px-5 pb-16 pt-8">
      <h1 className="text-3xl font-extrabold">{t("title")}</h1>
      {status === "signed_out" ? (
        <div className="mt-6">
          <Notice>
            {t("signedOut")}{" "}
            <Link href="/sign-in?next=/me/payouts" className="underline">
              {t("signIn")}
            </Link>
          </Notice>
        </div>
      ) : s.isPending || q.isPending ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-3" role="status" aria-label={t("loading")}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse bg-surface-2" />
          ))}
        </div>
      ) : s.isError || q.isError ? (
        <div className="mt-6">
          <Notice tone="error">{t("loadFailed")}</Notice>
        </div>
      ) : (
        <>
          {!sum?.account ? (
            <div className="mt-6">
              <Notice>
                {sum?.pendingAccount ? t("accountPending") : t("needAccount")}{" "}
                <Link href="/me/payout-account" className="underline">
                  {t("accountLink")}
                </Link>
              </Notice>
            </div>
          ) : null}
          {sum && sum.onHold.reasons.length ? (
            <div className="mt-4">
              <Notice tone="error">
                {t("onHoldBanner", { reasons: sum.onHold.reasons.map((r) => t(`holdReason.${r}`)).join(", ") })}
                {sum.onHold.until ? ` ${t("untilWhen", { when: date.format(new Date(sum.onHold.until)) })}` : ""}
              </Notice>
            </div>
          ) : null}
          <dl className="mt-6 grid gap-3 sm:grid-cols-3" data-testid="payout-summary">
            <div className="glass-card p-4">
              <dt className="text-sm font-semibold text-muted">{t("nextPayout")}</dt>
              <dd className="text-2xl font-extrabold tabular-nums">{formatTaka((sum?.nextPayout.projected ?? 0) + (sum?.inPayouts ?? 0), locale)}</dd>
              <dd className="text-xs text-muted">
                {sum?.nextPayout.date ? date.format(new Date(sum.nextPayout.date)) : t("nothingYet")}
                {sum && sum.nextPayout.projected === 0 && sum.inPayouts === 0 ? ` · ${t("minimum", { amount: formatTaka(sum.nextPayout.minimum, locale) })}` : ""}
              </dd>
            </div>
            <div className="glass-card p-4">
              <dt className="text-sm font-semibold text-muted">{t("onHold")}</dt>
              <dd className="text-2xl font-extrabold tabular-nums">{formatTaka(Math.max(0, sum?.onHold.amount ?? 0), locale)}</dd>
            </div>
            <div className="glass-card p-4">
              <dt className="text-sm font-semibold text-muted">{t("paidThisMonth")}</dt>
              <dd className="text-2xl font-extrabold tabular-nums">{formatTaka(sum?.paidThisMonth ?? 0, locale)}</dd>
              {sum?.feesOwed ? <dd className="text-xs text-danger">{t("feesOwed", { amount: formatTaka(sum.feesOwed, locale) })}</dd> : null}
            </div>
          </dl>

          <h2 className="mt-10 text-xl font-extrabold">{t("history")}</h2>
          {!items.length ? (
            <p className="mt-3 text-muted">{t("empty")}</p>
          ) : (
            <ul className="mt-3 glass-card divide-y divide-[var(--glass-edge)] px-4" data-testid="my-payouts">
              {items.map((p) => (
                <li key={p.id} className="py-4">
                  <button type="button" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id} className="flex w-full flex-wrap items-baseline gap-x-4 gap-y-1 text-left">
                    <span className="font-mono font-bold">{p.code}</span>
                    <span className={`text-sm font-semibold ${TONE[toneOf(p.status)]}`}>{t(`status.${p.status}`)}</span>
                    <span className="ml-auto text-lg font-extrabold tabular-nums">{formatTaka(p.amount, locale)}</span>
                  </button>
                  <div className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted">
                    <span>{date.format(new Date(p.paidAt ?? p.createdAt))}</span>
                    {p.account ? <span className="font-mono">{p.account.masked}</span> : null}
                    {p.providerRef ? <span className="font-mono">{t("ref", { ref: p.providerRef })}</span> : null}
                  </div>
                  {open === p.id ? <PayoutLines id={p.id} code={p.code} /> : null}
                </li>
              ))}
            </ul>
          )}
          {q.hasNextPage ? (
            <button type="button" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage} className="mt-4 min-h-11 font-semibold underline disabled:opacity-50">
              {t("more")}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}

function PayoutLines({ id, code }: { id: string; code: string }) {
  const t = useTranslations("payouts");
  const locale = useLocale();
  const d = useQuery({ queryKey: ["my-payout", id], queryFn: () => getPayout(id) });
  const [failed, setFailed] = useState(false);
  if (d.isPending) return <div className="mt-3 h-16 animate-pulse bg-surface-2" />;
  if (d.isError) return <Notice tone="error">{t("loadFailed")}</Notice>;
  const lines = d.data.items.filter((i) => i.status === "included");
  return (
    <div className="mt-3 border-l-4 border-line pl-3">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-muted">
          <tr>
            <th scope="col" className="py-1 font-semibold">{t("line")}</th>
            <th scope="col" className="py-1 text-right font-semibold">{t("fee")}</th>
            <th scope="col" className="py-1 text-right font-semibold">{t("net")}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((i) => (
            <tr key={i.id}>
              <td className="py-1">{i.description}</td>
              <td className="py-1 text-right tabular-nums">{formatTaka(i.fee, locale)}</td>
              <td className="py-1 text-right tabular-nums">{formatTaka(i.net, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        className="mt-2 min-h-11 font-semibold underline"
        onClick={() => downloadStatement(id, code, locale === "bn" ? "bn" : "en").catch(() => setFailed(true))}
      >
        {t("statement")}
      </button>
      {failed ? <Notice tone="error">{t("statementFailed")}</Notice> : null}
    </div>
  );
}

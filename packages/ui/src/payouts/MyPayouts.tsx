"use client";

import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { DownloadSimple, Wallet } from "@phosphor-icons/react";
import { useAuth } from "../auth";
import { Link } from "../i18n/navigation";
import { cn } from "../cn";
import { Button, ButtonLink } from "../kit/Button";
import { DataTable, type Column } from "../kit/DataTable";
import { Badge, Notice, PageTitle, Skeleton, Stat, type Tone } from "../kit/Display";
import { accountGap, downloadStatement, formatTaka, getPayout, getSummary, listPayouts, nextPayoutAmount, toneOf, type MyPayout, type PayoutTone } from "./client";

const TONE: Record<PayoutTone, Tone> = { ok: "brand", waiting: "info", bad: "danger", muted: "neutral" };

export type MyPayoutsProps = {
  /** Where "Sign in" goes (with the way back), e.g. "/sign-in?next=/me/payouts". */
  signInHref: string;
  /** The payout account page in this app ("/me/payout-account", "/vendor/payout-account"). */
  payoutAccountHref: string;
  className?: string;
};

/**
 * My payouts (M07 §4.2, FR-16), on kriraghor.com/me/payouts and vendor.kriraghor.com/vendor/payouts:
 * next payout (same calculation as the payout run), on hold, paid this month, then every payout
 * (cursor paged) with its lines and a CSV statement. No verified account yet: a prominent notice to
 * add one, since nothing can be sent without it.
 */
export function MyPayouts({ signInHref, payoutAccountHref, className }: MyPayoutsProps) {
  const t = useTranslations("payoutsMe");
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
  const items = q.data?.pages.flatMap((p) => p.items);
  const date = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });
  const money = (n: number) => formatTaka(n, locale);
  const sum = s.data;
  const gap = accountGap(sum);

  const columns: Column<MyPayout>[] = [
    { id: "code", header: t("col.payout"), primary: true, cell: (p) => <span className="font-mono font-semibold">{p.code}</span> },
    { id: "status", header: t("col.status"), cell: (p) => <Badge tone={TONE[toneOf(p.status)]}>{t(`status.${p.status}`)}</Badge> },
    { id: "date", header: t("col.date"), cell: (p) => date.format(new Date(p.paidAt ?? p.createdAt)) },
    {
      id: "account",
      header: t("col.account"),
      cell: (p) => (
        <span className="flex flex-col">
          {p.account ? <span className="font-mono">{p.account.masked}</span> : "–"}
          {p.providerRef ? <span className="font-mono text-xs text-muted">{t("ref", { ref: p.providerRef })}</span> : null}
        </span>
      ),
    },
    { id: "amount", header: t("col.amount"), align: "end", cell: (p) => <span className="font-semibold">{money(p.amount)}</span> },
  ];

  return (
    <section className={cn("mx-auto max-w-3xl px-5 pb-16 pt-8", className)}>
      <PageTitle title={t("title")} />
      {status === "signed_out" ? (
        <Notice className="mt-6">
          {t("signedOut")}{" "}
          <Link href={signInHref} className="font-semibold underline">
            {t("signIn")}
          </Link>
        </Notice>
      ) : s.isPending || q.isPending ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-3" role="status" aria-label={t("loading")}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-card" />
          ))}
        </div>
      ) : s.isError || q.isError || !sum ? (
        <Notice tone="error" className="mt-6">
          {t("loadFailed")}
        </Notice>
      ) : (
        <>
          {gap === "missing" ? (
            <Notice
              tone="warning"
              className="mt-6"
              title={t("getPaidTitle")}
              action={
                <ButtonLink href={payoutAccountHref} size="sm" icon={<Wallet size={18} aria-hidden />} data-testid="add-payout-account">
                  {t("add")}
                </ButtonLink>
              }
            >
              {t("needAccount")}
            </Notice>
          ) : gap === "pending" ? (
            <Notice className="mt-6">
              {t("accountPending")}{" "}
              <Link href={payoutAccountHref} className="font-semibold underline">
                {t("accountLink")}
              </Link>
            </Notice>
          ) : null}
          {sum.onHold.reasons.length ? (
            <Notice tone="error" className="mt-4">
              {t("onHoldBanner", { reasons: sum.onHold.reasons.map((r) => t(`holdReason.${r}`)).join(", ") })}
              {sum.onHold.until ? ` ${t("untilWhen", { when: date.format(new Date(sum.onHold.until)) })}` : ""}
            </Notice>
          ) : null}
          <div className="mt-6 grid gap-3 sm:grid-cols-3" data-testid="payout-summary">
            <Stat
              label={t("nextPayout")}
              tone="prize"
              value={money(nextPayoutAmount(sum))}
              hint={
                <>
                  {sum.nextPayout.date ? date.format(new Date(sum.nextPayout.date)) : t("nothingYet")}
                  {sum.nextPayout.projected === 0 && sum.inPayouts === 0 ? ` · ${t("minimum", { amount: money(sum.nextPayout.minimum) })}` : ""}
                </>
              }
            />
            <Stat label={t("onHold")} value={money(Math.max(0, sum.onHold.amount))} />
            <Stat label={t("paidThisMonth")} value={money(sum.paidThisMonth)} hint={sum.feesOwed ? <span className="text-danger">{t("feesOwed", { amount: money(sum.feesOwed) })}</span> : undefined} />
          </div>

          <h2 className="mt-10 font-display text-xl font-bold">{t("history")}</h2>
          <DataTable
            className="mt-3"
            label={t("history")}
            columns={columns}
            rows={items}
            rowId={(p) => p.id}
            testId="my-payouts"
            rowTestId="my-payout"
            empty={{ title: t("empty") }}
            onRowClick={(p) => setOpen(open === p.id ? null : p.id)}
            selectedId={open}
            expanded={(p) => (open === p.id ? <PayoutLines id={p.id} code={p.code} /> : null)}
            hasMore={q.hasNextPage}
            onMore={() => void q.fetchNextPage()}
            busy={q.isFetchingNextPage}
          />
        </>
      )}
    </section>
  );
}

function PayoutLines({ id, code }: { id: string; code: string }) {
  const t = useTranslations("payoutsMe");
  const locale = useLocale();
  const d = useQuery({ queryKey: ["my-payout", id], queryFn: () => getPayout(id) });
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  if (d.isPending) return <Skeleton className="mt-2 h-16" />;
  if (d.isError) return <Notice tone="error">{t("loadFailed")}</Notice>;
  const lines = d.data.items.filter((i) => i.status === "included");
  return (
    <div className="mt-1 flex flex-col gap-3" data-testid="payout-lines">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className="py-1 font-semibold">
              {t("line")}
            </th>
            <th scope="col" className="py-1 text-right font-semibold">
              {t("fee")}
            </th>
            <th scope="col" className="py-1 text-right font-semibold">
              {t("net")}
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((i) => (
            <tr key={i.id} className="border-t border-line">
              <td className="py-1.5">{i.description}</td>
              <td className="py-1.5 text-right tabular">{formatTaka(i.fee, locale)}</td>
              <td className="py-1.5 text-right tabular">{formatTaka(i.net, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          busy={busy}
          icon={<DownloadSimple size={18} aria-hidden />}
          onClick={() => {
            setBusy(true);
            setFailed(false);
            downloadStatement(id, code, locale === "bn" ? "bn" : "en")
              .catch(() => setFailed(true))
              .finally(() => setBusy(false));
          }}
          data-testid="payout-statement"
        >
          {t("statement")}
        </Button>
      </div>
      {failed ? <Notice tone="error">{t("statementFailed")}</Notice> : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { problemOf, type Problem } from "@kriraghor/api-client";
import { publicEnv } from "@kriraghor/session/env";
import { dhakaTime, esports, takaOf } from "@/lib/esports";
import { Button, Notice } from "@kriraghor/ui/primitives";
import { Chip, Prize } from "./bits";

/**
 * /me/winnings: the withdrawable balance (pool prizes in the ledger), prize history and withdrawals.
 * Withdrawing needs NID KYC and a verified bKash or Nagad account (both live on kriraghor.com).
 */
export function Winnings() {
  const t = useTranslations("esports");
  const locale = useLocale();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["es-winnings"], queryFn: () => esports.winnings() });
  const wd = useQuery({ queryKey: ["es-withdrawals"], queryFn: () => esports.withdrawals() });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [done, setDone] = useState(false);
  const web = publicEnv().WEB_URL;

  async function withdraw() {
    setBusy(true);
    setProblem(null);
    try {
      await esports.withdrawWinnings();
      setDone(true);
      await qc.invalidateQueries({ queryKey: ["es-winnings"] });
      await qc.invalidateQueries({ queryKey: ["es-withdrawals"] });
    } catch (err) {
      setProblem(problemOf(err) ?? { code: "UNKNOWN", title: t("failed"), status: 0 });
    } finally {
      setBusy(false);
    }
  }

  const needsNid = problem?.code === "KYC_REQUIRED" || problem?.code === "KYC_PENDING";
  const fix = needsNid ? `${web}/account/verification` : problem?.code === "PAYOUT_ACCOUNT_REQUIRED" ? `${web}/me/payout-account` : null;
  return (
    <section className="mx-auto max-w-[900px] px-5 py-10">
      <h1 className="text-3xl font-extrabold">{t("win.title")}</h1>
      {q.isPending ? <div className="mt-6 h-40 animate-pulse bg-surface-2" /> : null}
      {q.data ? (
        <div className="mt-6 grid gap-4 glass-strong rounded-[24px] p-6 md:grid-cols-[1fr_auto]" data-testid="winnings">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{t("win.available")}</p>
            <Prize money={q.data.available} className="text-5xl" />
            <p className="mt-2 text-sm text-muted">
              {t("win.total", { amount: takaOf(q.data.totalWon, locale) })} · {t("win.min", { amount: takaOf(q.data.minimum, locale) })} · {t("win.dailyLeft", { amount: takaOf(q.data.dailyLimitLeft, locale) })}
            </p>
          </div>
          <div className="flex items-center">
            <Button type="button" busy={busy} disabled={q.data.available.amount <= 0} onClick={() => void withdraw()} data-testid="withdraw">
              {t("win.withdraw")}
            </Button>
          </div>
          {problem ? (
            <div className="md:col-span-2">
              <Notice tone="error">
                {problem.title}
                {fix ? (
                  <>
                    {" "}
                    <a href={fix} className="font-bold underline">
                      {t(problem.code === "PAYOUT_ACCOUNT_REQUIRED" ? "win.addAccount" : "win.verify")}
                    </a>
                  </>
                ) : null}
                {/* M02 §6.3 age_ok (25 Oct 2026): NID verification is 18+ and happens on kriraghor.com. */}
                {needsNid ? <span className="mt-1 block text-sm">{t("win.verifyHelp")}</span> : null}
              </Notice>
            </div>
          ) : done ? (
            <div className="md:col-span-2">
              <Notice>{t("win.requested")}</Notice>
            </div>
          ) : null}
        </div>
      ) : null}

      <h2 className="mt-10 text-xl font-extrabold">{t("win.history")}</h2>
      <ul className="mt-3 glass-card divide-y divide-[var(--glass-edge)] px-4">
        {(q.data?.items ?? []).map((s) => {
          const item = s as typeof s & { tournament: { slug: string; titleEn: string; titleBn: string } | null; kind: string | null; place: number | null; createdAt: string };
          return (
            <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
              {item.tournament ? (
                <Link href={`/events/${item.tournament.slug}`} className="font-semibold underline-offset-2 hover:underline">
                  {locale === "bn" ? item.tournament.titleBn : item.tournament.titleEn}
                </Link>
              ) : null}
              <span className="text-sm text-muted">{item.kind === "kill_reward" ? t("win.kills") : t("place", { n: item.place ?? 0 })}</span>
              {item.status !== "credited" ? <Chip tone="bad">{t(`win.share.${item.status}`)}</Chip> : null}
              <span className="ml-auto">
                <Prize money={item.amount} />
              </span>
            </li>
          );
        })}
        {q.data && !q.data.items.length ? <li className="py-4 text-muted">{t("win.none")}</li> : null}
      </ul>

      {wd.data?.items.length ? (
        <>
          <h2 className="mt-10 text-xl font-extrabold">{t("win.withdrawals")}</h2>
          <ul className="mt-3 glass-card divide-y divide-[var(--glass-edge)] px-4">
            {wd.data.items.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span className="font-mono">{w.code}</span>
                <Chip tone={w.status === "paid" ? "ok" : w.status === "failed" ? "bad" : "warn"}>{t(`win.status.${w.status}`)}</Chip>
                <span className="text-muted">{dhakaTime(w.createdAt, locale)}</span>
                <span className="ml-auto font-bold tabular-nums">{takaOf({ amount: w.amount, currency: "BDT" }, locale)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

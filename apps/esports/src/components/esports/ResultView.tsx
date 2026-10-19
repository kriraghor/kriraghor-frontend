"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { dhakaTime, esports, useRoom } from "@/lib/esports";
import { Button, Notice } from "../ui";
import { Chip, Countdown } from "./bits";

type ResultRow = { registrationId: string; entry: { name: string } | null; placement: number | null; kills: number; placementPoints: number; killPoints: number; totalPoints: number };

/** /me/matches/[matchId]/result: posted results; evidence and a dispute inside the window (FR-20). */
export function ResultView({ matchId }: { matchId: string }) {
  const t = useTranslations("esports");
  const locale = useLocale();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["es-match", matchId], queryFn: () => esports.match(matchId) });
  useRoom(`esports_match:${matchId}`, {
    "esports.results_posted": () => void qc.invalidateQueries({ queryKey: ["es-match", matchId] }),
    "esports.match_status": () => void qc.invalidateQueries({ queryKey: ["es-match", matchId] }),
  });
  const [file, setFile] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "error" } | null>(null);

  if (q.isPending) return <div className="mx-auto mt-10 h-64 max-w-3xl animate-pulse bg-surface-2" />;
  if (q.isError) return <p className="mx-auto max-w-3xl px-5 py-16 text-danger">{t("notFound")}</p>;
  const m = q.data as unknown as { seq: number; status: string; disputeClosesAt: string | null; finalisedAt: string | null; results: ResultRow[] };
  const windowOpen = ["results_pending", "disputed"].includes(m.status) && m.disputeClosesAt && new Date(m.disputeClosesAt) > new Date();

  async function dispute(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const evidenceIds: string[] = [];
      if (file) {
        const up = await esports.upload(file);
        evidenceIds.push((await esports.evidence(matchId, { kind: "screenshot", key: up.key })).id);
      }
      const d = (await esports.dispute(matchId, { reason: reason.trim(), evidenceIds })) as { caseCode?: string };
      // M17: every result dispute is also a case on the unified desk; players follow it on kriraghor.com.
      setMsg({ text: d.caseCode ? t("result.disputeSentCase", { code: d.caseCode }) : t("result.disputeSent"), tone: "info" });
      setReason("");
      setFile(null);
      await qc.invalidateQueries({ queryKey: ["es-match", matchId] });
    } catch (err) {
      setMsg({ text: problemOf(err)?.title ?? t("failed"), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/me/matches" className="text-sm font-semibold text-brand underline">
        ← {t("myMatches")}
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold">{t("match", { n: m.seq })}</h1>
        <Chip tone={m.status === "final" ? "ok" : m.status === "disputed" ? "bad" : "warn"}>{t(`matchStatus.${m.status}`)}</Chip>
      </div>
      {windowOpen ? (
        <p className="mt-2 text-sm text-muted">
          {t("result.windowLeft")} <Countdown to={m.disputeClosesAt!} />
        </p>
      ) : m.finalisedAt ? (
        <p className="mt-2 text-sm text-muted">{t("result.finalAt", { when: dhakaTime(m.finalisedAt, locale) })}</p>
      ) : null}
      {m.results.length ? (
        <div className="mt-6 overflow-x-auto border-2 border-line">
          <table className="w-full min-w-[480px] text-sm" data-testid="results">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2">{t("placementShort")}</th>
                <th className="px-3 py-2">{t("entry")}</th>
                <th className="px-3 py-2 text-right">{t("kills")}</th>
                <th className="px-3 py-2 text-right">{t("pts")}</th>
              </tr>
            </thead>
            <tbody>
              {m.results.map((r) => (
                <tr key={r.registrationId} className="border-t border-line">
                  <td className="px-3 py-2 font-display font-extrabold tabular-nums">{r.placement ?? t("dnp")}</td>
                  <td className="px-3 py-2 font-semibold">{r.entry?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.kills}</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">{r.totalPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-6 text-muted">{t("result.notYet")}</p>
      )}
      {windowOpen ? (
        <form onSubmit={dispute} className="mt-8 grid gap-3 glass-card p-5" data-testid="dispute-form">
          <p className="font-bold">{t("result.disputeTitle")}</p>
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
            {t("result.reason")}
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} maxLength={500} required className="min-h-24 glass-card p-3 text-base text-ink" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
            {t("result.screenshot")}
            <input type="file" accept="image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="min-h-12 field px-3 py-2 text-sm" />
          </label>
          {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
          <div>
            <Button type="submit" busy={busy}>
              {t("result.dispute")}
            </Button>
          </div>
        </form>
      ) : msg ? (
        <div className="mt-6">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      ) : null}
    </section>
  );
}

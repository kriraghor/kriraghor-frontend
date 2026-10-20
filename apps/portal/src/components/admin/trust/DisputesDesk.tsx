"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { formatTaka } from "@/lib/admin/finance";
import { stepUp } from "@/lib/admin/stepUp";
import { disputesAdmin, takaToPoisha, type Outcome, type StaffCase } from "@/lib/admin/trust";
import { Notice } from "@kriraghor/ui/primitives";
import { AdminSubnav } from "../AdminSubnav";
import { CodeDialog } from "../CodeDialog";
import { Chip, inputCls } from "../finance/shared";
import { formatDhaka, useAdminMe } from "../useAdminMe";

const TONE: Record<string, "ok" | "warn" | "bad" | "muted"> = { awaiting_response: "muted", under_review: "warn", escalated: "bad", resolved: "ok", withdrawn: "muted" };
const VIEWS = ["active", "escalated", "resolved", "withdrawn"] as const;

/**
 * /admin/disputes (M17 FR-09 to FR-13): the queue, escalated and most urgent first; a claimed case
 * with both sides, the booking and the policy line it was opened under, and what each outcome moves.
 * Staff decide within refunds.staff_limit_poisha with refund_small, or escalate with a
 * recommendation; masters decide escalated cases (any amount) with an authenticator code. Esports
 * result corrections are entered on the esports desk.
 */
export function DisputesDesk() {
  const t = useTranslations("disputesDesk");
  const locale = useLocale();
  const qc = useQueryClient();
  const params = useSearchParams();
  const { ready, me } = useAdminMe();
  const [view, setView] = useState<(typeof VIEWS)[number]>("active");
  const [open, setOpen] = useState<string | null>(params.get("code"));
  const can = (p: string) => Boolean(me && (me.isMaster || me.permissions.includes(p as never)));
  const allowed = can("resolve_reports") || can("manage_esports");
  const q = useQuery({ queryKey: ["admin-disputes", view], enabled: ready && allowed, queryFn: () => disputesAdmin.list({ status: view }) });
  const money = (n: number | null | undefined) => formatTaka(n ?? 0, locale);

  return (
    <>
      <AdminSubnav />
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t("intro")}</p>
        {ready && !allowed ? (
          <div className="mt-6 max-w-3xl">
            <Notice tone="error">{t("noAccess")}</Notice>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_520px]">
            <div>
              <div className="flex flex-wrap gap-2" role="tablist">
                {VIEWS.map((v) => (
                  <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`min-h-11 border-2 px-4 text-sm font-semibold ${view === v ? "border-brand bg-brand text-white" : "border-line"}`} data-testid={`view-${v}`}>
                    {t(`view.${v}`)}
                  </button>
                ))}
              </div>
              <div className="mt-4 overflow-x-auto border-2 border-line">
                <table className="w-full min-w-[720px] text-sm" data-testid="disputes-queue">
                  <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2">{t("col.code")}</th>
                      <th className="px-3 py-2">{t("col.about")}</th>
                      <th className="px-3 py-2">{t("col.status")}</th>
                      <th className="px-3 py-2">{t("col.due")}</th>
                      <th className="px-3 py-2 text-right">{t("col.held")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(q.data?.items ?? []).map((d) => (
                      <tr key={d.code} className={`cursor-pointer border-t border-line hover:bg-surface-2 ${open === d.code ? "bg-surface-2" : ""}`} onClick={() => setOpen(d.code)} data-testid="dispute-row">
                        <td className="px-3 py-2 font-mono">{d.code}</td>
                        <td className="px-3 py-2">
                          <span className="block font-semibold">{t(`category.${d.category}`)}</span>
                          <span className="block font-mono text-xs text-muted">{d.sourceRef}</span>
                        </td>
                        <td className="px-3 py-2">
                          <Chip tone={TONE[d.status] ?? "muted"}>{t(`status.${d.status}`)}</Chip>
                          {d.claimedByMe ? <span className="ml-2 text-xs font-bold text-brand">{t("mine")}</span> : d.claimedBy ? <span className="ml-2 text-xs text-muted">{t("claimed")}</span> : null}
                        </td>
                        <td className={`px-3 py-2 ${d.overdue ? "font-bold text-danger" : ""}`}>{d.dueAt ? formatDhaka(d.dueAt, locale) : "–"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{d.money ? money(d.held) : t("findings")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!q.isPending && !q.data?.items.length ? <p className="p-4 text-muted">{t("empty")}</p> : null}
              </div>
            </div>
            <div>{open ? <CasePane key={open} code={open} isMaster={Boolean(me?.isMaster)} onChanged={() => qc.invalidateQueries({ queryKey: ["admin-disputes"] })} /> : <p className="text-muted">{t("pick")}</p>}</div>
          </div>
        )}
      </div>
    </>
  );
}

type Claim = { mine: boolean; expiresAt: string; by: { displayName: string | null } | null };

function CasePane({ code, isMaster, onChanged }: { code: string; isMaster: boolean; onChanged: () => void }) {
  const t = useTranslations("disputesDesk");
  const locale = useLocale();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-dispute", code], queryFn: () => disputesAdmin.get(code) });
  const set = (data: StaffCase) => (qc.setQueryData(["admin-dispute", code], data), onChanged());
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [custom, setCustom] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [askCode, setAskCode] = useState(false);
  const claim = useMutation({ mutationFn: () => disputesAdmin.claim(code), onSuccess: set });
  const addNote = useMutation({ mutationFn: () => disputesAdmin.note(code, note.trim()), onSuccess: (d) => (set(d), setNote("")) });
  const refundOf = () => (outcome === "custom" ? (takaToPoisha(custom) ?? undefined) : undefined);
  const decide = useMutation({ mutationFn: () => disputesAdmin.decide(code, { outcome: outcome!, refund: refundOf(), reason: reason.trim(), version: q.data!.dispute.version }), onSuccess: set });
  const escalate = useMutation({ mutationFn: () => disputesAdmin.escalate(code, { ...(outcome ? { outcome, refund: refundOf() } : {}), note: reason.trim(), version: q.data!.dispute.version }), onSuccess: set });
  const money = (n: number | null | undefined) => formatTaka(n ?? 0, locale);
  const claimMine = Boolean((q.data?.claim as Claim | null | undefined)?.mine);

  // Keep the claim while the case is open on screen (TTL moderation.claim_ttl_min).
  useEffect(() => {
    if (!claimMine) return undefined;
    const id = setInterval(() => disputesAdmin.heartbeat(code).catch(() => qc.invalidateQueries({ queryKey: ["admin-dispute", code] })), 60_000);
    return () => clearInterval(id);
  }, [claimMine, code, qc]);

  if (q.isPending) return <div className="h-96 animate-pulse bg-surface-2" />;
  if (q.isError || !q.data) return <Notice tone="error">{t("loadFailed")}</Notice>;
  const { dispute: d, source, evidence, outcomes, previews, limits } = q.data;
  const held = q.data.claim as Claim | null;
  const nameOf = (x: unknown) => (x as { displayName?: string | null } | null)?.displayName ?? "–";
  const src = (source ?? {}) as Record<string, unknown>;
  const active = ["awaiting_response", "under_review", "escalated"].includes(d.status);
  const esports = d.sourceType === "esports_result";
  const choices = (esports ? outcomes.filter((o) => o !== "corrected") : outcomes) as Outcome[];
  const plan = outcome && outcome !== "custom" ? previews[outcome] : null;
  const problem = [claim.error, decide.error, escalate.error, addNote.error].map(problemOf).find(Boolean);
  const staffCanDecide = d.status === "under_review" && claimMine;
  const masterCanDecide = isMaster && ["under_review", "escalated"].includes(d.status);
  const policy = d.policy as Record<string, unknown>;

  return (
    <div className="border-2 border-line-strong p-4" data-testid="dispute-case">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-muted">{d.code}</p>
          <p className="text-lg font-extrabold">{t(`category.${d.category}`)}</p>
          <p className="text-sm text-muted">
            {String(src.groundName ?? src.shopName ?? src.tournamentTitle ?? d.sourceRef)}
            {src.start ? ` · ${formatDhaka(String(src.start), locale)}` : ""}
          </p>
        </div>
        <Chip tone={TONE[d.status] ?? "muted"}>{t(`status.${d.status}`)}</Chip>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-muted">{t("claimant")}</dt>
        <dd className="text-right">{nameOf(q.data.claimant)}</dd>
        {q.data.respondent ? (
          <>
            <dt className="text-muted">{t("respondent")}</dt>
            <dd className="text-right">{nameOf(q.data.respondent)}</dd>
          </>
        ) : null}
        <dt className="text-muted">{t("paid")}</dt>
        <dd className="text-right tabular-nums">{money(d.paid)}</dd>
        <dt className="text-muted">{t("held")}</dt>
        <dd className="text-right font-bold tabular-nums" data-testid="case-held">
          {d.money ? money(d.held) : t("findings")}
        </dd>
      </dl>
      <p className="mt-2 border-l-4 border-info pl-3 text-sm">{t(`policy.${d.policyKey.replace(".", "_")}`, { advance: money(Number(policy.advance ?? 0)), fee: Number(policy.feeBps ?? 0) / 100 })}</p>
      {esports && src.matchId ? (
        <p className="mt-2 text-sm">
          <Link href={`/admin/esports?match=${String(src.matchId)}`} className="font-semibold text-brand underline">
            {t("esportsDesk")}
          </Link>
        </p>
      ) : null}
      {d.status === "escalated" ? (
        <Notice>
          {t("recommended", { outcome: d.recommendedOutcome ? t(`outcome.${d.recommendedOutcome}`) : "–", refund: money(d.recommendedRefund as number | null) })} {d.escalationNote ? `“${d.escalationNote}”` : ""}
        </Notice>
      ) : null}

      <h2 className="mt-4 text-sm font-bold uppercase tracking-wide text-muted">{t("timeline")}</h2>
      <ol className="mt-2 max-h-80 space-y-2 overflow-y-auto pr-1">
        {evidence.map((e) => (
          <li key={e.id} className={`border-l-4 pl-3 text-sm ${e.party === "claimant" ? "border-brand" : e.party === "respondent" ? "border-info" : "border-line"}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              {t(`party.${e.party}`)} · {formatDhaka(e.createdAt, locale)}
            </p>
            {e.text ? <p className="whitespace-pre-line">{e.text}</p> : null}
            {e.file ? (
              <button type="button" onClick={() => disputesAdmin.openFile(code, e.id)} className="font-semibold text-brand underline" data-testid="open-evidence">
                {t("openFile", { mime: e.file.mime })}
              </button>
            ) : null}
            {e.kind === "system" ? <p className="text-muted">{t(`system.${String((e.systemRef as { type?: string } | null)?.type ?? "snapshot")}`)}</p> : null}
            {e.hidden ? <p className="text-xs text-danger">{t("hidden", { reason: String(e.hiddenReason ?? "") })}</p> : null}
          </li>
        ))}
      </ol>

      {active ? (
        <div className="mt-4 space-y-4 border-t-2 border-line pt-4">
          {!held || !claimMine ? (
            <button type="button" onClick={() => claim.mutate()} disabled={claim.isPending || (Boolean(held) && !claimMine)} className="min-h-11 bg-brand px-4 font-bold text-white disabled:opacity-50" data-testid="claim-case">
              {held && !claimMine ? t("claimedBy", { name: held.by?.displayName ?? "" }) : t("claim")}
            </button>
          ) : (
            <p className="text-sm font-semibold text-brand">{t("yourClaim", { until: formatDhaka(held.expiresAt, locale) })}</p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addNote.mutate();
            }}
            className="flex gap-2"
          >
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} aria-label={t("note")} className={`${inputCls} flex-1`} />
            <button type="submit" disabled={note.trim().length < 2 || addNote.isPending} className="min-h-11 border-2 border-line px-3 font-semibold">
              {t("addNote")}
            </button>
          </form>

          {staffCanDecide || masterCanDecide ? (
            <fieldset className="space-y-2">
              <legend className="font-bold">{t("outcomeTitle")}</legend>
              {choices.map((o) => (
                <label key={o} className={`flex cursor-pointer items-center justify-between gap-3 border-2 p-2 text-sm ${outcome === o ? "border-brand" : "border-line"}`}>
                  <span className="flex items-center gap-2">
                    <input type="radio" name="outcome" value={o} checked={outcome === o} onChange={() => setOutcome(o)} data-testid={`outcome-${o}`} />
                    <span className="font-semibold">{t(`outcome.${o}`)}</span>
                  </span>
                  {previews[o] && d.money ? <span className="tabular-nums text-muted">{t("moves", { refund: money(previews[o].refund), net: money(previews[o].net), fee: money(previews[o].fee) })}</span> : null}
                </label>
              ))}
              {outcome === "custom" ? (
                <input value={custom} onChange={(e) => setCustom(e.target.value)} inputMode="decimal" placeholder={t("customPlaceholder", { max: money(d.held) })} aria-label={t("customRefund")} className={`${inputCls} w-full`} />
              ) : null}
              {plan && d.money ? <p className="text-sm">{t("planLine", { refund: money(plan.refund), net: money(plan.net), fee: money(plan.fee) })}</p> : null}
              {!isMaster && limits && !limits.canRefund ? <p className="text-sm text-muted">{t("noRefundPermission")}</p> : null}
              {!isMaster ? <p className="text-sm text-muted">{t("staffLimit", { limit: money(limits.staffRefundPoisha) })}</p> : null}
              <label htmlFor="decision-reason" className="block text-sm font-semibold text-muted">
                {t("reason")}
              </label>
              <textarea id="decision-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000} className="w-full border-2 border-line bg-surface px-3 py-2" />
              {problem ? <Notice tone="error">{t.has(`errors.${problem.code}`) ? t(`errors.${problem.code}`) : problem.title}</Notice> : null}
              <div className="flex flex-wrap gap-3">
                {staffCanDecide && !isMaster ? (
                  <>
                    <button type="button" disabled={!outcome || reason.trim().length < 2 || decide.isPending} onClick={() => decide.mutate()} className="min-h-11 bg-brand px-4 font-bold text-white disabled:opacity-50" data-testid="decide">
                      {t("decide")}
                    </button>
                    <button type="button" disabled={reason.trim().length < 2 || escalate.isPending} onClick={() => escalate.mutate()} className="min-h-11 border-2 border-line-strong px-4 font-semibold disabled:opacity-50" data-testid="escalate">
                      {t("escalate")}
                    </button>
                  </>
                ) : null}
                {masterCanDecide ? (
                  <button type="button" disabled={!outcome || reason.trim().length < 2} onClick={() => setAskCode(true)} className="min-h-11 bg-brand px-4 font-bold text-white disabled:opacity-50" data-testid="master-decide">
                    {t("masterDecide")}
                  </button>
                ) : null}
              </div>
            </fieldset>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 border-t-2 border-line pt-4 text-sm">
          {d.outcome ? (
            <p>
              <span className="font-bold">{t(`outcome.${d.outcome}`)}</span>
              {d.money ? ` · ${t("moves", { refund: money(d.refund), net: money((d.released ?? 0) - (d.fee ?? 0)), fee: money(d.fee) })}` : ""}
            </p>
          ) : null}
          {d.decisionReason ? <p className="mt-1 text-muted">{d.decisionReason}</p> : null}
        </div>
      )}
      {askCode ? (
        <CodeDialog
          title={t("masterTitle")}
          help={t("masterHelp")}
          onClose={() => setAskCode(false)}
          onConfirm={async (c) => {
            const token = await stepUp(c, "refund.large");
            set(await disputesAdmin.masterDecide(code, { outcome: outcome!, refund: refundOf(), reason: reason.trim(), version: d.version }, token));
            setAskCode(false);
          }}
        />
      ) : null}
    </div>
  );
}

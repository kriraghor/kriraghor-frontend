"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { Button, DataTable, DetailLayout, Field, FilterBar, Notice, PageTitle, Skeleton, Textarea, cn, type Column } from "@kriraghor/ui/kit";
import { formatTaka } from "@/lib/admin/finance";
import { stepUp } from "@/lib/admin/stepUp";
import { disputesAdmin, takaToPoisha, type Outcome, type StaffCase } from "@/lib/admin/trust";
import { useCursorList } from "@/lib/use-cursor-list";
import { useUrlFilters } from "@/lib/use-url-filters";
import { StatusBadge } from "../../StatusBadge";
import { CodeDialog } from "../CodeDialog";
import { formatDhaka, useAdminMe } from "../useAdminMe";

const VIEWS = ["active", "escalated", "resolved", "withdrawn"] as const;
type Row = Awaited<ReturnType<typeof disputesAdmin.list>>["items"][number];

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
  const { ready, me } = useAdminMe();
  // ?view= picks the queue; ?code= opens a case (links from notifications land here).
  const { values, set, params } = useUrlFilters({ view: { default: "active", allowed: VIEWS } });
  const view = values.view;
  const open = params.get("code");
  const can = (p: string) => Boolean(me && (me.isMaster || me.permissions.includes(p as never)));
  const allowed = can("resolve_reports") || can("manage_esports");
  const list = useCursorList<Row>(["admin-disputes", view], (cursor) => disputesAdmin.list({ status: view, cursor }), { enabled: ready && allowed });
  const money = (n: number | null | undefined) => formatTaka(n ?? 0, locale);

  const columns: Column<Row>[] = [
    { id: "code", header: t("col.code"), primary: true, sort: (d) => d.code, cell: (d) => <span className="font-mono">{d.code}</span> },
    {
      id: "about",
      header: t("col.about"),
      cell: (d) => (
        <>
          <span className="block font-semibold">{t(`category.${d.category}`)}</span>
          <span className="block font-mono text-xs text-muted">{d.sourceRef}</span>
        </>
      ),
    },
    {
      id: "status",
      header: t("col.status"),
      sort: (d) => d.status,
      cell: (d) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          <StatusBadge status={d.status} domain="dispute">
            {t(`status.${d.status}`)}
          </StatusBadge>
          {d.claimedByMe ? <span className="text-xs font-semibold text-brand-text">{t("mine")}</span> : d.claimedBy ? <span className="text-xs text-muted">{t("claimed")}</span> : null}
        </span>
      ),
    },
    {
      id: "due",
      header: t("col.due"),
      sort: (d) => d.dueAt,
      cell: (d) => <span className={cn("whitespace-nowrap", d.overdue && "font-semibold text-danger")}>{d.dueAt ? formatDhaka(d.dueAt, locale) : "–"}</span>,
    },
    { id: "held", header: t("col.held"), align: "end", sort: (d) => (d.money ? d.held : null), cell: (d) => (d.money ? money(d.held) : <span className="text-muted">{t("findings")}</span>) },
  ];

  return (
    <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
      <PageTitle title={t("title")} description={t("intro")} />
      {ready && !allowed ? (
        <Notice tone="error" className="mt-6 max-w-3xl">
          {t("noAccess")}
        </Notice>
      ) : (
        <DetailLayout
          className="mt-6"
          open={Boolean(open)}
          onClose={() => set({ code: null })}
          title={<span className="font-mono">{open}</span>}
          pane={open ? <CasePane key={open} code={open} isMaster={Boolean(me?.isMaster)} onChanged={() => qc.invalidateQueries({ queryKey: ["admin-disputes"] })} /> : null}
          width={520}
          testId="dispute-pane"
        >
          <div className="flex flex-col gap-4">
            <FilterBar chips={{ value: view, onChange: (v) => set({ view: v }), label: t("title"), options: VIEWS.map((v) => ({ value: v, label: t(`view.${v}`) })), testId: "dispute-views" }} />
            <DataTable
              label={t("title")}
              testId="disputes-queue"
              columns={columns}
              rows={list.rows}
              rowId={(d) => d.code}
              loading={list.loading}
              error={list.error}
              onRetry={list.retry}
              empty={{ title: t("empty") }}
              hasMore={list.hasMore}
              onMore={list.more}
              busy={list.busy}
              onRowClick={(d) => set({ code: d.code })}
              selectedId={open}
              rowTestId="dispute-row"
            />
          </div>
        </DetailLayout>
      )}
    </div>
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

  if (q.isPending) return <Skeleton className="h-96" />;
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
    <div data-testid="dispute-case">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-muted">{d.code}</p>
          <p className="text-lg font-bold">{t(`category.${d.category}`)}</p>
          <p className="text-sm text-muted">
            {String(src.groundName ?? src.shopName ?? src.tournamentTitle ?? d.sourceRef)}
            {src.start ? ` · ${formatDhaka(String(src.start), locale)}` : ""}
          </p>
        </div>
        <StatusBadge status={d.status} domain="dispute">
          {t(`status.${d.status}`)}
        </StatusBadge>
      </div>

      <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted">{t("claimant")}</dt>
        <dd className="text-right">{nameOf(q.data.claimant)}</dd>
        {q.data.respondent ? (
          <>
            <dt className="text-muted">{t("respondent")}</dt>
            <dd className="text-right">{nameOf(q.data.respondent)}</dd>
          </>
        ) : null}
        <dt className="text-muted">{t("paid")}</dt>
        <dd className="tabular text-right">{money(d.paid)}</dd>
        <dt className="text-muted">{t("held")}</dt>
        <dd className="tabular text-right font-bold" data-testid="case-held">
          {d.money ? money(d.held) : t("findings")}
        </dd>
      </dl>
      <p className="mt-3 rounded-control bg-info-soft px-3 py-2 text-sm">{t(`policy.${d.policyKey.replace(".", "_")}`, { advance: money(Number(policy.advance ?? 0)), fee: Number(policy.feeBps ?? 0) / 100 })}</p>
      {esports && src.matchId ? (
        <p className="mt-2 text-sm">
          <Link href={`/admin/esports?match=${String(src.matchId)}`} className="font-semibold text-brand-text underline">
            {t("esportsDesk")}
          </Link>
        </p>
      ) : null}
      {d.status === "escalated" ? (
        <Notice tone="warning" className="mt-3">
          {t("recommended", { outcome: d.recommendedOutcome ? t(`outcome.${d.recommendedOutcome}`) : "–", refund: money(d.recommendedRefund as number | null) })} {d.escalationNote ? `“${d.escalationNote}”` : ""}
        </Notice>
      ) : null}

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">{t("timeline")}</h3>
      <ol className="mt-2 max-h-80 space-y-2 overflow-y-auto pr-1">
        {evidence.map((e) => (
          <li key={e.id} className={cn("border-l-2 pl-3 text-sm", e.party === "claimant" ? "border-brand" : e.party === "respondent" ? "border-info" : "border-line")}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t(`party.${e.party}`)} · {formatDhaka(e.createdAt, locale)}
            </p>
            {e.text ? <p className="whitespace-pre-line">{e.text}</p> : null}
            {e.file ? (
              <Button type="button" variant="link" onClick={() => disputesAdmin.openFile(code, e.id)} data-testid="open-evidence">
                {t("openFile", { mime: e.file.mime })}
              </Button>
            ) : null}
            {e.kind === "system" ? <p className="text-muted">{t(`system.${String((e.systemRef as { type?: string } | null)?.type ?? "snapshot")}`)}</p> : null}
            {e.hidden ? <p className="text-xs text-danger">{t("hidden", { reason: String(e.hiddenReason ?? "") })}</p> : null}
          </li>
        ))}
      </ol>

      {active ? (
        <div className="mt-5 space-y-4 border-t border-line pt-4">
          {!held || !claimMine ? (
            <Button type="button" onClick={() => claim.mutate()} busy={claim.isPending} disabled={Boolean(held) && !claimMine} data-testid="claim-case">
              {held && !claimMine ? t("claimedBy", { name: held.by?.displayName ?? "" }) : t("claim")}
            </Button>
          ) : (
            <p className="text-sm font-semibold text-brand-text">{t("yourClaim", { until: formatDhaka(held.expiresAt, locale) })}</p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addNote.mutate();
            }}
            className="flex items-end gap-2"
          >
            <Field id="dispute-note" className="flex-1" label={t("note")} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} />
            <Button type="submit" variant="secondary" disabled={note.trim().length < 2} busy={addNote.isPending} className="min-h-12">
              {t("addNote")}
            </Button>
          </form>

          {staffCanDecide || masterCanDecide ? (
            <fieldset className="space-y-2">
              <legend className="mb-1 font-semibold">{t("outcomeTitle")}</legend>
              {choices.map((o) => (
                <label key={o} className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-control border p-3 text-sm transition-colors", outcome === o ? "border-brand bg-brand-soft" : "border-line hover:border-line-strong")}>
                  <span className="flex items-center gap-2">
                    <input type="radio" name="outcome" value={o} checked={outcome === o} onChange={() => setOutcome(o)} className="size-4 accent-[var(--kg-brand)]" data-testid={`outcome-${o}`} />
                    <span className="font-semibold">{t(`outcome.${o}`)}</span>
                  </span>
                  {previews[o] && d.money ? <span className="tabular text-muted">{t("moves", { refund: money(previews[o].refund), net: money(previews[o].net), fee: money(previews[o].fee) })}</span> : null}
                </label>
              ))}
              {outcome === "custom" ? <Field id="dispute-custom" label={t("customRefund")} value={custom} onChange={(e) => setCustom(e.target.value)} inputMode="decimal" placeholder={t("customPlaceholder", { max: money(d.held) })} /> : null}
              {plan && d.money ? <p className="text-sm">{t("planLine", { refund: money(plan.refund), net: money(plan.net), fee: money(plan.fee) })}</p> : null}
              {!isMaster && limits && !limits.canRefund ? <p className="text-sm text-muted">{t("noRefundPermission")}</p> : null}
              {!isMaster ? <p className="text-sm text-muted">{t("staffLimit", { limit: money(limits.staffRefundPoisha) })}</p> : null}
              <Textarea id="decision-reason" className="pt-2" label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000} />
              {problem ? <Notice tone="error">{t.has(`errors.${problem.code}`) ? t(`errors.${problem.code}`) : problem.title}</Notice> : null}
              <div className="flex flex-wrap gap-3 pt-1">
                {staffCanDecide && !isMaster ? (
                  <>
                    <Button type="button" disabled={!outcome || reason.trim().length < 2} busy={decide.isPending} onClick={() => decide.mutate()} data-testid="decide">
                      {t("decide")}
                    </Button>
                    <Button type="button" variant="secondary" disabled={reason.trim().length < 2} busy={escalate.isPending} onClick={() => escalate.mutate()} data-testid="escalate">
                      {t("escalate")}
                    </Button>
                  </>
                ) : null}
                {masterCanDecide ? (
                  <Button type="button" disabled={!outcome || reason.trim().length < 2} onClick={() => setAskCode(true)} data-testid="master-decide">
                    {t("masterDecide")}
                  </Button>
                ) : null}
              </div>
            </fieldset>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 border-t border-line pt-4 text-sm">
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

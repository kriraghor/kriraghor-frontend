"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { decisionProblem, hardFailures, HEARTBEAT_MS, moderation, QUEUE_POLL_MS, QUEUE_STATUSES, type Claimed, type Decision, type Detail, type Status } from "@/lib/admin/moderation";
import { stepUp } from "@/lib/admin/stepUp";
import { problemOf, type Problem } from "@kriraghor/api-client";
import { Badge, Button, Checkbox, DataTable, DetailLayout, Field, FilterBar, Notice, PageTitle, Select, Skeleton, cn, type Column } from "@kriraghor/ui/kit";
import { useUrlFilters } from "@/lib/use-url-filters";
import { StatusBadge } from "../../StatusBadge";
import { CodeDialog } from "../CodeDialog";
import { DocumentPanel } from "../kyc/DocumentPanel";
import { GameProfilePanel, TournamentPanel } from "../esports/EsportsPanels";
import { GroundPanel } from "../grounds/GroundPanel";
import { ProductPanel, ShopPanel } from "../market/MarketPanels";
import { HireProfilePanel } from "../hire/HireProfilePanel";
import { GymPanel } from "../gym/GymPanel";
import { OrganisationPanel } from "../esports/OrganisationPanel";
import { TournamentPanel as SportsTournamentPanel } from "../tournaments/TournamentPanel";
import { formatDhaka, useAdminMe } from "../useAdminMe";

const REVIEW_PERMISSIONS = ["approve_documents", "approve_listings"];
const KINDS = ["document", "game_profile", "esports_tournament", "ground", "shop", "product", "hire_profile", "gym", "organisation", "tournament"] as const;
const LOCKS = ["none", "me", "others"] as const;
const LOCK_LABEL = { none: "lockNone", me: "lockMe", others: "lockOthers" } as const;
type Row = Awaited<ReturnType<typeof moderation.queue>>["items"][number];

/**
 * /admin/moderation (M05 lite): one queue for every kind the reviewer may see (documents first),
 * oldest deadline first. Claim an item to review it: the lock is kept by a heartbeat while the pane
 * is open, rubric ticks are stored on the server, and the decision needs a reason for anything but
 * approve. Masters may approve over a failing check (step-up, Q46) and reopen a decision. Filters
 * and the open item live in the URL (?status= ?kind= ?claimed= ?overdue= ?q= ?id=); /admin/kyc
 * lands on ?kind=document.
 */
export function ModerationDesk() {
  const t = useTranslations("moderation");
  const locale = useLocale();
  const { ready, me } = useAdminMe();
  const qc = useQueryClient();
  const { values, set, clear, params } = useUrlFilters({
    status: { default: "pending_review", allowed: QUEUE_STATUSES },
    kind: { default: "", allowed: ["", ...KINDS] },
    claimed: { default: "", allowed: ["", ...LOCKS] },
    overdue: { default: "", allowed: ["", "true"] },
    q: { default: "" },
  });
  const status = values.status as Status;
  const { kind, q: search } = values;
  const claimed = values.claimed as Claimed | "";
  const overdue = values.overdue === "true";
  const selected = params.get("id");
  const canReview = Boolean(me && (me.isMaster || me.permissions.some((p) => REVIEW_PERMISSIONS.includes(p))));

  const query = { status, ...(kind ? { kind } : {}), ...(claimed ? { claimed } : {}), ...(overdue ? { overdue: "true" as const } : {}), ...(search.trim() ? { q: search.trim() } : {}) };
  // The queue endpoint has no cursor: one page, polled.
  const q = useQuery({ queryKey: ["mod-queue", query], enabled: canReview, refetchInterval: QUEUE_POLL_MS, queryFn: () => moderation.queue(query) });
  const stats = useQuery({ queryKey: ["mod-stats"], enabled: canReview, refetchInterval: QUEUE_POLL_MS, queryFn: () => moderation.stats() });
  // Shares the pane's query (same key), for the pane's title.
  const open = useQuery({ queryKey: ["mod-detail", selected], enabled: canReview && Boolean(selected), queryFn: () => moderation.get(selected!) });
  const refresh = () => void qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith("mod-") });
  const pending = status === "pending_review";
  const filtered = Boolean(kind || claimed || overdue || search || !pending);
  const openKind = open.data?.kind ?? q.data?.items.find((s) => s.id === selected)?.kind;

  const columns: Column<Row>[] = [
    {
      id: "item",
      header: t("item"),
      primary: true,
      sort: (s) => s.title,
      cell: (s) => (
        <>
          <span className="block font-semibold">{s.title}</span>
          <span className="block text-xs font-normal text-muted">
            {t(`kind.${s.kind}`)} · v{s.version}
          </span>
        </>
      ),
    },
    { id: "by", header: t("submittedBy"), hideBelow: "lg", sort: (s) => s.submittedBy.name, cell: (s) => s.submittedBy.name ?? "–" },
    {
      id: "when",
      header: pending ? t("deadline") : t("decided"),
      label: pending ? t("deadline") : t("decided"),
      sort: (s) => (s.sla ? s.slaDueAt : s.decidedAt),
      cell: (s) =>
        s.sla ? (
          <span className="whitespace-nowrap">
            <StatusBadge status={s.sla} domain="sla">
              {t(`sla.${s.sla}`)}
            </StatusBadge>
            <span className="block text-xs text-muted">{formatDhaka(s.slaDueAt, locale)}</span>
          </span>
        ) : (
          <span className="whitespace-nowrap">{formatDhaka(s.decidedAt, locale)}</span>
        ),
    },
    {
      id: "lock",
      header: t("lock"),
      cell: (s) => (s.claim ? <Badge tone={s.claim.mine ? "brand" : "neutral"}>{s.claim.mine ? t("lockedByYou") : (s.claim.name ?? t("someone"))}</Badge> : <span className="text-muted">–</span>),
    },
  ];

  return (
    <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
      <PageTitle title={t("title")} description={t("intro")} />
      {ready && !canReview ? (
        <Notice tone="error" className="mt-6 max-w-3xl">
          {t("noAccess")}
        </Notice>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="mod-stats">
            {(["inQueue", "overdue", "claimedByYou", "decidedToday"] as const).map((k) => (
              <div key={k} className="rounded-card border border-line bg-surface px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t(`kpi.${k}`)}</dt>
                <dd className={cn("mt-1 font-display text-2xl font-bold tabular", k === "overdue" && (stats.data?.overdue ?? 0) > 0 && "text-danger")}>{stats.data ? stats.data[k] : "–"}</dd>
              </div>
            ))}
          </dl>
          <DetailLayout
            className="mt-6"
            open={Boolean(selected)}
            onClose={() => set({ id: null })}
            title={openKind ? t(`kind.${openKind}`) : t("queue")}
            pane={selected ? <ReviewPane key={selected} id={selected} isMaster={Boolean(me?.isMaster)} onChanged={refresh} /> : null}
            width={560}
            testId="mod-pane"
          >
            <div className="flex flex-col gap-4">
              <FilterBar
                chips={{
                  value: status,
                  onChange: (v) => set({ status: v, ...(v !== "pending_review" ? { claimed: null, overdue: null } : {}) }),
                  label: t("queue"),
                  options: QUEUE_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`), count: s === "pending_review" ? stats.data?.inQueue : undefined })),
                  testId: "mod-status",
                }}
                search={{ value: search, onChange: (v) => set({ q: v.slice(0, 80) }), label: t("search"), testId: "mod-search" }}
                selects={[
                  { id: "kind", label: t("kindLabel"), value: kind, onChange: (v) => set({ kind: v }), anyLabel: t("allKinds"), options: KINDS.map((k) => ({ value: k, label: t(`kind.${k}`) })) },
                  ...(pending ? [{ id: "claimed", label: t("lockLabel"), value: claimed, onChange: (v: string) => set({ claimed: v }), anyLabel: t("lockAny"), options: LOCKS.map((l) => ({ value: l, label: t(LOCK_LABEL[l]) })) }] : []),
                ]}
                extra={pending ? <Checkbox id="mod-overdue" label={t("overdueOnly")} checked={overdue} onChange={(e) => set({ overdue: e.target.checked ? "true" : null })} className="sm:pb-0.5" /> : null}
                onClear={filtered ? clear : undefined}
              />
              <DataTable
                label={t("queue")}
                testId="mod-queue"
                columns={columns}
                rows={q.data?.items}
                rowId={(s) => s.id}
                loading={q.isPending}
                error={q.error}
                onRetry={() => void q.refetch()}
                onRowClick={(s) => set({ id: s.id })}
                selectedId={selected}
                rowTestId="mod-row"
              />
            </div>
          </DetailLayout>
        </>
      )}
    </div>
  );
}

function ReviewPane({ id, isMaster, onChanged }: { id: string; isMaster: boolean; onChanged: () => void }) {
  const t = useTranslations("moderation");
  const tk = useTranslations("kyc");
  const locale = useLocale();
  const qc = useQueryClient();
  const d = useQuery({ queryKey: ["mod-detail", id], queryFn: () => moderation.get(id) });
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const [reasonCode, setReasonCode] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [override, setOverride] = useState("");
  const [dialog, setDialog] = useState<"override" | "reopen" | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const mine = Boolean(d.data?.claim?.mine);

  // Keep the lock while the pane is open (moderation.heartbeat_sec); tell the reviewer when it is gone.
  useEffect(() => {
    if (!mine) return undefined;
    const beat = window.setInterval(() => {
      moderation.heartbeat(id).catch((err) => {
        setProblem(problemOf(err) ?? { code: "CLAIM_EXPIRED", title: t("lockLost"), status: 409 });
        void qc.invalidateQueries({ queryKey: ["mod-detail", id] });
      });
    }, HEARTBEAT_MS);
    return () => window.clearInterval(beat);
  }, [mine, id, qc, t]);

  if (d.isPending) return <Skeleton className="h-60" />;
  if (d.isError) return <Notice tone="error">{t("loadFailed")}</Notice>;
  const s = d.data;
  const open = s.status === "pending_review";
  const failing = hardFailures(s.checks);
  const missing = (s.rubric?.items ?? []).map((i) => i.key).filter((k) => !s.ticks.includes(k));
  const reason = s.reasons.find((r) => r.code === reasonCode) ?? null;
  const label = (r: { labelEn: string; labelBn: string }) => (locale === "bn" ? r.labelBn : r.labelEn);
  const checkLabel = (key: string) => (tk.has(`check.${key}`) ? tk(`check.${key}`) : key);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setProblem(null);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["mod-detail", id] });
      onChanged();
    } catch (err) {
      setProblem(problemOf(err) ?? { code: "UNKNOWN", title: t("failed"), status: 0 });
    } finally {
      setBusy(false);
    }
  }

  async function tick(key: string, on: boolean) {
    const ticks = on ? [...s.ticks, key] : s.ticks.filter((k) => k !== key);
    qc.setQueryData<Detail>(["mod-detail", id], { ...s, ticks });
    try {
      await moderation.ticks(id, ticks);
    } catch (err) {
      setProblem(problemOf(err) ?? { code: "UNKNOWN", title: t("failed"), status: 0 });
      await qc.invalidateQueries({ queryKey: ["mod-detail", id] });
    }
  }

  function decide(decision: Decision) {
    const local = decisionProblem(decision, { missing, failing, reason, reasonText, override: decision === "approve" ? override : "" });
    if (local) {
      setProblem({ code: local, title: t(`problem.${local}`), status: 0 });
      return;
    }
    if (decision === "approve" && failing.length) {
      setDialog("override");
      return;
    }
    void run(() => moderation.decide(id, decision === "approve" ? { decision } : { decision, reasonCode, reasonText: reasonText.trim() || undefined }));
  }

  const problemNotice = problem ? (
    <Notice tone="error" className="mt-3">
      {problem.title}
    </Notice>
  ) : null;

  return (
    <section aria-labelledby="mod-review-title" data-testid="mod-review">
      <h3 id="mod-review-title" className="text-lg font-bold">
        {s.title}
      </h3>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge status={s.status} domain="moderation">
          {t(`status.${s.status}`)}
        </StatusBadge>
        <span className="text-muted">
          {t(`kind.${s.kind}`)} · v{s.version} · {s.submittedBy.name ?? "–"}
        </span>
      </div>

      {open ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          {mine ? (
            <>
              <Badge tone="brand">{t("lockedByYou")}</Badge>
              <span className="text-muted">{t("lockUntil", { time: formatDhaka(s.claim?.expiresAt, locale) })}</span>
              <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void run(() => moderation.release(id))}>
                {t("release")}
              </Button>
            </>
          ) : s.claim ? (
            <>
              <Badge>{t("lockedBy", { name: s.claim.name ?? t("someone") })}</Badge>
              {isMaster ? (
                <Button type="button" variant="danger" size="sm" disabled={busy} onClick={() => void run(() => moderation.release(id, true))}>
                  {t("forceRelease")}
                </Button>
              ) : null}
            </>
          ) : (
            <Button type="button" busy={busy} onClick={() => void run(() => moderation.claim(id))} data-testid="mod-claim">
              {t("claim")}
            </Button>
          )}
        </div>
      ) : null}

      <h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">{t("checks")}</h4>
      <ul className="mt-2 space-y-1.5 text-sm">
        {s.checks.map((c) => (
          <li key={c.key} className="flex flex-wrap items-center gap-2">
            <Badge tone={c.result === "pass" ? "brand" : c.result === "fail" ? "danger" : "warning"}>{t(`result.${c.result}`)}</Badge>
            <span>{checkLabel(c.key)}</span>
            {c.severity === "hard" && c.result === "fail" ? <span className="font-semibold text-danger">{t("blocksApproval")}</span> : null}
            {c.detail ? <span className="text-muted">({c.detail})</span> : null}
          </li>
        ))}
      </ul>

      {s.kind === "document" && typeof s.payload.documentId === "string" ? <DocumentPanel documentId={s.payload.documentId} /> : null}
      {s.kind === "game_profile" ? <GameProfilePanel payload={s.payload} /> : null}
      {s.kind === "esports_tournament" ? <TournamentPanel payload={s.payload} /> : null}
      {s.kind === "ground" ? <GroundPanel payload={s.payload} /> : null}
      {s.kind === "shop" ? <ShopPanel payload={s.payload} /> : null}
      {s.kind === "product" ? <ProductPanel payload={s.payload} /> : null}
      {s.kind === "hire_profile" ? <HireProfilePanel payload={s.payload} /> : null}
      {s.kind === "gym" ? <GymPanel payload={s.payload} /> : null}
      {s.kind === "organisation" ? <OrganisationPanel payload={s.payload} /> : null}
      {s.kind === "tournament" ? <SportsTournamentPanel payload={s.payload} /> : null}

      {open && mine ? (
        <div className="mt-6 border-t border-line pt-4">
          <fieldset>
            <legend className="font-semibold">{t("rubric")}</legend>
            {(s.rubric?.items ?? []).map((i) => (
              <Checkbox key={i.key} id={`rubric-${i.key}`} className="mt-1" label={label(i)} checked={s.ticks.includes(i.key)} onChange={(e) => void tick(i.key, e.target.checked)} />
            ))}
          </fieldset>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Select id="mod-reason" label={t("reasonLabel")} value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
              <option value="">{t("chooseReason")}</option>
              {s.reasons.map((r) => (
                <option key={r.code} value={r.code}>
                  {label(r)}
                </option>
              ))}
            </Select>
            <Field id="mod-note" label={reason?.requiresText ? t("noteRequired") : t("note")} value={reasonText} onChange={(e) => setReasonText(e.target.value)} maxLength={500} />
          </div>
          {failing.length && isMaster ? <Field id="mod-override" className="mt-4" label={t("overrideLabel")} hint={t("overrideHelp")} value={override} onChange={(e) => setOverride(e.target.value)} maxLength={500} /> : null}
          {problemNotice}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={() => decide("approve")} data-testid="mod-approve">
              {failing.length && isMaster ? t("approveOverride") : t("approve")}
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => decide("request_changes")}>
              {t("askChanges")}
            </Button>
            <Button type="button" variant="danger" disabled={busy} onClick={() => decide("reject")}>
              {t("reject")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {problemNotice}
          {!open ? (
            <div className="mt-5 text-sm">
              {s.decidedBy ? <p>{t("decidedBy", { name: s.decidedBy.name ?? "–", time: formatDhaka(s.decidedAt, locale) })}</p> : null}
              {s.reasonCode ? (
                <p className="mt-1">
                  {label(s.reasons.find((r) => r.code === s.reasonCode) ?? { labelEn: s.reasonCode, labelBn: s.reasonCode })}
                  {s.reasonText ? `: ${s.reasonText}` : ""}
                </p>
              ) : null}
              {s.override ? <p className="mt-1 font-semibold text-danger">{t("overridden", { name: s.override.by ?? "–", reason: s.override.reason ?? "" })}</p> : null}
              {s.status === "approved" ? <p className="mt-1 text-muted">{s.appliedAt ? t("applied") : t("notApplied")}</p> : null}
              {isMaster && (s.status === "approved" || s.status === "rejected") ? (
                <Button type="button" variant="secondary" className="mt-3" onClick={() => setDialog("reopen")}>
                  {t("reopen")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <h4 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted">{t("history")}</h4>
      <ol className="mt-2 space-y-1 text-sm">
        {s.history.map((h) => (
          <li key={h.id}>
            v{h.version} · {t(`status.${h.status}`)} · {formatDhaka(h.submittedAt, locale)}
            {h.decidedBy ? ` · ${h.decidedBy}` : ""}
          </li>
        ))}
      </ol>

      {dialog === "override" ? (
        <CodeDialog
          title={t("overrideTitle")}
          help={t("overrideDialogHelp", { checks: failing.map(checkLabel).join(", ") })}
          onClose={() => setDialog(null)}
          onConfirm={async (code) => {
            const token = await stepUp(code, "moderation.override");
            await moderation.decide(id, { decision: "approve", override: override.trim() }, token);
            setDialog(null);
            await qc.invalidateQueries({ queryKey: ["mod-detail", id] });
            onChanged();
          }}
        />
      ) : null}
      {dialog === "reopen" ? (
        <CodeDialog
          title={t("reopenTitle")}
          help={t("reopenHelp")}
          onClose={() => setDialog(null)}
          onConfirm={async (code) => {
            if (reopenReason.trim().length < 3) throw { code: "VALIDATION_FAILED", title: t("reasonNeeded"), status: 422 };
            const token = await stepUp(code, "moderation.override");
            await moderation.reopen(id, reopenReason.trim(), token);
            setDialog(null);
            setReopenReason("");
            await qc.invalidateQueries({ queryKey: ["mod-detail", id] });
            onChanged();
          }}
        >
          <Field id="reopen-reason" className="mt-4" label={t("reopenReason")} value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} maxLength={500} />
        </CodeDialog>
      ) : null}
    </section>
  );
}

"use client";

import { Suspense, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { EyeSlash, Star } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { Badge, Button, DataTable, DetailLayout, FilterBar, Notice, PageTitle, ReasonDialog, Skeleton, Textarea, type Column } from "@kriraghor/ui/kit";
import { reportsAdmin, reviewsAdmin, type ReportAction } from "@/lib/admin/trust";
import { useCursorList } from "@/lib/use-cursor-list";
import { useUrlFilters } from "@/lib/use-url-filters";
import { formatDhaka, useAdminMe } from "../useAdminMe";

type SubjectType = "ground" | "booking" | "user" | "review" | "esports_tournament" | "tournament_post" | "tournament_comment";
type ReportRow = Awaited<ReturnType<typeof reportsAdmin.list>>["items"][number];
type ReviewRow = Awaited<ReturnType<typeof reviewsAdmin.list>>["items"][number];

const REPORT_VIEWS = ["open", "escalated"] as const;
const REVIEW_VIEWS = ["held", "hidden", "published"] as const;

/** A report row's id in the URL (?id=type:uuid): one row per reported subject. */
const rowKey = (r: { subjectType: string; subjectId: string }) => `${r.subjectType}:${r.subjectId}`;
const subjectName = (r: ReportRow) => {
  const s = r.subject as Record<string, unknown> | null;
  return String(s?.name ?? s?.displayName ?? s?.title ?? s?.text ?? s?.body ?? r.subjectId).slice(0, 80);
};

/**
 * /admin/reports (M17 FR-17 to FR-19): one row per reported subject, flagged first (enough NID-verified
 * reporters: a review is already hidden, other subjects wait for us), then the oldest. One action
 * resolves every open report of the subject; suspending an account needs manage_users.
 */
export function ReportsDesk() {
  // The desk keeps its view and the open subject in the URL (useSearchParams), so it renders inside Suspense.
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-8 h-40 max-w-[1320px]" />}>
      <Reports />
    </Suspense>
  );
}

function Reports() {
  const t = useTranslations("reportsDesk");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready, me } = useAdminMe();
  const { values, set, params } = useUrlFilters({ status: { default: "open", allowed: REPORT_VIEWS } });
  const status = values.status as (typeof REPORT_VIEWS)[number];
  const openKey = params.get("id");
  const allowed = Boolean(me && (me.isMaster || me.permissions.includes("resolve_reports" as never)));
  // The reports endpoint has no cursor: one page (limit 100), flagged first.
  const q = useQuery({ queryKey: ["admin-reports", status], enabled: ready && allowed, queryFn: () => reportsAdmin.list(status) });
  const [type, subjectId] = openKey?.includes(":") ? (openKey.split(":", 2) as [SubjectType, string]) : [null, null];
  const row = q.data?.items.find((r) => rowKey(r) === openKey) ?? null;

  const columns: Column<ReportRow>[] = [
    {
      id: "subject",
      header: t("col.subject"),
      primary: true,
      cell: (r) => (
        <>
          <span className="block font-semibold">
            {t(`subject.${r.subjectType}`)}: {subjectName(r)}
          </span>
          <span className="block text-xs text-muted">{r.reasons.map((x) => t(`reason.${x}`)).join(", ")}</span>
        </>
      ),
    },
    {
      id: "reports",
      header: t("reports"),
      sort: (r) => r.reports,
      cell: (r) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          {r.flagged ? <Badge tone="danger">{t("flagged")}</Badge> : null}
          <span className="tabular">{t("counts", { reports: r.reports, eligible: r.eligible })}</span>
        </span>
      ),
    },
    { id: "due", header: t("col.due"), sort: (r) => String(r.dueAt ?? ""), cell: (r) => <span className="whitespace-nowrap text-muted">{formatDhaka(String(r.dueAt), locale)}</span> },
  ];

  return (
    <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
      <PageTitle title={t("title")} description={t("intro", { n: q.data?.threshold ?? 3 })} />
      {ready && !allowed ? (
        <Notice tone="error" className="mt-6 max-w-3xl">
          {t("noAccess")}
        </Notice>
      ) : (
        <DetailLayout
          className="mt-6"
          open={Boolean(type && subjectId)}
          onClose={() => set({ id: null })}
          title={type ? t(`subject.${type}`) : ""}
          pane={
            type && subjectId ? (
              <SubjectPane
                key={openKey}
                type={type}
                subjectId={subjectId}
                reports={row?.reports}
                onDone={() => (set({ id: null }), qc.invalidateQueries({ queryKey: ["admin-reports"] }))}
              />
            ) : null
          }
          width={480}
          testId="report-pane"
        >
          <div className="flex flex-col gap-4">
            <FilterBar chips={{ value: status, onChange: (v) => set({ status: v }), label: t("title"), options: REPORT_VIEWS.map((s) => ({ value: s, label: t(`view.${s}`) })), testId: "report-views" }} />
            <DataTable
              label={t("title")}
              testId="reports-queue"
              columns={columns}
              rows={q.data?.items}
              rowId={rowKey}
              loading={q.isPending}
              error={q.error}
              onRetry={() => void q.refetch()}
              empty={{ title: t("empty") }}
              onRowClick={(r) => set({ id: rowKey(r) })}
              selectedId={openKey}
              rowTestId="report-row"
            />
          </div>
        </DetailLayout>
      )}
    </div>
  );
}

function SubjectPane({ type, subjectId, reports, onDone }: { type: SubjectType; subjectId: string; reports: number | undefined; onDone: () => void }) {
  const t = useTranslations("reportsDesk");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["admin-report-subject", type, subjectId], queryFn: () => reportsAdmin.subject(type, subjectId) });
  const [note, setNote] = useState("");
  const resolve = useMutation({ mutationFn: (action: ReportAction) => reportsAdmin.resolve({ subjectType: type, subjectId, action, note: note.trim() }), onSuccess: onDone });
  const escalate = useMutation({ mutationFn: () => reportsAdmin.escalate({ subjectType: type, subjectId, note: note.trim() }), onSuccess: onDone });
  const problem = problemOf(resolve.error) ?? problemOf(escalate.error);
  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data) return <Notice tone="error">{t("loadFailed")}</Notice>;
  const s = (q.data.subject ?? {}) as Record<string, unknown>;
  // A subject opened from a link (not in the loaded queue) counts its reports from the subject itself.
  const count = reports ?? q.data.items.length;

  return (
    <div data-testid="report-subject">
      <p className="text-lg font-bold">{String(s.name ?? s.displayName ?? s.code ?? s.title ?? "")}</p>
      {s.text ? <p className="mt-2 whitespace-pre-line rounded-control bg-surface-2 px-3 py-2 text-sm">{String(s.text)}</p> : null}
      {s.status ? <p className="mt-2 text-sm text-muted">{t("subjectStatus", { status: String(s.status) })}</p> : null}
      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">{t("reports")}</h3>
      <ul className="mt-1 max-h-64 divide-y divide-line overflow-y-auto text-sm">
        {q.data.items.map((r) => {
          const x = r as { code: string; reasonCode: string; note: string | null; eligible: boolean; status: string; reporter: { displayName: string | null }; createdAt: string };
          return (
            <li key={x.code} className="py-2">
              <span className="font-semibold">{t(`reason.${x.reasonCode}`)}</span> · {x.reporter.displayName ?? "–"} · {formatDhaka(x.createdAt, locale)}{" "}
              {x.eligible ? <Badge tone="brand">{t("eligible")}</Badge> : null}
              {x.note ? <p className="text-muted">{x.note}</p> : null}
            </li>
          );
        })}
      </ul>
      <Textarea id="report-note" className="mt-4" label={t("note")} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
      {problem ? (
        <Notice tone="error" className="mt-3">
          {problem.title}
        </Notice>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {q.data.actions.map((a) => (
          <Button key={a} type="button" size="sm" variant={a === "no_violation" ? "secondary" : "primary"} disabled={note.trim().length < 2 || resolve.isPending} onClick={() => resolve.mutate(a as ReportAction)} data-testid={`resolve-${a}`}>
            {t(`action.${a}`)}
          </Button>
        ))}
        {count && !q.data.items.every((r) => (r as { status: string }).status === "escalated") ? (
          <Button type="button" size="sm" variant="secondary" disabled={note.trim().length < 2} busy={escalate.isPending} onClick={() => escalate.mutate()}>
            {t("escalate")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** /admin/reviews (M17 FR-26): reviews waiting for a check (links, phone numbers), hidden ones, and published. */
export function ReviewsDesk() {
  // The desk keeps its view in the URL (useSearchParams), so it renders inside Suspense.
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-8 h-40 max-w-[1320px]" />}>
      <Reviews />
    </Suspense>
  );
}

function Reviews() {
  const t = useTranslations("reviewsDesk");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready, me } = useAdminMe();
  const { values, set } = useUrlFilters({ status: { default: "held", allowed: REVIEW_VIEWS } });
  const status = values.status as (typeof REVIEW_VIEWS)[number];
  const [hiding, setHiding] = useState<ReviewRow | null>(null);
  const allowed = Boolean(me && (me.isMaster || me.permissions.includes("resolve_reports" as never)));
  const list = useCursorList<ReviewRow>(["admin-reviews", status], (cursor) => reviewsAdmin.list(status, cursor), { enabled: ready && allowed });
  const act = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: "hide" | "restore" | "publish"; reason?: string }) =>
      action === "hide" ? reviewsAdmin.hide(id, reason ?? "") : action === "restore" ? reviewsAdmin.restore(id) : reviewsAdmin.publish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reviews"] }),
  });

  const columns: Column<ReviewRow>[] = [
    {
      id: "review",
      header: t("col.review"),
      primary: true,
      cell: (r) => (
        <>
          <span className="inline-flex items-center gap-0.5 text-prize-text">
            {Array.from({ length: r.stars }, (_, i) => (
              <Star key={i} size={14} weight="fill" aria-hidden />
            ))}
            <span className="sr-only">{`${r.stars}/5`}</span>
          </span>
          {r.text ? <p className="mt-1 max-w-[65ch] whitespace-pre-line font-normal">{r.text}</p> : null}
          {r.heldReason ? <span className="mt-1 block text-xs font-semibold text-muted">{t(`held.${r.heldReason}`)}</span> : null}
          {r.hiddenReason ? <span className="mt-1 block text-sm font-normal text-danger">{t("hiddenFor", { reason: String(r.hiddenReason) })}</span> : null}
        </>
      ),
    },
    { id: "author", header: t("col.author"), cell: (r) => r.author.displayName ?? "–" },
    { id: "when", header: t("col.when"), sort: (r) => r.createdAt, cell: (r) => <span className="whitespace-nowrap">{formatDhaka(r.createdAt, locale)}</span> },
    {
      id: "do",
      header: <span className="sr-only">{t("publish")}</span>,
      label: "",
      align: "end",
      cell: (r) =>
        status === "held" ? (
          <Button type="button" size="sm" busy={act.isPending && act.variables?.id === r.id && act.variables.action === "publish"} onClick={() => act.mutate({ id: r.id, action: "publish" })} data-testid="publish-review">
            {t("publish")}
          </Button>
        ) : status === "hidden" ? (
          <Button type="button" size="sm" variant="secondary" busy={act.isPending && act.variables?.id === r.id && act.variables.action === "restore"} onClick={() => act.mutate({ id: r.id, action: "restore" })}>
            {t("restore")}
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
      <PageTitle title={t("title")} description={t("intro")} />
      {ready && !allowed ? (
        <Notice tone="error" className="mt-6 max-w-3xl">
          {t("noAccess")}
        </Notice>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <FilterBar chips={{ value: status, onChange: (v) => set({ status: v }), label: t("title"), options: REVIEW_VIEWS.map((s) => ({ value: s, label: t(`view.${s}`) })), testId: "review-views" }} />
          {act.error && !hiding ? <Notice tone="error">{problemOf(act.error)?.title}</Notice> : null}
          <DataTable
            label={t("title")}
            testId="reviews-queue"
            columns={columns}
            rows={list.rows}
            rowId={(r) => r.id}
            loading={list.loading}
            error={list.error}
            onRetry={list.retry}
            empty={{ title: t("empty") }}
            hasMore={list.hasMore}
            onMore={list.more}
            busy={list.busy}
            rowTestId="review-row"
            rowActions={(r) => (status === "hidden" ? [] : [{ label: t("hide"), icon: <EyeSlash />, danger: true, onSelect: () => (act.reset(), setHiding(r)) }])}
          />
        </div>
      )}
      <ReasonDialog
        open={Boolean(hiding)}
        onOpenChange={(o) => (o ? undefined : setHiding(null))}
        title={t("hide")}
        description={hiding?.text ? `“${hiding.text.slice(0, 120)}”` : undefined}
        label={t("reason")}
        confirmLabel={t("hide")}
        danger
        minLength={2}
        busy={act.isPending}
        error={hiding && act.error ? problemOf(act.error)?.title : undefined}
        onConfirm={(reason) => hiding && act.mutate({ id: hiding.id, action: "hide", reason }, { onSuccess: () => setHiding(null) })}
        testId="hide-review"
      />
    </div>
  );
}

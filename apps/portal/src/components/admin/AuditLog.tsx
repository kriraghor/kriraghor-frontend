"use client";

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { DownloadSimple } from "@phosphor-icons/react";
import { api, problemOf } from "@kriraghor/api-client";
import { DatePicker } from "@kriraghor/ui/date";
import { Badge, Button, Checkbox, DataTable, DetailLayout, Dialog, Field, FilterBar, Notice, Skeleton, type Column } from "@kriraghor/ui/kit";
import { stepUp } from "@/lib/admin/stepUp";
import { diffRows, toApiFilters, type AuditEntry, type AuditFilters } from "@/lib/admin/audit";
import { useCursorList } from "@/lib/use-cursor-list";
import { useUrlFilters } from "@/lib/use-url-filters";
import { StatusBadge } from "../StatusBadge";
import { CodeDialog } from "./CodeDialog";
import { formatDhaka, useAdminMe } from "./useAdminMe";

const MODULES = ["M01", "M03", "M04"] as const;
const SEVERITIES = ["info", "notice", "critical"] as const;

/** Filters kept in the URL; empty dates mean the API default (the last 7 days; no clock reads during prerender). */
const SPEC = {
  from: { default: "" },
  to: { default: "" },
  action: { default: "" },
  module: { default: "", allowed: ["", ...MODULES] },
  severity: { default: "", allowed: ["", ...SEVERITIES] },
  entityType: { default: "" },
  entityId: { default: "" },
  actorId: { default: "" },
  stepUp: { default: "", allowed: ["", "1"] },
};

/** M04 §4 Audit log (master): filters, newest-first table with cursor paging, entry pane, CSV export. */
export function AuditLog() {
  // The filters and the open entry live in the URL (useSearchParams), so the desk renders inside Suspense.
  return (
    <Suspense fallback={<div className="mx-auto mt-8 h-40 max-w-[1320px] kg-shimmer rounded-card bg-surface-2" />}>
      <AuditDesk />
    </Suspense>
  );
}

function AuditDesk() {
  const t = useTranslations("audit");
  const locale = useLocale();
  const { ready } = useAdminMe();
  const { values: v, set, clear, params } = useUrlFilters(SPEC);
  const openId = params.get("id");
  const [exporting, setExporting] = useState(false);
  const filters: AuditFilters = {
    from: v.from || undefined,
    to: v.to || undefined,
    action: v.action || undefined,
    module: v.module || undefined,
    severity: (v.severity || undefined) as AuditFilters["severity"],
    entityType: v.entityType || undefined,
    entityId: v.entityId || undefined,
    actorId: v.actorId || undefined,
    stepUp: v.stepUp === "1" || undefined,
  };
  const anything = Object.keys(SPEC).some((k) => v[k as keyof typeof SPEC] !== "");

  const list = useCursorList<AuditEntry>(
    ["audit-logs", filters],
    async (cursor) => {
      const query = { ...toApiFilters(filters), limit: 50, ...(cursor ? { cursor } : {}) };
      const { data, error } = await api("admin").GET("/admin/audit-logs", { params: { query: query as never } });
      if (error) throw error;
      return data;
    },
    { enabled: ready },
  );

  const columns: Column<AuditEntry>[] = [
    { id: "when", header: t("when"), sort: (r) => r.occurredAt, cell: (r) => <span className="whitespace-nowrap">{formatDhaka(r.occurredAt, locale)}</span> },
    {
      id: "actor",
      header: t("actor"),
      sort: (r) => r.actor.name,
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-2">
          {r.actor.name ?? t("system")}
          {r.actor.role ? <Badge>{r.actor.role}</Badge> : null}
        </span>
      ),
    },
    {
      id: "summary",
      header: t("summary"),
      primary: true,
      cell: (r) => (
        <>
          <span className="inline-flex flex-wrap items-center gap-2">
            {locale === "bn" ? r.summary.bn : r.summary.en}
            {r.stepUp ? <Badge tone="brand">{t("stepUpBadge")}</Badge> : null}
          </span>
          <span className="block font-mono text-xs font-normal text-muted">{r.action}</span>
        </>
      ),
    },
    { id: "entity", header: t("entity"), hideBelow: "lg", cell: (r) => <span className="font-mono text-xs">{[r.entity.type, r.entity.code ?? r.entity.id].filter(Boolean).join(" · ")}</span> },
    { id: "severity", header: t("severity"), sort: (r) => SEVERITIES.indexOf(r.severity), cell: (r) => <StatusBadge status={r.severity} domain="severity">{t(`severities.${r.severity}`)}</StatusBadge> },
    { id: "ip", header: t("ip"), hideBelow: "xl", cell: (r) => <span className="font-mono text-xs">{r.ip ?? ""}</span> },
  ];

  return (
    <>
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
        <div className="flex flex-wrap items-start gap-4">
          <div>
            <h1 className="text-3xl font-extrabold">{t("title")}</h1>
            <p className="mt-2 max-w-3xl text-muted">{t("intro")}</p>
          </div>
          <div className="ml-auto">
            <Button type="button" icon={<DownloadSimple size={18} aria-hidden />} onClick={() => setExporting(true)}>
              {t("export")}
            </Button>
          </div>
        </div>

        <FilterBar
          className="mt-6"
          search={{ value: v.action, onChange: (x) => set({ action: x }), label: t("action"), placeholder: "setting.changed" }}
          selects={[
            { id: "module", label: t("module"), value: v.module, onChange: (x) => set({ module: x }), anyLabel: t("any"), options: MODULES.map((m) => ({ value: m, label: m })) },
            { id: "severity", label: t("severity"), value: v.severity, onChange: (x) => set({ severity: x }), anyLabel: t("any"), options: SEVERITIES.map((s) => ({ value: s, label: t(`severities.${s}`) })) },
          ]}
          extra={
            <>
              <DatePicker id="audit-from" className="w-full sm:w-52" label={t("from")} value={v.from} onChange={(x) => set({ from: x })} />
              <DatePicker id="audit-to" className="w-full sm:w-52" label={t("to")} value={v.to} onChange={(x) => set({ to: x })} />
              <TextFilter id="audit-entity-type" label={t("entityType")} placeholder="platform_setting" value={v.entityType} onCommit={(x) => set({ entityType: x })} />
              <TextFilter id="audit-entity-id" label={t("entityId")} value={v.entityId} onCommit={(x) => set({ entityId: x })} />
              <TextFilter id="audit-actor-id" label={t("actorId")} value={v.actorId} onCommit={(x) => set({ actorId: x })} />
              <Checkbox id="audit-step-up" label={t("stepUpOnly")} checked={v.stepUp === "1"} onChange={(e) => set({ stepUp: e.target.checked ? "1" : "" })} />
              {anything ? (
                <Button type="button" variant="ghost" onClick={clear}>
                  {t("reset")}
                </Button>
              ) : null}
            </>
          }
        />
        <p className="mt-2 text-xs text-muted">{t("actionHint")}</p>

        <DetailLayout className="mt-4" open={Boolean(openId)} onClose={() => set({ id: null })} title={t("detailTitle")} width={520} testId="audit-entry" pane={openId ? <EntryDetail id={openId} /> : null}>
          <DataTable
            label={t("title")}
            testId="audit-table"
            columns={columns}
            rows={list.rows}
            rowId={(r) => r.id}
            rowTestId="audit-row"
            loading={!ready || list.loading}
            error={list.error}
            onRetry={list.retry}
            empty={{ title: t("empty") }}
            hasMore={list.hasMore}
            onMore={list.more}
            busy={list.busy}
            selectedId={openId}
            onRowClick={(r) => set({ id: r.id })}
          />
        </DetailLayout>
      </div>

      {exporting ? <ExportDialog filters={filters} onClose={() => setExporting(false)} /> : null}
    </>
  );
}

/** A text filter that applies on Enter or when the field loses focus (not on every key). */
function TextFilter({ id, label, value, placeholder, onCommit }: { id: string; label: string; value: string; placeholder?: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  // A change from outside (Reset, the back button) replaces what is typed.
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  const commit = () => {
    if (draft.trim() !== value) onCommit(draft.trim());
  };
  return (
    <Field
      id={id}
      className="w-full sm:w-48"
      label={label}
      value={draft}
      placeholder={placeholder}
      inputClassName="font-mono text-sm"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
      }}
    />
  );
}

function EntryDetail({ id }: { id: string }) {
  const t = useTranslations("audit");
  const locale = useLocale();
  const q = useQuery({
    queryKey: ["audit-entry", id],
    queryFn: async () => {
      const { data, error } = await api("admin").GET("/admin/audit-logs/{id}", { params: { path: { id } } });
      if (error) throw error;
      return data;
    },
  });

  const e = q.data;
  if (q.isError) return <Notice tone="error">{problemOf(q.error)?.title ?? "Error"}</Notice>;
  if (!e)
    return (
      <div role="status" aria-label={t("loading")} className="flex flex-col gap-2">
        <Skeleton className="h-6" />
        <Skeleton className="h-32" />
        <Skeleton className="h-24" />
      </div>
    );
  const chainText = !e.chain.sealed ? t("chainPending") : e.chain.intact ? t("chainIntact", { seq: e.chain.seq ?? 0 }) : t("chainBroken", { seq: e.chain.seq ?? 0 });
  const broken = e.chain.sealed && !e.chain.intact;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-semibold">{locale === "bn" ? e.summary.bn : e.summary.en}</p>
        <p className="text-sm text-muted">
          {formatDhaka(e.occurredAt, locale)} · {e.actor.name ?? t("system")} · <span className="font-mono">{e.action}</span>
        </p>
      </div>
      <div className="overflow-hidden rounded-card border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">
                {t("field")}
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                {t("before")}
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                {t("after")}
              </th>
            </tr>
          </thead>
          <tbody>
            {diffRows(e.before, e.after).map((d) => (
              <tr key={d.field} className={`border-t border-line ${d.changed ? "font-semibold" : "text-muted"}`}>
                <th scope="row" className="px-3 py-1.5 font-mono text-xs font-normal">
                  {d.field}
                </th>
                <td className="break-all px-3 py-1.5">{d.before}</td>
                <td className="break-all px-3 py-1.5">{d.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        {[
          [t("reason"), e.reason, false],
          [t("ip"), e.ip, false],
          [t("requestId"), e.requestId, false],
          [t("sessionId"), e.sessionId, false],
          [t("userAgent"), e.userAgent, false],
          [t("chain"), chainText, broken],
        ].map(([k, val, bad]) => (
          <div key={String(k)} className="contents">
            <dt className="font-semibold text-muted">{k}</dt>
            <dd className={`break-all ${bad ? "font-bold text-danger" : ""}`}>{val || "–"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ExportDialog({ filters, onClose }: { filters: AuditFilters; onClose: () => void }) {
  const t = useTranslations("audit");
  const [exportId, setExportId] = useState<string | null>(null);
  const status = useQuery({
    queryKey: ["audit-export", exportId],
    enabled: Boolean(exportId),
    refetchInterval: (query) => (["ready", "failed", "expired"].includes(query.state.data?.status ?? "") ? false : 1500),
    queryFn: async () => {
      const { data, error } = await api("admin").GET("/admin/audit-logs/exports/{id}", { params: { path: { id: exportId! } } });
      if (error) throw error;
      return data;
    },
  });

  async function download() {
    const { data, error } = await api("admin").GET("/admin/audit-logs/exports/{id}/download", { params: { path: { id: exportId! } }, parseAs: "blob" });
    if (error || !data) return;
    const url = URL.createObjectURL(data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kriraghor-audit-${exportId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!exportId) {
    return (
      <CodeDialog
        title={t("exportTitle")}
        help={t("exportHelp")}
        confirmLabel={t("export")}
        onClose={onClose}
        onConfirm={async (code) => {
          const token = await stepUp(code, "audit.export");
          const { data, error } = await api("admin").POST("/admin/audit-logs/exports", {
            params: { header: { "x-step-up": token } },
            body: { filters: toApiFilters(filters) as never },
          });
          if (error || !data) throw problemOf(error);
          setExportId(data.id);
        }}
      />
    );
  }

  const s = status.data;
  return (
    <Dialog
      open
      onOpenChange={(o) => (o ? undefined : onClose())}
      title={t("exportTitle")}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("close")}
          </Button>
          {s?.status === "ready" ? (
            <Button type="button" icon={<DownloadSimple size={18} aria-hidden />} onClick={() => void download()}>
              {t("download")}
            </Button>
          ) : null}
        </>
      }
    >
      <p role="status" data-testid="export-status">
        {s?.status === "ready" ? t("exportReady", { count: s.rowCount ?? 0 }) : s?.status === "failed" ? t("exportFailed") : t("exportPreparing")}
      </p>
    </Dialog>
  );
}

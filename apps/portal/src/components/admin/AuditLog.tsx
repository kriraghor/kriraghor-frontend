"use client";

import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { api, problemOf } from "@kriraghor/api-client";
import { stepUp } from "@/lib/admin/stepUp";
import { diffRows, toApiFilters, type AuditEntry, type AuditFilters } from "@/lib/admin/audit";
import { Button, Notice } from "../ui";
import { AdminSubnav } from "./AdminSubnav";
import { CodeDialog } from "./CodeDialog";
import { formatDhaka, useAdminMe } from "./useAdminMe";

const SEVERITY_TONE = { info: "bg-surface-2 text-ink", notice: "bg-amber-100 text-amber-900", critical: "bg-danger text-white" } as const;

/** M04 §4 Audit log (master): filters, newest-first table with cursor paging, entry drawer, CSV export. */
export function AuditLog() {
  const t = useTranslations("audit");
  const locale = useLocale();
  const { ready } = useAdminMe();
  // Empty dates mean the API default: the last 7 days (no clock reads during prerender).
  const initial: AuditFilters = {};
  const [draft, setDraft] = useState<AuditFilters>(initial);
  const [filters, setFilters] = useState<AuditFilters>(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const q = useInfiniteQuery({
    queryKey: ["audit-logs", filters],
    enabled: ready,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const query = { ...toApiFilters(filters), limit: 50, ...(pageParam ? { cursor: pageParam } : {}) };
      const { data, error } = await api("admin").GET("/admin/audit-logs", { params: { query: query as never } });
      if (error) throw error;
      return data;
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];

  const field = (name: keyof AuditFilters, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="flex flex-col text-xs font-semibold text-muted">
      {label}
      <input
        {...props}
        value={String(draft[name] ?? "")}
        onChange={(e) => setDraft((d) => ({ ...d, [name]: e.target.value }))}
        className="min-h-11 border-2 border-line bg-surface px-3 text-sm text-ink"
      />
    </label>
  );

  return (
    <>
      <AdminSubnav />
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
        <div className="flex flex-wrap items-start gap-4">
          <div>
            <h1 className="text-3xl font-extrabold">{t("title")}</h1>
            <p className="mt-2 max-w-3xl text-muted">{t("intro")}</p>
          </div>
          <div className="ml-auto">
            <Button type="button" onClick={() => setExporting(true)}>
              {t("export")}
            </Button>
          </div>
        </div>

        <form
          className="mt-6 grid gap-3 border-2 border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            setFilters(draft);
          }}
          aria-label={t("title")}
        >
          {field("from", t("from"), { type: "date" })}
          {field("to", t("to"), { type: "date" })}
          {field("action", t("action"), { placeholder: "setting.changed", title: t("actionHint") })}
          <label className="flex flex-col text-xs font-semibold text-muted">
            {t("module")}
            <select value={draft.module ?? ""} onChange={(e) => setDraft((d) => ({ ...d, module: e.target.value }))} className="min-h-11 border-2 border-line bg-surface px-3 text-sm text-ink">
              <option value="">{t("any")}</option>
              {["M01", "M03", "M04"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs font-semibold text-muted">
            {t("severity")}
            <select value={draft.severity ?? ""} onChange={(e) => setDraft((d) => ({ ...d, severity: (e.target.value || undefined) as AuditFilters["severity"] }))} className="min-h-11 border-2 border-line bg-surface px-3 text-sm text-ink">
              <option value="">{t("any")}</option>
              {(["info", "notice", "critical"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`severities.${s}`)}
                </option>
              ))}
            </select>
          </label>
          {field("entityType", t("entityType"), { placeholder: "platform_setting" })}
          {field("entityId", t("entityId"))}
          {field("actorId", t("actorId"))}
          <label className="flex min-h-11 items-center gap-2 self-end text-sm font-semibold">
            <input type="checkbox" checked={Boolean(draft.stepUp)} onChange={(e) => setDraft((d) => ({ ...d, stepUp: e.target.checked }))} className="size-5 accent-brand" />
            {t("stepUpOnly")}
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit">{t("apply")}</Button>
            <button
              type="button"
              className="min-h-12 border-2 border-line px-4 font-semibold"
              onClick={() => {
                setDraft(initial);
                setFilters(initial);
              }}
            >
              {t("reset")}
            </button>
          </div>
        </form>

        <div className="mt-4 overflow-x-auto border-2 border-line bg-surface">
          {q.isPending ? (
            <p className="p-5 text-muted" role="status">
              {t("loading")}
            </p>
          ) : q.isError ? (
            <div className="p-5">
              <Notice tone="error">{problemOf(q.error)?.title ?? "Error"}</Notice>
            </div>
          ) : rows.length === 0 ? (
            <p className="p-5 text-muted">{t("empty")}</p>
          ) : (
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b-2 border-line">
                <tr>
                  {[t("when"), t("actor"), t("summary"), t("entity"), t("severity"), t("ip")].map((h) => (
                    <th key={h} scope="col" className="px-4 py-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <Row key={r.id} row={r} locale={locale} onOpen={() => setOpenId(r.id)} />
                ))}
              </tbody>
            </table>
          )}
        </div>
        {q.hasNextPage ? (
          <div className="mt-4">
            <button type="button" className="min-h-11 border-2 border-line px-4 text-sm font-semibold" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>
              {t("more")}
            </button>
          </div>
        ) : null}
      </div>

      {openId ? <EntryDrawer id={openId} onClose={() => setOpenId(null)} /> : null}
      {exporting ? <ExportDialog filters={filters} onClose={() => setExporting(false)} /> : null}
    </>
  );
}

function Row({ row: r, locale, onOpen }: { row: AuditEntry; locale: string; onOpen: () => void }) {
  const t = useTranslations("audit");
  return (
    <tr className="cursor-pointer hover:bg-surface-2" onClick={onOpen} data-testid="audit-row">
      <td className="whitespace-nowrap px-4 py-2">{formatDhaka(r.occurredAt, locale)}</td>
      <td className="px-4 py-2">
        {r.actor.name ?? t("system")}
        {r.actor.role ? <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-xs">{r.actor.role}</span> : null}
      </td>
      <td className="px-4 py-2">
        <button type="button" className="text-left underline-offset-2 hover:underline" onClick={onOpen}>
          {locale === "bn" ? r.summary.bn : r.summary.en}
        </button>
        {r.stepUp ? <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-text">{t("stepUpBadge")}</span> : null}
        <div className="font-mono text-xs text-muted">{r.action}</div>
      </td>
      <td className="px-4 py-2 font-mono text-xs">{[r.entity.type, r.entity.code ?? r.entity.id].filter(Boolean).join(" · ")}</td>
      <td className="px-4 py-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_TONE[r.severity]}`}>{t(`severities.${r.severity}`)}</span>
      </td>
      <td className="px-4 py-2 font-mono text-xs">{r.ip ?? ""}</td>
    </tr>
  );
}

function EntryDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useTranslations("audit");
  const locale = useLocale();
  const closeRef = useRef<HTMLButtonElement>(null);
  const q = useQuery({
    queryKey: ["audit-entry", id],
    queryFn: async () => {
      const { data, error } = await api("admin").GET("/admin/audit-logs/{id}", { params: { path: { id } } });
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const e = q.data;
  const chainText = !e ? "" : !e.chain.sealed ? t("chainPending") : e.chain.intact ? t("chainIntact", { seq: e.chain.seq ?? 0 }) : t("chainBroken", { seq: e.chain.seq ?? 0 });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={(ev) => ev.target === ev.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" aria-labelledby="audit-entry-title" className="h-full w-full max-w-xl overflow-y-auto border-l-2 border-line-strong bg-surface p-6">
        <div className="flex items-start gap-3">
          <h2 id="audit-entry-title" className="text-lg font-extrabold">
            {t("detailTitle")}
          </h2>
          <button ref={closeRef} type="button" className="ml-auto min-h-11 border-2 border-line px-3 text-sm font-semibold" onClick={onClose}>
            {t("close")}
          </button>
        </div>
        {!e ? (
          <p className="mt-4 text-sm text-muted" role="status">
            {t("loading")}
          </p>
        ) : (
          <>
            <p className="mt-3 font-semibold">{locale === "bn" ? e.summary.bn : e.summary.en}</p>
            <p className="text-sm text-muted">
              {formatDhaka(e.occurredAt, locale)} · {e.actor.name ?? t("system")} · <span className="font-mono">{e.action}</span>
            </p>
            <table className="mt-4 w-full text-left text-sm">
              <thead className="border-b-2 border-line">
                <tr>
                  <th scope="col" className="py-2 pr-3">{t("field")}</th>
                  <th scope="col" className="py-2 pr-3">{t("before")}</th>
                  <th scope="col" className="py-2">{t("after")}</th>
                </tr>
              </thead>
              <tbody>
                {diffRows(e.before, e.after).map((d) => (
                  <tr key={d.field} className={`border-b border-line ${d.changed ? "font-semibold" : "text-muted"}`}>
                    <th scope="row" className="py-1 pr-3 font-mono text-xs">{d.field}</th>
                    <td className="break-all py-1 pr-3">{d.before}</td>
                    <td className="break-all py-1">{d.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {[
                [t("reason"), e.reason],
                [t("ip"), e.ip],
                [t("requestId"), e.requestId],
                [t("sessionId"), e.sessionId],
                [t("userAgent"), e.userAgent],
                [t("chain"), chainText],
              ].map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-semibold text-muted">{k}</dt>
                  <dd className={`break-all ${k === t("chain") && e.chain.sealed && !e.chain.intact ? "font-bold text-danger" : ""}`}>{v || "–"}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </aside>
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div role="dialog" aria-modal="true" aria-labelledby="export-title" className="w-full max-w-md border-2 border-line-strong bg-surface p-6">
        <h2 id="export-title" className="text-xl font-extrabold">
          {t("exportTitle")}
        </h2>
        <p className="mt-3" role="status" data-testid="export-status">
          {s?.status === "ready" ? t("exportReady", { count: s.rowCount ?? 0 }) : s?.status === "failed" ? t("exportFailed") : t("exportPreparing")}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="min-h-12 border-2 border-line px-4 font-semibold" onClick={onClose}>
            {t("close")}
          </button>
          {s?.status === "ready" ? (
            <Button type="button" onClick={() => void download()}>
              {t("download")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

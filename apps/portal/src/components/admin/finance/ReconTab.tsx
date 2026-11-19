"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { Badge, Button, Checkbox, DataTable, Notice, type Column } from "@kriraghor/ui/kit";
import { DatePicker } from "@kriraghor/ui/date";
import { dhakaDate, finance, formatTaka, type Item, type Run } from "@/lib/admin/finance";
import { StatusBadge } from "../../StatusBadge";
import { formatDhaka } from "../useAdminMe";
import type { DeskMe } from "./FinanceDesk";

const total = (r: Run, k: string) => {
  const v = r.totals?.[k];
  return v === undefined || v === null ? null : Number(v);
};

/** Daily reconciliation runs (expanding rows show a run's items); open exceptions resolved with a note (masters). */
export function ReconTab({ me }: { me: DeskMe }) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const qc = useQueryClient();
  const [day, setDay] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [run, setRun] = useState<string | null>(null);
  const toggle = (id: string) => setRun((r) => (r === id ? null : id));

  // The runs endpoint returns a nextCursor but takes no cursor yet: one page, as before.
  const runs = useQuery({ queryKey: ["finance-runs"], queryFn: finance.runs });

  async function reconcile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await finance.runDay(day || dhakaDate(Date.now()));
      setMsg({ tone: "info", text: t("runDone", { matched: Number(r.totals?.matched ?? 0), exceptions: Number(r.totals?.exceptions ?? 0) }) });
      setRun(r.id);
      await qc.invalidateQueries({ queryKey: ["finance-runs"] });
    } catch (err) {
      setMsg({ tone: "error", text: problemOf(err)?.title ?? t("loadFailed") });
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<Run>[] = [
    {
      id: "day",
      header: t("businessDay"),
      primary: true,
      sort: (r) => r.businessDate,
      cell: (r) => (
        <button type="button" className="inline-flex items-center gap-1.5 font-mono font-semibold hover:underline" onClick={() => toggle(r.id)} aria-expanded={run === r.id}>
          {run === r.id ? <CaretDown size={14} weight="bold" aria-hidden /> : <CaretRight size={14} weight="bold" aria-hidden />}
          {r.businessDate}
        </button>
      ),
    },
    { id: "status", header: t("status"), sort: (r) => r.status, cell: (r) => <StatusBadge status={r.status}>{r.status}</StatusBadge> },
    { id: "matched", header: t("matched"), align: "end", sort: (r) => total(r, "matched"), cell: (r) => String(r.totals?.matched ?? "–") },
    { id: "autoHealed", header: t("autoHealed"), align: "end", hideBelow: "lg", sort: (r) => total(r, "autoHealed"), cell: (r) => String(r.totals?.autoHealed ?? "–") },
    { id: "exceptions", header: t("exceptions"), align: "end", sort: (r) => total(r, "exceptions"), cell: (r) => String(r.totals?.exceptions ?? "–") },
    { id: "when", header: t("when"), hideBelow: "lg", sort: (r) => r.finishedAt ?? r.startedAt, cell: (r) => <span className="whitespace-nowrap">{formatDhaka(r.finishedAt ?? r.startedAt, locale)}</span> },
  ];

  return (
    <div className="mt-6 flex flex-col gap-4">
      {me.isMaster ? (
        <form onSubmit={reconcile} className="flex flex-wrap items-end gap-3">
          <DatePicker id="recon-day" className="w-full sm:w-56" label={t("businessDay")} value={day} onChange={setDay} />
          <Button type="submit" busy={busy} confirm={{ kind: "save", confirmLabel: t("reconcile") }}>
            {t("reconcile")}
          </Button>
        </form>
      ) : null}
      {msg ? (
        <div className="max-w-3xl">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      ) : null}
      <DataTable
        label={t("tabs.reconciliation")}
        testId="finance-runs"
        columns={columns}
        rows={runs.data?.items}
        rowId={(r) => r.id}
        loading={runs.isPending}
        error={runs.error}
        onRetry={() => void runs.refetch()}
        empty={{ title: t("empty") }}
        selectedId={run}
        onRowClick={(r) => toggle(r.id)}
        expanded={(r) => (run === r.id ? <RunItems runId={r.id} canResolve={me.isMaster} /> : null)}
      />
    </div>
  );
}

/** A run's items (no cursor on this endpoint: one page), open exceptions only by default. */
function RunItems({ runId, canResolve }: { runId: string; canResolve: boolean }) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const [openOnly, setOpenOnly] = useState(true);
  const items = useQuery({ queryKey: ["finance-items", runId, openOnly], queryFn: () => finance.items(runId, openOnly) });

  const columns: Column<Item>[] = [
    {
      id: "type",
      header: t("type"),
      primary: true,
      cell: (i) => <Badge tone={i.type === "matched" ? "brand" : i.resolution ? "neutral" : "danger"}>{t(`itemTypes.${i.type}`)}</Badge>,
    },
    { id: "ours", header: t("ours"), align: "end", cell: (i) => formatTaka(i.internalAmount, locale) },
    { id: "theirs", header: t("theirs"), align: "end", cell: (i) => formatTaka(i.providerAmount, locale) },
    { id: "detail", header: t("detail"), cell: (i) => i.detail ?? "" },
    { id: "resolution", header: t("resolution"), cell: (i) => <Resolution item={i} canResolve={canResolve} /> },
  ];

  return (
    <div className="flex flex-col gap-2">
      <Checkbox id={`recon-open-${runId}`} label={t("openOnly")} checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
      <DataTable
        label={t("exceptions")}
        testId="finance-items"
        columns={columns}
        rows={items.data?.items}
        rowId={(i) => i.id}
        loading={items.isPending}
        error={items.error}
        onRetry={() => void items.refetch()}
        empty={{ title: t("empty") }}
      />
    </div>
  );
}

function Resolution({ item, canResolve }: { item: Item; canResolve: boolean }) {
  const t = useTranslations("finance");
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = item.type !== "matched" && !item.resolution;

  async function resolve(resolution: "resolved" | "ignored") {
    setBusy(true);
    setError(null);
    try {
      await finance.resolve(item.id, { resolution, note });
      await qc.invalidateQueries({ queryKey: ["finance-items"] });
    } catch (err) {
      setError(problemOf(err)?.title ?? t("loadFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (!(open && canResolve))
    return <span className="text-sm text-muted">{item.resolution ? `${t(`resolutions.${item.resolution}`)}${item.note ? `: ${item.note}` : ""}` : ""}</span>;
  const short = note.trim().length < 3;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("note")}
        aria-label={t("note")}
        maxLength={500}
        className="min-h-9 w-56 rounded-control border border-line-strong/70 bg-surface px-3 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
      />
      <Button type="button" size="sm" disabled={busy || short} confirm={{ kind: "save", confirmLabel: t("resolve") }} onClick={() => void resolve("resolved")}>
        {t("resolve")}
      </Button>
      <Button type="button" size="sm" variant="secondary" disabled={busy || short} confirm={{ kind: "save", confirmLabel: t("ignore") }} onClick={() => void resolve("ignored")}>
        {t("ignore")}
      </Button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}

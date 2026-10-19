"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { problemOf } from "@kriraghor/api-client";
import { dhakaDate, finance, formatTaka, type Item } from "@/lib/admin/finance";
import { Button, Notice } from "../../ui";
import { formatDhaka } from "../useAdminMe";
import type { DeskMe } from "./FinanceDesk";
import { Chip, DataTable, Field, inputCls, TONE } from "./shared";

/** Daily reconciliation runs; open exceptions resolved with a note (masters). */
export function ReconTab({ me }: { me: DeskMe }) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const qc = useQueryClient();
  const [day, setDay] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [run, setRun] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(true);

  const runs = useQuery({ queryKey: ["finance-runs"], queryFn: finance.runs });
  const items = useQuery({ queryKey: ["finance-items", run, openOnly], enabled: Boolean(run), queryFn: () => finance.items(run as string, openOnly) });

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

  return (
    <div className="mt-6">
      {me.isMaster ? (
        <form onSubmit={reconcile} className="flex flex-wrap items-end gap-3">
          <Field label={t("businessDay")}>
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={inputCls} />
          </Field>
          <Button type="submit" busy={busy}>
            {t("reconcile")}
          </Button>
        </form>
      ) : null}
      {msg ? (
        <div className="mt-3 max-w-3xl">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      ) : null}
      <DataTable head={[t("businessDay"), t("status"), t("matched"), t("autoHealed"), t("exceptions"), t("when")]} loading={runs.isPending} error={runs.isError} empty={!runs.data?.items.length} testId="finance-runs">
        {runs.data?.items.map((r) => (
          <tr key={r.id} className={run === r.id ? "bg-surface-2" : undefined}>
            <td className="px-3 py-2">
              <button type="button" className="font-mono underline" onClick={() => setRun(run === r.id ? null : r.id)} aria-expanded={run === r.id}>
                {r.businessDate}
              </button>
            </td>
            <td className="px-3 py-2">
              <Chip tone={TONE[r.status] ?? "muted"}>{r.status}</Chip>
            </td>
            <td className="px-3 py-2 tabular-nums">{String(r.totals?.matched ?? "–")}</td>
            <td className="px-3 py-2 tabular-nums">{String(r.totals?.autoHealed ?? "–")}</td>
            <td className="px-3 py-2 tabular-nums">{String(r.totals?.exceptions ?? "–")}</td>
            <td className="px-3 py-2 whitespace-nowrap">{formatDhaka(r.finishedAt ?? r.startedAt, locale)}</td>
          </tr>
        ))}
      </DataTable>

      {run ? (
        <section className="mt-6">
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="size-5 accent-brand" />
            {t("openOnly")}
          </label>
          <DataTable head={[t("type"), t("ours"), t("theirs"), t("detail"), t("resolution")]} loading={items.isPending} error={items.isError} empty={!items.data?.items.length}>
            {items.data?.items.map((i) => (
              <ItemRow key={i.id} item={i} canResolve={me.isMaster} />
            ))}
          </DataTable>
        </section>
      ) : null}
    </div>
  );
}

function ItemRow({ item, canResolve }: { item: Item; canResolve: boolean }) {
  const t = useTranslations("finance");
  const locale = useLocale();
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

  return (
    <tr>
      <td className="px-3 py-2">
        <Chip tone={item.type === "matched" ? "ok" : item.resolution ? "muted" : "bad"}>{t(`itemTypes.${item.type}`)}</Chip>
      </td>
      <td className="px-3 py-2 tabular-nums">{formatTaka(item.internalAmount, locale)}</td>
      <td className="px-3 py-2 tabular-nums">{formatTaka(item.providerAmount, locale)}</td>
      <td className="px-3 py-2">{item.detail ?? ""}</td>
      <td className="px-3 py-2">
        {open && canResolve ? (
          <span className="flex flex-wrap items-center gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("note")} aria-label={t("note")} maxLength={500} className={`${inputCls} w-56`} />
            <button type="button" disabled={busy || note.trim().length < 3} onClick={() => void resolve("resolved")} className="min-h-9 border-2 border-brand px-3 font-semibold disabled:opacity-50">
              {t("resolve")}
            </button>
            <button type="button" disabled={busy || note.trim().length < 3} onClick={() => void resolve("ignored")} className="min-h-9 border-2 border-line px-3 font-semibold disabled:opacity-50">
              {t("ignore")}
            </button>
            {error ? <span className="text-xs text-danger">{error}</span> : null}
          </span>
        ) : (
          <span className="text-sm text-muted">{item.resolution ? `${t(`resolutions.${item.resolution}`)}${item.note ? `: ${item.note}` : ""}` : ""}</span>
        )}
      </td>
    </tr>
  );
}

"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { formatTaka } from "@/lib/admin/finance";
import { stepUp } from "@/lib/admin/stepUp";
import { problemOf } from "@kriraghor/api-client";
import { tournamentsAdmin } from "@/lib/vendor/tournaments";
import { Notice } from "@kriraghor/ui/primitives";
import { CodeDialog } from "../CodeDialog";
import { Chip, inputCls } from "../finance/shared";
import { useAdminMe } from "../useAdminMe";

const STATUSES = ["", "pending_review", "registration_open", "registration_closed", "live", "completed", "cancelled"] as const;
const TONE: Record<string, "ok" | "warn" | "bad" | "muted"> = { registration_open: "ok", live: "ok", pending_review: "warn", registration_closed: "warn", completed: "muted", cancelled: "bad", rejected: "bad" };

/**
 * /admin/tournaments (M14, approve_listings or manage_organisers): physical-sport tournaments with
 * their registrations and escrow; masters cancel with refunds (step-up escrow.manage). Reviews are on
 * the Moderation desk (kind tournament).
 */
export function TournamentsAdmin() {
  const t = useTranslations("tournamentsAdmin");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready, me } = useAdminMe();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("");
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const list = useQuery({ queryKey: ["admin-tournaments", status, search], queryFn: () => tournamentsAdmin.list({ status: status || undefined, q: search || undefined }), enabled: ready });
  const one = useQuery({ queryKey: ["admin-tournament", open], queryFn: () => tournamentsAdmin.get(open!), enabled: ready && Boolean(open) });
  const money = (p: number) => formatTaka(p, locale);
  return (
    <>
      <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-8">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t("intro")}</p>
        <form
          className="mt-6 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(text.trim());
          }}
        >
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
            {t("name")}
            <input value={text} onChange={(e) => setText(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
            {t("status")}
            <select value={status} onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])} className={inputCls}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s ? t(`st.${s}`) : t("all")}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="min-h-11 border-2 border-brand bg-brand px-4 font-bold text-white">
            {t("find")}
          </button>
        </form>
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <ul className="flex flex-col gap-2" data-testid="admin-tournaments">
            {list.isPending ? <li className="h-32 animate-pulse bg-surface-2" /> : null}
            {list.data && !list.data.items.length ? <li className="text-muted">{t("none")}</li> : null}
            {(list.data?.items ?? []).map((x) => (
              <li key={x.id}>
                <button type="button" aria-pressed={open === x.id} onClick={() => (setOpen(x.id), setCancelling(false))} className={`flex w-full flex-wrap items-center gap-3 border-2 p-3 text-left ${open === x.id ? "border-brand" : "border-line hover:border-brand"}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{x.name}</span>
                    <span className="block text-sm text-muted">
                      {x.organisation?.name ?? "–"} · {locale === "bn" ? x.sport.nameBn : x.sport.nameEn} · {x.approved}/{x.maxTeams}
                    </span>
                  </span>
                  <Chip tone={TONE[x.status] ?? "muted"}>{t(`st.${x.status}`)}</Chip>
                </button>
              </li>
            ))}
          </ul>
          <div>
            {!open ? (
              <p className="border-2 border-dashed border-line p-8 text-center text-muted">{t("pick")}</p>
            ) : !one.data ? (
              <div className="h-64 animate-pulse bg-surface-2" />
            ) : (
              <div className="border-2 border-line p-4" data-testid="admin-tournament">
                <h2 className="text-xl font-extrabold">{one.data.name}</h2>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted">{t("collected")}</dt>
                    <dd className="font-bold tabular-nums">{money(one.data.money.collected)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t("held")}</dt>
                    <dd className="font-bold tabular-nums">{money(one.data.money.held)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t("released")}</dt>
                    <dd className="font-bold tabular-nums">{money(one.data.money.released)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t("refunded")}</dt>
                    <dd className="font-bold tabular-nums">{money(one.data.money.refunded)}</dd>
                  </div>
                </dl>
                <h3 className="mt-4 font-bold">{t("registrations", { n: one.data.registrationList.length })}</h3>
                <ul className="mt-2 divide-y divide-line text-sm">
                  {one.data.registrationList.map((r) => (
                    <li key={r.id} className="flex flex-wrap gap-2 py-2">
                      <span className="min-w-0 flex-1 font-semibold">{r.team}</span>
                      <span className="text-muted">{t(`reg.${r.status}`)}</span>
                      <span className="tabular-nums">{r.feeWaived ? t("waived") : money(r.feePoisha)}</span>
                    </li>
                  ))}
                </ul>
                {me?.isMaster && !["completed", "cancelled", "rejected"].includes(one.data.status) ? (
                  <div className="mt-4 flex flex-col gap-2">
                    <input className={inputCls} placeholder={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} />
                    <button type="button" disabled={reason.trim().length < 5} onClick={() => setCancelling(true)} className="min-h-11 border-2 border-danger px-3 text-sm font-bold text-danger disabled:opacity-50">
                      {t("cancel")}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
        {cancelling && open ? (
          <CodeDialog
            title={t("cancelTitle")}
            help={t("cancelHelp")}
            onClose={() => setCancelling(false)}
            onConfirm={async (code) => {
              await tournamentsAdmin.cancel(open, reason.trim(), await stepUp(code, "escrow.manage"));
              setCancelling(false);
              setReason("");
              await Promise.all([qc.invalidateQueries({ queryKey: ["admin-tournaments"] }), qc.invalidateQueries({ queryKey: ["admin-tournament", open] })]);
            }}
          />
        ) : null}
        {list.isError ? (
          <div className="mt-4">
            <Notice tone="error">{problemOf(list.error)?.title ?? t("failed")}</Notice>
          </div>
        ) : null}
      </div>
    </>
  );
}

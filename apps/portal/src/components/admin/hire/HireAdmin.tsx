"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { problemOf } from "@kriraghor/api-client";
import { formatTaka } from "@/lib/admin/finance";
import { CANCELLABLE, hireAdmin, type ProfileStatus, type RequestStatus, type StaffJob, type StaffProfile } from "@/lib/admin/hire";
import { stepUp } from "@/lib/admin/stepUp";
import { Notice } from "@kriraghor/ui/primitives";
import { AdminSubnav } from "../AdminSubnav";
import { CodeDialog } from "../CodeDialog";
import { formatDhaka, useAdminMe } from "../useAdminMe";
import { Chip, inputCls } from "../finance/shared";

const REQUEST_STATUSES = ["", "pending", "accepted_unpaid", "confirmed", "completed", "declined", "expired", "withdrawn", "lapsed", "cancelled"] as const;
const PROFILE_STATUSES = ["", "pending_review", "live", "paused", "suspended", "changes_requested", "rejected"] as const;
type Tone = "ok" | "warn" | "bad" | "muted";
const TONE: Record<string, Tone> = {
  pending: "warn",
  accepted_unpaid: "warn",
  confirmed: "ok",
  completed: "ok",
  reserved: "warn",
  scheduled: "warn",
  checked_in: "warn",
  live: "ok",
  completed_marked: "warn",
  released: "ok",
  disputed: "bad",
  suspended: "bad",
  rejected: "bad",
  changes_requested: "bad",
  pending_review: "warn",
};
type Hold = { held?: number; released?: number; refunded?: number; status?: string; available?: number } | null;
const TIMES = ["checkedInAt", "startedAt", "completedAt", "releasedAt", "cancelledAt"] as const;

/**
 * /admin/hire (M11): find a hire request by its code (or a job's), see each job with its timeline
 * and escrow hold (never the phones); a master cancels a job not yet started for the platform with a
 * full refund (step-up escrow.manage). Profiles: suspend (manage_users) or restore (masters), with a
 * reason; the review itself happens on the Moderation desk.
 */
export function HireAdmin() {
  const t = useTranslations("hireAdmin");
  const [tab, setTab] = useState<"requests" | "profiles">("requests");
  return (
    <>
      <AdminSubnav />
      <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-8">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t("intro")}</p>
        <div className="mt-6 flex gap-2" role="tablist">
          {(["requests", "profiles"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-11 border-2 px-4 font-bold ${tab === k ? "border-brand bg-brand text-white" : "border-line"}`} data-testid={`hire-tab-${k}`}>
              {t(`tab.${k}`)}
            </button>
          ))}
        </div>
        {tab === "requests" ? <Requests /> : <Profiles />}
      </div>
    </>
  );
}

function Requests() {
  const t = useTranslations("hireAdmin");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready, me } = useAdminMe();
  const [status, setStatus] = useState<(typeof REQUEST_STATUSES)[number]>("");
  const [code, setCode] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<StaffJob | null>(null);
  const [reason, setReason] = useState("");
  const list = useQuery({ queryKey: ["admin-hire-requests", status, search], queryFn: () => hireAdmin.requests({ code: search || undefined, status: (status || undefined) as RequestStatus | undefined }), enabled: ready });
  const detail = useQuery({ queryKey: ["admin-hire-request", open], queryFn: () => hireAdmin.request(open!), enabled: ready && Boolean(open) });
  const money = (n: number | undefined) => formatTaka(n ?? 0, locale);

  return (
    <>
      <form
        className="mt-6 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(code.trim().toUpperCase());
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
          {t("code")}
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="HR-26-000123" className={inputCls} data-testid="hire-code" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
          {t("status")}
          <select value={status} onChange={(e) => setStatus(e.target.value as (typeof REQUEST_STATUSES)[number])} className={inputCls}>
            {REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s ? t(`requestStatus.${s}`) : t("all")}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-11 border-2 border-brand bg-brand px-4 font-bold text-white">
          {t("find")}
        </button>
      </form>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <ul className="flex flex-col gap-2" data-testid="hire-requests">
          {list.isPending ? <li className="h-32 animate-pulse bg-surface-2" /> : null}
          {list.data && !list.data.items.length ? <li className="text-muted">{t("none")}</li> : null}
          {(list.data?.items ?? []).map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setOpen(r.code)} className={`block w-full border-2 p-3 text-left ${open === r.code ? "border-brand" : "border-line hover:border-brand"}`}>
                <div className="flex justify-between gap-2">
                  <span className="font-bold">{r.code}</span>
                  <span className="tabular-nums">{money(r.total)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <Chip tone={TONE[r.status] ?? "muted"}>{t(`requestStatus.${r.status}`)}</Chip>
                  {t("jobsCount", { n: r.jobs })} · {formatDhaka(r.createdAt, locale)}
                </div>
              </button>
            </li>
          ))}
        </ul>
        <div>
          {open && detail.isPending ? <div className="h-64 animate-pulse bg-surface-2" /> : null}
          {detail.isError ? <Notice tone="error">{t("failed")}</Notice> : null}
          {detail.data ? (
            <div className="border-2 border-line" data-testid="hire-request-detail">
              <div className="border-b-2 border-line px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xl font-extrabold">{detail.data.code}</p>
                  <Chip tone={TONE[detail.data.status] ?? "muted"}>{t(`requestStatus.${detail.data.status}`)}</Chip>
                </div>
                <p className="text-sm text-muted">{detail.data.profile.headline}</p>
                <p className="mt-1 text-sm">{t("money", { total: money(detail.data.money.total), fee: money(detail.data.money.fee), net: money(detail.data.money.net), pct: detail.data.money.feeBps / 100 })}</p>
              </div>
              {detail.data.jobs.map((j) => {
                const hold = j.escrow as Hold;
                return (
                  <section key={j.id} className="border-b-2 border-line px-4 py-3 last:border-b-0" data-testid="staff-job">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold">
                        {j.code} · {formatDhaka(j.start, locale)}
                        {j.format ? ` · ${j.format}` : ""}
                      </p>
                      <Chip tone={TONE[j.status] ?? "muted"}>{t(`jobStatus.${j.status}`)}</Chip>
                    </div>
                    <p className="mt-1 text-sm text-muted">{j.venue.text}</p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                      <div>
                        <dt className="text-muted">{t("quote")}</dt>
                        <dd className="tabular-nums">{money(j.money.quote)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">{t("held")}</dt>
                        <dd className="tabular-nums">{hold ? `${money(hold.available)} · ${hold.status}` : "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">{t("released")}</dt>
                        <dd className="tabular-nums">{money(j.money.released)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">{t("refunded")}</dt>
                        <dd className="tabular-nums">{money(j.money.refunded)}</dd>
                      </div>
                    </dl>
                    <ol className="mt-2 text-xs text-muted">
                      {TIMES.filter((k) => j[k]).map((k) => (
                        <li key={k}>
                          {t(`at.${k}`)}: {formatDhaka(j[k], locale)}
                          {k === "checkedInAt" && j.late ? ` (${t("late")})` : ""}
                        </li>
                      ))}
                    </ol>
                    {me?.isMaster && CANCELLABLE.includes(j.status) ? (
                      <button type="button" className="mt-3 min-h-11 border-2 border-danger px-4 font-semibold text-danger" onClick={() => setCancelling(j)} data-testid="hire-platform-cancel">
                        {t("cancel")}
                      </button>
                    ) : null}
                  </section>
                );
              })}
            </div>
          ) : open ? null : (
            <p className="text-muted">{t("pick")}</p>
          )}
        </div>
      </div>
      {cancelling ? (
        <CodeDialog
          title={t("cancelTitle", { code: cancelling.code })}
          help={t("cancelHelp", { amount: money(cancelling.money.quote - cancelling.money.refunded - cancelling.money.released) })}
          onClose={() => setCancelling(null)}
          onConfirm={async (c) => {
            if (reason.trim().length < 5) throw { code: "VALIDATION_FAILED", title: t("reasonNeeded"), status: 422 };
            const token = await stepUp(c, "escrow.manage");
            await hireAdmin.cancelJob(cancelling.id, reason.trim(), token);
            setCancelling(null);
            await qc.invalidateQueries({ queryKey: ["admin-hire-requests"] });
            await qc.invalidateQueries({ queryKey: ["admin-hire-request", open] });
          }}
        >
          <label htmlFor="hire-cancel-reason" className="mt-4 block text-sm font-semibold text-muted">
            {t("reason")}
          </label>
          <input id="hire-cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={`${inputCls} mt-1 w-full`} />
        </CodeDialog>
      ) : null}
    </>
  );
}

function Profiles() {
  const t = useTranslations("hireAdmin");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready, me } = useAdminMe();
  const [status, setStatus] = useState<(typeof PROFILE_STATUSES)[number]>("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [acting, setActing] = useState<{ p: StaffProfile; action: "suspend" | "restore" } | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const list = useQuery({ queryKey: ["admin-hire-profiles", status, search], queryFn: () => hireAdmin.profiles({ status: (status || undefined) as ProfileStatus | undefined, q: search || undefined }), enabled: ready });
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const canSuspend = Boolean(me && (me.isMaster || me.permissions.includes("manage_users" as never)));

  async function act() {
    if (!acting) return;
    setError(null);
    if (reason.trim().length < 5) return setError(t("reasonNeeded"));
    try {
      await (acting.action === "suspend" ? hireAdmin.suspend(acting.p.id, reason.trim()) : hireAdmin.restore(acting.p.id, reason.trim()));
      setActing(null);
      setReason("");
      await qc.invalidateQueries({ queryKey: ["admin-hire-profiles"] });
    } catch (err) {
      setError(problemOf(err)?.title ?? t("failed"));
    }
  }

  return (
    <>
      <form
        className="mt-6 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
          {t("headline")}
          <input value={q} onChange={(e) => setQ(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
          {t("status")}
          <select value={status} onChange={(e) => setStatus(e.target.value as (typeof PROFILE_STATUSES)[number])} className={inputCls}>
            {PROFILE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s ? t(`profileStatus.${s}`) : t("all")}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-11 border-2 border-brand bg-brand px-4 font-bold text-white">
          {t("find")}
        </button>
      </form>
      <ul className="mt-6 divide-y-2 divide-line border-y-2 border-line" data-testid="hire-profiles">
        {list.isPending ? <li className="h-32 animate-pulse bg-surface-2" /> : null}
        {list.data && !list.data.items.length ? <li className="py-4 text-muted">{t("none")}</li> : null}
        {(list.data?.items ?? []).map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
            <span className="min-w-0 flex-1">
              <span className="block font-bold">
                {p.owner.displayName ?? "—"} · {p.role ? name(p.role) : ""}
              </span>
              <span className="block text-sm text-muted">
                {p.headline} · {p.baseArea ? name(p.baseArea) : "—"}
                {p.credential ? ` · ${t("credential", { level: t(`level.${p.credential.level}`) })}` : ""}
              </span>
            </span>
            <Chip tone={TONE[p.status] ?? "muted"}>{t(`profileStatus.${p.status}`)}</Chip>
            {canSuspend && ["live", "paused"].includes(p.status) ? (
              <button type="button" className="min-h-11 border-2 border-danger px-3 text-sm font-semibold text-danger" onClick={() => setActing({ p, action: "suspend" })}>
                {t("suspend")}
              </button>
            ) : null}
            {me?.isMaster && p.status === "suspended" ? (
              <button type="button" className="min-h-11 border-2 border-line px-3 text-sm font-semibold" onClick={() => setActing({ p, action: "restore" })}>
                {t("restore")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {acting ? (
        <div className="mt-4 border-2 border-line p-4" role="dialog" aria-label={t(acting.action)}>
          <p className="font-bold">{t(`${acting.action}Title`, { headline: acting.p.headline ?? "" })}</p>
          <label htmlFor="hire-profile-reason" className="mt-3 block text-sm font-semibold text-muted">
            {t("reason")}
          </label>
          <input id="hire-profile-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={`${inputCls} mt-1 w-full`} />
          {error ? (
            <div className="mt-2">
              <Notice tone="error">{error}</Notice>
            </div>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button type="button" className="min-h-11 border-2 border-brand bg-brand px-4 font-bold text-white" onClick={() => void act()}>
              {t(acting.action)}
            </button>
            <button type="button" className="min-h-11 border-2 border-line px-4 font-bold" onClick={() => setActing(null)}>
              {t("close")}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

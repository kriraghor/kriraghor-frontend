"use client";

import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowCounterClockwise, Prohibit } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { Button, DataTable, DetailLayout, Field, FilterBar, Notice, PageTitle, ReasonDialog, Skeleton, Tabs, type Column, type MenuItem } from "@kriraghor/ui/kit";
import { formatTaka } from "@/lib/admin/finance";
import { CANCELLABLE, hireAdmin, type ProfileStatus, type RequestStatus, type StaffJob, type StaffProfile } from "@/lib/admin/hire";
import { stepUp } from "@/lib/admin/stepUp";
import { useCursorList } from "@/lib/use-cursor-list";
import { useUrlFilters } from "@/lib/use-url-filters";
import { StatusBadge } from "../../StatusBadge";
import { CodeDialog } from "../CodeDialog";
import { formatDhaka, useAdminMe } from "../useAdminMe";

type RequestRow = Awaited<ReturnType<typeof hireAdmin.requests>>["items"][number];
type ProfileRow = Awaited<ReturnType<typeof hireAdmin.profiles>>["items"][number];

const REQUEST_STATUSES = ["pending", "accepted_unpaid", "confirmed", "completed", "declined", "expired", "withdrawn", "lapsed", "cancelled"] as const;
const PROFILE_STATUSES = ["pending_review", "live", "paused", "suspended", "changes_requested", "rejected"] as const;
const TABS = ["requests", "profiles"] as const;
type Hold = { held?: number; released?: number; refunded?: number; status?: string; available?: number } | null;
const TIMES = ["checkedInAt", "startedAt", "completedAt", "releasedAt", "cancelledAt"] as const;

/**
 * /admin/hire (M11): find a hire request by its code (or a job's), see each job with its timeline
 * and escrow hold (never the phones); a master cancels a job not yet started for the platform with a
 * full refund (step-up escrow.manage). Profiles: suspend (manage_users) or restore (masters), with a
 * reason; the review itself happens on the Moderation desk.
 */
export function HireAdmin() {
  // The tab, the filters and the open request live in the URL (useSearchParams), so the desk renders inside Suspense.
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-10 h-64 max-w-[1320px]" />}>
      <Desk />
    </Suspense>
  );
}

function Desk() {
  const t = useTranslations("hireAdmin");
  const { values, set } = useUrlFilters({ tab: { default: "requests", allowed: TABS } });
  return (
    <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
      <PageTitle title={t("title")} description={t("intro")} />
      <Tabs
        className="mt-6"
        label={t("title")}
        value={values.tab}
        onValueChange={(v) => set({ tab: v, status: null, q: null, code: null, id: null })}
        items={TABS.map((k) => ({ value: k, label: t(`tab.${k}`), testId: `hire-tab-${k}`, content: k === "requests" ? <Requests /> : <Profiles /> }))}
      />
    </div>
  );
}

function Requests() {
  const t = useTranslations("hireAdmin");
  const locale = useLocale();
  const { ready } = useAdminMe();
  const { values, set, clear, params } = useUrlFilters({ status: { default: "", allowed: ["", ...REQUEST_STATUSES] }, code: { default: "" } });
  const status = values.status as RequestStatus | "";
  const search = values.code;
  const open = params.get("id");
  const list = useCursorList<RequestRow>(["admin-hire-requests", status, search], (cursor) => hireAdmin.requests({ code: search || undefined, status: status || undefined, cursor }), { enabled: ready });
  const money = (n: number | undefined) => formatTaka(n ?? 0, locale);

  const columns: Column<RequestRow>[] = [
    { id: "code", header: t("col.request"), primary: true, sort: (r) => r.code, cell: (r) => <span className="font-mono font-semibold">{r.code}</span> },
    {
      id: "status",
      header: t("status"),
      sort: (r) => r.status,
      cell: (r) => (
        <StatusBadge status={r.status} domain="hire">
          {t(`requestStatus.${r.status}`)}
        </StatusBadge>
      ),
    },
    { id: "jobs", header: t("col.jobs"), align: "end", sort: (r) => r.jobs, cell: (r) => t("jobsCount", { n: r.jobs }) },
    { id: "total", header: t("col.total"), align: "end", sort: (r) => r.total, cell: (r) => money(r.total) },
    { id: "created", header: t("col.created"), hideBelow: "lg", sort: (r) => r.createdAt, cell: (r) => <span className="whitespace-nowrap text-muted">{r.createdAt ? formatDhaka(r.createdAt, locale) : "–"}</span> },
  ];

  return (
    <DetailLayout
      open={Boolean(open)}
      onClose={() => set({ id: null })}
      title={<span className="font-mono">{open}</span>}
      pane={open ? <RequestPane key={open} code={open} /> : null}
      width={520}
      testId="hire-request-detail"
    >
      <div className="flex flex-col gap-4">
        <FilterBar
          search={{ value: search, onChange: (v) => set({ code: v.toUpperCase(), id: null }), label: t("code"), placeholder: "HR-26-000123", testId: "hire-code" }}
          selects={[{ id: "status", label: t("status"), value: status, onChange: (v) => set({ status: v }), anyLabel: t("all"), options: REQUEST_STATUSES.map((s) => ({ value: s, label: t(`requestStatus.${s}`) })) }]}
          onClear={clear}
        />
        <DataTable
          label={t("tab.requests")}
          testId="hire-requests"
          columns={columns}
          rows={list.rows}
          rowId={(r) => r.code}
          loading={list.loading}
          error={list.error}
          onRetry={list.retry}
          empty={{ title: t("none") }}
          hasMore={list.hasMore}
          total={list.total}
          onMore={list.more}
          busy={list.busy}
          onRowClick={(r) => set({ id: r.code })}
          selectedId={open}
        />
      </div>
    </DetailLayout>
  );
}

function RequestPane({ code }: { code: string }) {
  const t = useTranslations("hireAdmin");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready, me } = useAdminMe();
  const [cancelling, setCancelling] = useState<StaffJob | null>(null);
  const [reason, setReason] = useState("");
  const detail = useQuery({ queryKey: ["admin-hire-request", code], queryFn: () => hireAdmin.request(code), enabled: ready });
  const money = (n: number | undefined) => formatTaka(n ?? 0, locale);
  if (detail.isError) return <Notice tone="error">{t("failed")}</Notice>;
  if (!detail.data) return <Skeleton className="h-64" />;
  const r = detail.data;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <StatusBadge status={r.status} domain="hire">
          {t(`requestStatus.${r.status}`)}
        </StatusBadge>
        <p className="mt-2 text-sm text-muted">{r.profile.headline}</p>
        <p className="mt-1 text-sm tabular">{t("money", { total: money(r.money.total), fee: money(r.money.fee), net: money(r.money.net), pct: r.money.feeBps / 100 })}</p>
      </div>
      {r.jobs.map((j) => {
        const hold = j.escrow as Hold;
        return (
          <section key={j.id} className="rounded-card border border-line p-4" data-testid="staff-job">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                <span className="font-mono">{j.code}</span> · {formatDhaka(j.start, locale)}
                {j.format ? ` · ${j.format}` : ""}
              </p>
              <StatusBadge status={j.status} domain="hire">
                {t(`jobStatus.${j.status}`)}
              </StatusBadge>
            </div>
            <p className="mt-1 text-sm text-muted">{j.venue.text}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-muted">{t("quote")}</dt>
                <dd className="tabular">{money(j.money.quote)}</dd>
              </div>
              <div>
                <dt className="text-muted">{t("held")}</dt>
                <dd className="tabular">{hold ? `${money(hold.available)} · ${hold.status}` : "–"}</dd>
              </div>
              <div>
                <dt className="text-muted">{t("released")}</dt>
                <dd className="tabular">{money(j.money.released)}</dd>
              </div>
              <div>
                <dt className="text-muted">{t("refunded")}</dt>
                <dd className="tabular">{money(j.money.refunded)}</dd>
              </div>
            </dl>
            <ol className="mt-3 text-xs text-muted">
              {TIMES.filter((k) => j[k]).map((k) => (
                <li key={k}>
                  {t(`at.${k}`)}: {formatDhaka(j[k], locale)}
                  {k === "checkedInAt" && j.late ? ` (${t("late")})` : ""}
                </li>
              ))}
            </ol>
            {me?.isMaster && CANCELLABLE.includes(j.status) ? (
              <Button type="button" variant="danger" size="sm" className="mt-3" onClick={() => setCancelling(j)} data-testid="hire-platform-cancel">
                {t("cancel")}
              </Button>
            ) : null}
          </section>
        );
      })}
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
            await qc.invalidateQueries({ queryKey: ["admin-hire-request", code] });
          }}
        >
          <Field id="hire-cancel-reason" className="mt-4" label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        </CodeDialog>
      ) : null}
    </div>
  );
}

function Profiles() {
  const t = useTranslations("hireAdmin");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready, me } = useAdminMe();
  const { values, set, clear } = useUrlFilters({ status: { default: "", allowed: ["", ...PROFILE_STATUSES] }, q: { default: "" } });
  const status = values.status as ProfileStatus | "";
  const search = values.q;
  const [acting, setActing] = useState<{ p: StaffProfile; action: "suspend" | "restore" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useQuery({ queryKey: ["admin-hire-profiles", status, search], queryFn: () => hireAdmin.profiles({ status: status || undefined, q: search || undefined }), enabled: ready });
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const canSuspend = Boolean(me && (me.isMaster || me.permissions.includes("manage_users" as never)));

  async function act(reason: string) {
    if (!acting) return;
    setError(null);
    setBusy(true);
    try {
      await (acting.action === "suspend" ? hireAdmin.suspend(acting.p.id, reason) : hireAdmin.restore(acting.p.id, reason));
      setActing(null);
      await qc.invalidateQueries({ queryKey: ["admin-hire-profiles"] });
    } catch (err) {
      setError(problemOf(err)?.title ?? t("failed"));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<ProfileRow>[] = [
    {
      id: "person",
      header: t("person"),
      primary: true,
      sort: (p) => p.owner.displayName,
      cell: (p) => (
        <>
          <span className="block font-semibold">{p.owner.displayName ?? "–"}</span>
          <span className="block text-xs font-normal text-muted">{p.role ? name(p.role) : ""}</span>
        </>
      ),
    },
    {
      id: "headline",
      header: t("headline"),
      cell: (p) => (
        <>
          {p.headline ?? "–"}
          {p.credential ? <span className="block text-xs text-muted">{t("credential", { level: t(`level.${p.credential.level}`) })}</span> : null}
        </>
      ),
    },
    { id: "area", header: t("baseArea"), hideBelow: "lg", sort: (p) => (p.baseArea ? name(p.baseArea) : null), cell: (p) => (p.baseArea ? name(p.baseArea) : "–") },
    {
      id: "status",
      header: t("status"),
      sort: (p) => p.status,
      cell: (p) => (
        <StatusBadge status={p.status} domain="hire">
          {t(`profileStatus.${p.status}`)}
        </StatusBadge>
      ),
    },
  ];

  const actions = (p: ProfileRow): MenuItem[] => {
    const items: MenuItem[] = [];
    if (canSuspend && ["live", "paused"].includes(p.status)) items.push({ label: t("suspend"), icon: <Prohibit />, danger: true, onSelect: () => setActing({ p, action: "suspend" }) });
    if (me?.isMaster && p.status === "suspended") items.push({ label: t("restore"), icon: <ArrowCounterClockwise />, onSelect: () => setActing({ p, action: "restore" }) });
    return items;
  };

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        search={{ value: search, onChange: (v) => set({ q: v }), label: t("headline") }}
        selects={[{ id: "status", label: t("status"), value: status, onChange: (v) => set({ status: v }), anyLabel: t("all"), options: PROFILE_STATUSES.map((s) => ({ value: s, label: t(`profileStatus.${s}`) })) }]}
        onClear={clear}
      />
      <DataTable
        label={t("tab.profiles")}
        testId="hire-profiles"
        columns={columns}
        rows={list.data?.items}
        rowId={(p) => p.id}
        loading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        empty={{ title: t("none") }}
        rowActions={actions}
      />
      <ReasonDialog
        open={Boolean(acting)}
        onOpenChange={(o) => {
          if (!o) {
            setActing(null);
            setError(null);
          }
        }}
        title={acting ? t(`${acting.action}Title`, { headline: acting.p.headline ?? "" }) : ""}
        label={t("reason")}
        confirmLabel={acting ? t(acting.action) : ""}
        danger={acting?.action === "suspend"}
        minLength={5}
        maxLength={300}
        busy={busy}
        error={error}
        onConfirm={(reason) => void act(reason)}
      />
    </div>
  );
}

"use client";

import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowCounterClockwise, Prohibit, Trash } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { publicEnv } from "@kriraghor/session/env";
import { DataTable, FilterBar, Notice, PageTitle, ReasonDialog, Skeleton, type Column, type MenuItem } from "@kriraghor/ui/kit";
import { groundsAdmin } from "@/lib/admin/grounds";
import { useUrlFilters } from "@/lib/use-url-filters";
import { StatusBadge } from "../../StatusBadge";
import { formatDhaka, useAdminMe } from "../useAdminMe";

type Row = Awaited<ReturnType<typeof groundsAdmin.list>>["items"][number];
type Action = "suspend" | "restore" | "remove";

const STATUSES = ["live", "pending_review", "paused", "suspended", "rejected", "removed"] as const;

/**
 * /admin/grounds (M09): every ground with its owner and status. Ops (manage_users) suspend a live or
 * paused ground; masters restore and remove (a status, never deleted). Reviews are on the Moderation desk.
 */
export function GroundsAdmin() {
  // The filters live in the URL (useSearchParams), so the desk renders inside Suspense.
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-10 h-64 max-w-[1320px]" />}>
      <Desk />
    </Suspense>
  );
}

function Desk() {
  const t = useTranslations("groundsAdmin");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready, me } = useAdminMe();
  const { values, set, clear } = useUrlFilters({ status: { default: "", allowed: ["", ...STATUSES] }, q: { default: "" } });
  const status = values.status as (typeof STATUSES)[number] | "";
  const search = values.q;
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const [acting, setActing] = useState<{ g: Row; action: Action } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const can = (p: string) => Boolean(me && (me.isMaster || me.permissions.includes(p as never)));
  const allowed = can("approve_listings") || can("manage_users");
  const q = useQuery({
    queryKey: ["admin-grounds", status, search],
    enabled: ready && allowed,
    queryFn: () => groundsAdmin.list({ ...(status ? { status } : {}), ...(search.trim() ? { q: search.trim() } : {}) }),
  });

  async function act(reason: string) {
    if (!acting) return;
    const { g, action } = acting;
    setError(null);
    setBusy(true);
    try {
      await groundsAdmin.act(g.id, action, reason);
      await qc.invalidateQueries({ queryKey: ["admin-grounds"] });
      setActing(null);
      setMsg({ text: t(`done.${action}`, { name: g.name }), tone: "info" });
    } catch (err) {
      setError(problemOf(err)?.title ?? t("failed"));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<Row>[] = [
    {
      id: "ground",
      header: t("col.ground"),
      primary: true,
      sort: (g) => g.name,
      cell: (g) => (
        <span className="flex items-center gap-3">
          {g.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={g.coverUrl} alt="" className="h-10 w-14 shrink-0 rounded-control object-cover" />
          ) : null}
          <span className="min-w-0">
            <span className="block font-semibold">{g.name}</span>
            {g.status === "live" ? (
              <a href={`${publicEnv().WEB_URL}/venues/${g.slug}`} target="_blank" rel="noreferrer" className="text-xs font-normal text-brand-text underline">
                /venues/{g.slug}
              </a>
            ) : (
              <span className="text-xs font-normal text-muted">v{g.liveVersion}</span>
            )}
          </span>
        </span>
      ),
    },
    { id: "owner", header: t("col.owner"), hideBelow: "lg", sort: (g) => g.owner.displayName, cell: (g) => g.owner.displayName ?? "–" },
    {
      id: "status",
      header: t("col.status"),
      sort: (g) => g.status,
      cell: (g) => (
        <>
          <StatusBadge status={g.status} domain="listing">
            {t(`status.${g.status}`)}
          </StatusBadge>
          {g.editStatus ? <span className="mt-0.5 block text-xs text-muted">{t(`edit.${g.editStatus}`)}</span> : null}
        </>
      ),
    },
    { id: "updated", header: t("col.updated"), sort: (g) => g.updatedAt, cell: (g) => <span className="whitespace-nowrap text-muted">{formatDhaka(g.updatedAt, locale)}</span> },
  ];

  const actions = (g: Row): MenuItem[] => {
    const items: MenuItem[] = [];
    if (can("manage_users") && ["live", "paused"].includes(g.status)) items.push({ label: t("suspend"), icon: <Prohibit />, danger: true, onSelect: () => setActing({ g, action: "suspend" }) });
    if (me?.isMaster && g.status === "suspended") items.push({ label: t("restore"), icon: <ArrowCounterClockwise />, onSelect: () => setActing({ g, action: "restore" }) });
    if (me?.isMaster && g.status !== "removed") items.push({ label: t("remove"), icon: <Trash />, danger: true, onSelect: () => setActing({ g, action: "remove" }) });
    return items;
  };

  return (
    <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
      <PageTitle title={t("title")} description={t("intro")} />
      {ready && !allowed ? (
        <Notice tone="error" className="mt-6 max-w-3xl">
          {t("noAccess")}
        </Notice>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <FilterBar
            search={{ value: search, onChange: (v) => set({ q: v }), label: t("search"), placeholder: t("search") }}
            selects={[
              {
                id: "status",
                label: t("statusFilter"),
                value: status,
                onChange: (v) => set({ status: v }),
                anyLabel: t("allStatuses"),
                options: STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) })),
              },
            ]}
            onClear={clear}
          />
          {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
          <DataTable
            label={t("title")}
            testId="admin-grounds"
            columns={columns}
            rows={q.data?.items}
            rowId={(g) => g.id}
            loading={q.isPending}
            error={q.error}
            onRetry={() => void q.refetch()}
            empty={{ title: t("none") }}
            rowActions={actions}
          />
        </div>
      )}
      <ReasonDialog
        open={Boolean(acting)}
        onOpenChange={(o) => {
          if (!o) {
            setActing(null);
            setError(null);
          }
        }}
        title={acting ? t(`ask.${acting.action}`, { name: acting.g.name }) : ""}
        confirmLabel={acting ? t(acting.action) : ""}
        danger={acting?.action !== "restore"}
        minLength={5}
        maxLength={300}
        busy={busy}
        error={error}
        onConfirm={(reason) => void act(reason)}
      />
    </div>
  );
}

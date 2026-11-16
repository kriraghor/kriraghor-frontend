"use client";

import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { api, problemOf } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { DataTable, FilterBar, Notice, Stat, type Column } from "@kriraghor/ui/kit";
import { stepUp } from "@/lib/admin/stepUp";
import { useUrlFilters } from "@/lib/use-url-filters";
import { CodeDialog } from "./CodeDialog";
import { formatDhaka, useAdminMe } from "./useAdminMe";

const STATUSES = ["dead", "failed", "pending"] as const;
type Status = (typeof STATUSES)[number];
const LAG_ALERT_SECONDS = 60; // M04 §4: alert banner when the oldest pending event is older than 60 s

type Row = components["schemas"]["OutboxEventItem"];

/** M04 §4 /admin/events (master, ops): outbox health, failed relays, dead letters and replay. */
export function EventsOps() {
  // The status filter lives in the URL (useSearchParams), so the desk renders inside Suspense.
  return (
    <Suspense fallback={<div className="mx-auto mt-8 h-40 max-w-[1320px] kg-shimmer rounded-card bg-surface-2" />}>
      <EventsDesk />
    </Suspense>
  );
}

function EventsDesk() {
  const t = useTranslations("eventsOps");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready } = useAdminMe();
  const { values, set } = useUrlFilters({ status: { default: "dead", allowed: STATUSES } });
  const status = values.status as Status;
  const [replaying, setReplaying] = useState<{ id: string; consumer: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The events endpoint has no cursor: one page of up to 100, refreshed every 10 s.
  const q = useQuery({
    queryKey: ["events-ops", status],
    enabled: ready,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await api("admin").GET("/admin/events", { params: { query: { status, limit: 100 } } });
      if (error) throw error;
      return data;
    },
  });
  const health = q.data?.health;

  const columns: Column<Row>[] = [
    { id: "name", header: t("name"), primary: true, sort: (e) => e.name, cell: (e) => <span className="font-mono text-xs">{e.name}</span> },
    { id: "occurred", header: t("occurred"), sort: (e) => e.occurredAt, cell: (e) => <span className="whitespace-nowrap">{formatDhaka(e.occurredAt, locale)}</span> },
    { id: "consumer", header: t("consumer"), cell: (e) => <span className="font-mono text-xs">{e.consumer ?? e.consumers.join(", ")}</span> },
    { id: "attempts", header: t("attempts"), align: "end", sort: (e) => e.attempts, cell: (e) => e.attempts },
    {
      id: "error",
      header: t("error"),
      hideBelow: "lg",
      cell: (e) => (
        <span className="block max-w-xs truncate text-xs text-danger" title={e.lastError ?? ""}>
          {e.lastError ?? ""}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t("intro")}</p>

        <div className="mt-6 grid max-w-xl grid-cols-2 gap-4">
          <Stat label={t("pending")} value={<span data-testid="events-pending">{health?.pending ?? "–"}</span>} />
          <Stat label={t("oldest")} value={health ? (health.oldestPendingSeconds == null ? t("none") : t("seconds", { n: health.oldestPendingSeconds })) : "–"} />
        </div>
        {health && (health.oldestPendingSeconds ?? 0) > LAG_ALERT_SECONDS ? (
          <div className="mt-4 max-w-3xl">
            <Notice tone="error">{t("lagAlert")}</Notice>
          </div>
        ) : null}
        {notice ? (
          <div className="mt-4 max-w-3xl">
            <Notice>{notice}</Notice>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-4">
          <FilterBar chips={{ label: t("title"), value: status, onChange: (v) => set({ status: v }), options: STATUSES.map((s) => ({ value: s, label: t(`tabs.${s}`) })) }} />
          <DataTable
            label={t(`tabs.${status}`)}
            testId="events-table"
            columns={columns}
            rows={q.data?.items}
            rowId={(e) => `${e.id}-${e.consumer ?? ""}`}
            loading={!ready || q.isPending}
            error={q.error}
            onRetry={() => void q.refetch()}
            empty={{ title: t("empty") }}
            rowActions={(e) =>
              e.status === "dead" && e.consumer ? [{ label: t("replay"), icon: <ArrowCounterClockwise />, onSelect: () => setReplaying({ id: e.id, consumer: e.consumer! }) }] : []
            }
          />
        </div>
      </div>

      {replaying ? (
        <CodeDialog
          title={t("replay")}
          help={t("replayHelp", { consumer: replaying.consumer })}
          confirmLabel={t("replay")}
          onClose={() => setReplaying(null)}
          onConfirm={async (code) => {
            const token = await stepUp(code, "events.replay");
            const { error } = await api("admin").POST("/admin/events/{id}/replay", {
              params: { path: { id: replaying.id }, header: { "x-step-up": token } },
              body: { consumer: replaying.consumer },
            });
            if (error) throw problemOf(error);
            setReplaying(null);
            setNotice(t("replayed"));
            await qc.invalidateQueries({ queryKey: ["events-ops"] });
          }}
        />
      ) : null}
    </>
  );
}

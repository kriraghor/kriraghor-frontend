"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { api, problemOf } from "@/lib/api/client";
import { stepUp } from "@/lib/admin/stepUp";
import { Notice } from "../ui";
import { AdminSubnav } from "./AdminSubnav";
import { CodeDialog } from "./CodeDialog";
import { formatDhaka, useAdminMe } from "./useAdminMe";

type Status = "dead" | "failed" | "pending";
const LAG_ALERT_SECONDS = 60; // M04 §4: alert banner when the oldest pending event is older than 60 s

/** M04 §4 /admin/events (master, ops): outbox health, failed relays, dead letters and replay. */
export function EventsOps() {
  const t = useTranslations("eventsOps");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready } = useAdminMe();
  const [status, setStatus] = useState<Status>("dead");
  const [replaying, setReplaying] = useState<{ id: string; consumer: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  return (
    <>
      <AdminSubnav />
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t("intro")}</p>

        <dl className="mt-6 grid max-w-xl grid-cols-2 gap-4">
          <div className="border-2 border-line bg-surface p-4">
            <dt className="text-sm font-semibold text-muted">{t("pending")}</dt>
            <dd className="text-3xl font-extrabold tabular-nums" data-testid="events-pending">
              {health?.pending ?? "–"}
            </dd>
          </div>
          <div className="border-2 border-line bg-surface p-4">
            <dt className="text-sm font-semibold text-muted">{t("oldest")}</dt>
            <dd className="text-3xl font-extrabold tabular-nums">{health ? (health.oldestPendingSeconds == null ? t("none") : t("seconds", { n: health.oldestPendingSeconds })) : "–"}</dd>
          </div>
        </dl>
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

        <div role="tablist" aria-label={t("title")} className="mt-6 flex gap-1 border-b-2 border-line">
          {(["dead", "failed", "pending"] as const).map((s) => (
            <button key={s} role="tab" type="button" aria-selected={status === s} onClick={() => setStatus(s)} className={`min-h-11 border-b-4 px-4 text-sm font-bold ${status === s ? "border-brand text-ink" : "border-transparent text-muted"}`}>
              {t(`tabs.${s}`)}
            </button>
          ))}
        </div>

        <div role="tabpanel" className="mt-4 overflow-x-auto border-2 border-line bg-surface">
          {q.isPending ? (
            <p className="p-5 text-muted" role="status">
              {t("loading")}
            </p>
          ) : q.isError ? (
            <div className="p-5">
              <Notice tone="error">{problemOf(q.error)?.title ?? "Error"}</Notice>
            </div>
          ) : !q.data?.items.length ? (
            <p className="p-5 text-muted">{t("empty")}</p>
          ) : (
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b-2 border-line">
                <tr>
                  {[t("name"), t("occurred"), t("consumer"), t("attempts"), t("error"), ""].map((h, i) => (
                    <th key={i} scope="col" className="px-4 py-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {q.data.items.map((e) => (
                  <tr key={`${e.id}-${e.consumer ?? ""}`}>
                    <td className="px-4 py-2 font-mono text-xs">{e.name}</td>
                    <td className="whitespace-nowrap px-4 py-2">{formatDhaka(e.occurredAt, locale)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{e.consumer ?? e.consumers.join(", ")}</td>
                    <td className="px-4 py-2 tabular-nums">{e.attempts}</td>
                    <td className="max-w-xs truncate px-4 py-2 text-xs text-danger" title={e.lastError ?? ""}>
                      {e.lastError ?? ""}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {e.status === "dead" && e.consumer ? (
                        <button type="button" className="min-h-11 border-2 border-line px-3 text-xs font-semibold" onClick={() => setReplaying({ id: e.id, consumer: e.consumer! })}>
                          {t("replay")}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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

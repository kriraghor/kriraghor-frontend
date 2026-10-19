"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@kriraghor/api-client";
import { formatDhaka } from "./useAdminMe";

/**
 * Audit trail of one entity (M04 §4 "Entity History tab"). Masters see every row; other staff only the
 * rows where they acted (the API enforces it). Reused on settings, users, grounds, tournaments…
 */
export function EntityHistory({ entityType, entityId }: { entityType: string; entityId: string }) {
  const t = useTranslations("audit");
  const locale = useLocale();
  const q = useQuery({
    queryKey: ["entity-history", entityType, entityId],
    queryFn: async () => {
      const { data, error } = await api("admin").GET("/admin/entities/{entityType}/{entityId}/history", { params: { path: { entityType, entityId }, query: { limit: 50 } } });
      if (error) throw error;
      return data.items;
    },
  });

  return (
    <section aria-labelledby={`history-${entityType}`} className="mt-6">
      <h3 id={`history-${entityType}`} className="text-base font-bold">
        {t("history")}
      </h3>
      {q.isPending ? (
        <p className="mt-2 text-sm text-muted" role="status">
          {t("loading")}
        </p>
      ) : !q.data?.length ? (
        <p className="mt-2 text-sm text-muted">{t("historyEmpty")}</p>
      ) : (
        <ol className="mt-2 grid gap-2">
          {q.data.map((e) => (
            <li key={e.id} className="border-l-4 border-line pl-3 text-sm" data-testid="entity-history-item">
              <p className="font-semibold">
                {locale === "bn" ? e.summary.bn : e.summary.en}
                {e.stepUp ? <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-text">{t("stepUpBadge")}</span> : null}
              </p>
              <p className="text-muted">
                {formatDhaka(e.occurredAt, locale)} · {e.actor.name ?? t("system")}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

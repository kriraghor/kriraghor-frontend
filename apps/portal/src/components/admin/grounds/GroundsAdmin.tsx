"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { groundsAdmin, type StaffGroundRow } from "@/lib/admin/grounds";
import { problemOf } from "@kriraghor/api-client";
import { publicEnv } from "@kriraghor/session/env";
import { Notice } from "@kriraghor/ui/primitives";
import { AdminSubnav } from "../AdminSubnav";
import { formatDhaka, useAdminMe } from "../useAdminMe";
import { Chip, inputCls } from "../finance/shared";

const TONE: Record<string, "ok" | "warn" | "bad" | "muted"> = { live: "ok", pending_review: "warn", changes_requested: "warn", paused: "muted", suspended: "bad", rejected: "bad", removed: "bad", draft: "muted", withdrawn: "muted" };
const STATUSES = ["", "live", "pending_review", "paused", "suspended", "rejected", "removed"] as const;

/**
 * /admin/grounds (M09): every ground with its owner and status. Ops (manage_users) suspend a live or
 * paused ground; masters restore and remove (a status, never deleted). Reviews are on the Moderation desk.
 */
export function GroundsAdmin() {
  const t = useTranslations("groundsAdmin");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready, me } = useAdminMe();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("");
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const can = (p: string) => Boolean(me && (me.isMaster || me.permissions.includes(p as never)));
  const allowed = can("approve_listings") || can("manage_users");
  const q = useQuery({
    queryKey: ["admin-grounds", status, search],
    enabled: ready && allowed,
    queryFn: () => groundsAdmin.list({ ...(status ? { status } : {}), ...(search.trim() ? { q: search.trim() } : {}) }),
  });

  async function act(g: StaffGroundRow, action: "suspend" | "restore" | "remove") {
    const reason = window.prompt(t(`ask.${action}`, { name: g.name }));
    if (!reason || reason.trim().length < 5) return;
    setMsg(null);
    try {
      await groundsAdmin.act(g.id, action, reason.trim());
      await qc.invalidateQueries({ queryKey: ["admin-grounds"] });
      setMsg({ text: t(`done.${action}`, { name: g.name }), tone: "info" });
    } catch (err) {
      setMsg({ text: problemOf(err)?.title ?? t("failed"), tone: "error" });
    }
  }

  return (
    <>
      <AdminSubnav />
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t("intro")}</p>
        {ready && !allowed ? (
          <div className="mt-6 max-w-3xl">
            <Notice tone="error">{t("noAccess")}</Notice>
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap gap-3">
              <select value={status} onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])} className={inputCls} aria-label={t("statusFilter")}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s ? t(`status.${s}`) : t("allStatuses")}
                  </option>
                ))}
              </select>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")} aria-label={t("search")} className={inputCls} />
            </div>
            {msg ? (
              <div className="mt-4">
                <Notice tone={msg.tone}>{msg.text}</Notice>
              </div>
            ) : null}
            <div className="mt-4 overflow-x-auto border-2 border-line">
              <table className="w-full min-w-[760px] text-sm" data-testid="admin-grounds">
                <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2">{t("col.ground")}</th>
                    <th className="px-3 py-2">{t("col.owner")}</th>
                    <th className="px-3 py-2">{t("col.status")}</th>
                    <th className="px-3 py-2">{t("col.updated")}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {(q.data?.items ?? []).map((g) => (
                    <tr key={g.id} className="border-t border-line align-top">
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-3">
                          {g.coverUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={g.coverUrl} alt="" className="h-10 w-14 object-cover" />
                          ) : null}
                          <span>
                            <span className="block font-semibold">{g.name}</span>
                            {g.status === "live" ? (
                              <a href={`${publicEnv().WEB_URL}/grounds/${g.slug}`} target="_blank" rel="noreferrer" className="text-xs text-brand underline">
                                /grounds/{g.slug}
                              </a>
                            ) : (
                              <span className="text-xs text-muted">v{g.liveVersion}</span>
                            )}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2">{g.owner.displayName ?? "–"}</td>
                      <td className="px-3 py-2">
                        <Chip tone={TONE[g.status] ?? "muted"}>{t(`status.${g.status}`)}</Chip>
                        {g.editStatus ? <span className="ml-2 text-xs text-muted">{t(`edit.${g.editStatus}`)}</span> : null}
                      </td>
                      <td className="px-3 py-2 text-muted">{formatDhaka(g.updatedAt, locale)}</td>
                      <td className="px-3 py-2 text-right">
                        <span className="inline-flex gap-2">
                          {can("manage_users") && ["live", "paused"].includes(g.status) ? (
                            <button type="button" className="text-xs font-semibold text-danger underline" onClick={() => void act(g, "suspend")}>
                              {t("suspend")}
                            </button>
                          ) : null}
                          {me?.isMaster && g.status === "suspended" ? (
                            <button type="button" className="text-xs font-semibold text-brand underline" onClick={() => void act(g, "restore")}>
                              {t("restore")}
                            </button>
                          ) : null}
                          {me?.isMaster && g.status !== "removed" ? (
                            <button type="button" className="text-xs font-semibold text-danger underline" onClick={() => void act(g, "remove")}>
                              {t("remove")}
                            </button>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {q.data && !q.data.items.length ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-muted">
                        {t("none")}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}

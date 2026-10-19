"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { problemOf } from "@kriraghor/api-client";
import { formatTaka } from "@/lib/admin/finance";
import { marketAdmin, type Action } from "@/lib/admin/market";
import { Notice } from "@kriraghor/ui/primitives";
import { AdminSubnav } from "../AdminSubnav";
import { Chip, Field, inputCls } from "../finance/shared";

const TONE: Record<string, "ok" | "warn" | "bad" | "muted"> = { live: "ok", pending_review: "warn", changes_requested: "bad", suspended: "bad", rejected: "bad", removed: "muted", paused: "muted", draft: "muted", withdrawn: "muted" };
type Row = { id: string; slug: string; name?: string; title?: string; status: string; editStatus: string | null; owner?: { displayName: string | null }; shop?: { name: string }; basePricePoisha?: number; visibility?: string };

/**
 * /admin/market (M12): shops and shop products, searchable, with suspend (manage_users), restore and
 * remove (masters), each with a reason. Reviews of shops and products happen on the Moderation desk.
 */
export function MarketAdmin() {
  const t = useTranslations("marketAdmin");
  const locale = useLocale();
  const qc = useQueryClient();
  const [what, setWhat] = useState<"shops" | "products">("shops");
  const [q, setQ] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const list = useQuery({
    queryKey: ["admin-market", what, q],
    queryFn: async () => ((what === "shops" ? await marketAdmin.shops(q ? { q } : {}) : await marketAdmin.products(q ? { q } : {})) as unknown as { items: Row[] }),
  });
  const act = async (id: string, action: Action) => {
    setMsg(null);
    if (reason.trim().length < 5) return setMsg({ text: t("reasonNeeded"), tone: "error" });
    try {
      await marketAdmin.act(what, id, action, reason.trim());
      await qc.invalidateQueries({ queryKey: ["admin-market"] });
      setMsg({ text: t(`done.${action}`), tone: "info" });
    } catch (err) {
      setMsg({ text: problemOf(err)?.title ?? t("failed"), tone: "error" });
    }
  };
  return (
    <>
      <AdminSubnav />
      <div className="mx-auto max-w-[1100px] px-5 pb-16 pt-8">
        <h1 className="text-3xl font-extrabold">{t("deskTitle")}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t("deskIntro")}</p>
        <div role="tablist" aria-label={t("deskTitle")} className="mt-6 flex flex-wrap gap-2">
          {(["shops", "products"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={what === k} onClick={() => setWhat(k)} className={`min-h-11 border-2 px-4 text-sm font-bold ${what === k ? "border-brand text-ink" : "border-line text-muted"}`}>
              {t(`tab.${k}`)}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label={t("search")}>
            <input value={q} onChange={(e) => setQ(e.target.value)} className={inputCls} />
          </Field>
          <Field label={t("reason")}>
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={inputCls} data-testid="market-reason" />
          </Field>
        </div>
        {msg ? (
          <div className="mt-3">
            <Notice tone={msg.tone}>{msg.text}</Notice>
          </div>
        ) : null}
        {list.isPending ? <div className="mt-6 h-40 animate-pulse bg-surface-2" /> : null}
        <ul className="mt-6 space-y-2" data-testid="market-admin-list">
          {(list.data?.items ?? []).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 border-2 border-line bg-surface p-3">
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{r.name ?? r.title}</span>
                <span className="block text-sm text-muted">
                  {r.owner?.displayName ?? r.shop?.name ?? ""}
                  {r.basePricePoisha ? ` · ${formatTaka(r.basePricePoisha, locale)}` : ""}
                </span>
              </span>
              <Chip tone={TONE[r.status] ?? "muted"}>{t(`status.${r.status}`)}</Chip>
              {r.visibility === "hidden_oos" ? <Chip tone="warn">{t("hiddenOos")}</Chip> : null}
              {["live", "paused"].includes(r.status) ? (
                <button type="button" className="min-h-10 border-2 border-danger px-3 text-sm font-semibold text-danger" onClick={() => void act(r.id, "suspend")}>
                  {t("suspend")}
                </button>
              ) : null}
              {r.status === "suspended" ? (
                <button type="button" className="min-h-10 border-2 border-brand px-3 text-sm font-semibold" onClick={() => void act(r.id, "restore")}>
                  {t("restore")}
                </button>
              ) : null}
              {r.status !== "removed" && r.status !== "pending_review" ? (
                <button type="button" className="min-h-10 border-2 border-line px-3 text-sm font-semibold" onClick={() => void act(r.id, "remove")}>
                  {t("remove")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

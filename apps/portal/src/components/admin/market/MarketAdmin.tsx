"use client";

import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowCounterClockwise, Prohibit, Trash } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { Badge, DataTable, FilterBar, Notice, PageTitle, ReasonDialog, Skeleton, Tabs, type Column, type MenuItem } from "@kriraghor/ui/kit";
import { formatTaka } from "@/lib/admin/finance";
import { marketAdmin, type Action } from "@/lib/admin/market";
import { useUrlFilters } from "@/lib/use-url-filters";
import { StatusBadge } from "../../StatusBadge";

/** Shops and products share one list shape here (the two staff lists differ only in these fields). */
type Row = { id: string; slug: string; name?: string; title?: string; status: string; editStatus: string | null; owner?: { displayName: string | null }; shop?: { name: string }; basePricePoisha?: number; visibility?: string };
const TABS = ["shops", "products"] as const;
type What = (typeof TABS)[number];

/**
 * /admin/market (M12): shops and shop products, searchable, with suspend (manage_users), restore and
 * remove (masters), each with a reason. Reviews of shops and products happen on the Moderation desk.
 */
export function MarketAdmin() {
  // The tab and the search live in the URL (useSearchParams), so the desk renders inside Suspense.
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-10 h-64 max-w-[1200px]" />}>
      <Desk />
    </Suspense>
  );
}

function Desk() {
  const t = useTranslations("marketAdmin");
  const { values, set } = useUrlFilters({ tab: { default: "shops", allowed: TABS } });
  return (
    <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-8">
      <PageTitle title={t("deskTitle")} description={t("deskIntro")} />
      <Tabs
        className="mt-6"
        label={t("deskTitle")}
        value={values.tab}
        onValueChange={(v) => set({ tab: v, q: null })}
        items={TABS.map((k) => ({ value: k, label: t(`tab.${k}`), testId: `market-tab-${k}`, content: <List what={k} /> }))}
      />
    </div>
  );
}

function List({ what }: { what: What }) {
  const t = useTranslations("marketAdmin");
  const locale = useLocale();
  const qc = useQueryClient();
  const { values, set, clear } = useUrlFilters({ q: { default: "" } });
  const q = values.q;
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const [acting, setActing] = useState<{ r: Row; action: Action } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["admin-market", what, q],
    queryFn: async () => ((what === "shops" ? await marketAdmin.shops(q ? { q } : {}) : await marketAdmin.products(q ? { q } : {})) as unknown as { items: Row[] }),
  });

  async function act(reason: string) {
    if (!acting) return;
    const { r, action } = acting;
    setMsg(null);
    setError(null);
    setBusy(true);
    try {
      await marketAdmin.act(what, r.id, action, reason);
      await qc.invalidateQueries({ queryKey: ["admin-market"] });
      setActing(null);
      setMsg({ text: t(`done.${action}`), tone: "info" });
    } catch (err) {
      setError(problemOf(err)?.title ?? t("failed"));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<Row>[] = [
    { id: "name", header: what === "shops" ? t("name") : t("title"), primary: true, sort: (r) => r.name ?? r.title, cell: (r) => <span className="font-semibold">{r.name ?? r.title}</span> },
    what === "shops"
      ? { id: "owner", header: t("owner"), sort: (r) => r.owner?.displayName, cell: (r) => r.owner?.displayName ?? "–" }
      : { id: "shop", header: t("shop"), sort: (r) => r.shop?.name, cell: (r) => r.shop?.name ?? "–" },
    ...(what === "products" ? [{ id: "price", header: t("basePrice"), align: "end", sort: (r) => r.basePricePoisha, cell: (r) => (r.basePricePoisha ? formatTaka(r.basePricePoisha, locale) : "–") } satisfies Column<Row>] : []),
    {
      id: "status",
      header: t("col.status"),
      sort: (r) => r.status,
      cell: (r) => (
        <span className="inline-flex flex-wrap gap-1.5">
          <StatusBadge status={r.status} domain="market">
            {t(`status.${r.status}`)}
          </StatusBadge>
          {r.visibility === "hidden_oos" ? <Badge tone="warning">{t("hiddenOos")}</Badge> : null}
        </span>
      ),
    },
  ];

  const actions = (r: Row): MenuItem[] => {
    const items: MenuItem[] = [];
    if (["live", "paused"].includes(r.status)) items.push({ label: t("suspend"), icon: <Prohibit />, danger: true, onSelect: () => setActing({ r, action: "suspend" }) });
    if (r.status === "suspended") items.push({ label: t("restore"), icon: <ArrowCounterClockwise />, onSelect: () => setActing({ r, action: "restore" }) });
    if (r.status !== "removed" && r.status !== "pending_review") items.push({ label: t("remove"), icon: <Trash />, danger: true, onSelect: () => setActing({ r, action: "remove" }) });
    return items;
  };

  return (
    <div className="flex flex-col gap-4">
      <FilterBar search={{ value: q, onChange: (v) => set({ q: v }), label: t("search") }} onClear={clear} />
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <DataTable
        label={t(`tab.${what}`)}
        testId="market-admin-list"
        columns={columns}
        rows={list.data?.items}
        rowId={(r) => r.id}
        loading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
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
        title={acting ? `${t(acting.action)}: ${acting.r.name ?? acting.r.title ?? ""}` : ""}
        label={t("reason")}
        confirmLabel={acting ? t(acting.action) : ""}
        danger={acting?.action !== "restore"}
        minLength={5}
        maxLength={300}
        busy={busy}
        error={error}
        onConfirm={(reason) => void act(reason)}
        testId="market-reason"
      />
    </div>
  );
}

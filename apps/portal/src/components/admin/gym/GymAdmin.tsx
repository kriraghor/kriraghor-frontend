"use client";

import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowCounterClockwise, MagnifyingGlass, Prohibit, Trash } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { Badge, Button, Card, DataTable, Dialog, Field, FilterBar, Notice, PageTitle, ReasonDialog, Skeleton, Tabs, Textarea, type Column, type MenuItem } from "@kriraghor/ui/kit";
import { formatTaka } from "@/lib/admin/finance";
import { gymAdmin, heldOf, removalSummary, type GymRemoved, type GymStatus, type StaffPass, type StaffSubscription } from "@/lib/admin/gym";
import { stepUp } from "@/lib/admin/stepUp";
import { useUrlFilters } from "@/lib/use-url-filters";
import { StatusBadge } from "../../StatusBadge";
import { CodeDialog } from "../CodeDialog";
import { formatDhaka, useAdminMe } from "../useAdminMe";

type Row = Awaited<ReturnType<typeof gymAdmin.gyms>>["items"][number];
type Period = StaffSubscription["periods"][number];

// "draft" is a private gym (M24 §4.4: managed on gym.kriraghor.com, never listed): the "Private (management only)" filter.
const GYM_STATUSES = ["pending_review", "live", "paused", "suspended", "changes_requested", "rejected", "draft"] as const;
const TABS = ["gyms", "passes", "subscriptions"] as const;

/**
 * /admin/gym (M20): gyms (suspend with manage_users, restore for masters, with a reason; a master
 * removes any gym with a reason and a step-up code (M20-FR-15); the review itself is on the Moderation desk), a pass by its code with its escrow hold and a master's platform
 * cancel (refunds what is held; step-up escrow.manage), and a trainer subscription by its code.
 */
export function GymAdmin() {
  // The tab and the filters live in the URL (useSearchParams), so the desk renders inside Suspense.
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-10 h-64 max-w-[1200px]" />}>
      <Desk />
    </Suspense>
  );
}

function Desk() {
  const t = useTranslations("gymAdmin");
  const { values, set } = useUrlFilters({ tab: { default: "gyms", allowed: TABS } });
  return (
    <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-8">
      <PageTitle title={t("title")} description={t("intro")} />
      <Tabs
        className="mt-6"
        label={t("title")}
        value={values.tab}
        onValueChange={(v) => set({ tab: v, status: null, q: null })}
        items={TABS.map((k) => ({ value: k, label: t(`tab.${k}`), testId: `gym-tab-${k}`, content: k === "gyms" ? <Gyms /> : k === "passes" ? <Passes /> : <Subscriptions /> }))}
      />
    </div>
  );
}

function Gyms() {
  const t = useTranslations("gymAdmin");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready, me } = useAdminMe();
  const { values, set, clear } = useUrlFilters({ status: { default: "", allowed: ["", ...GYM_STATUSES] }, q: { default: "" } });
  const status = values.status as (typeof GYM_STATUSES)[number] | "";
  const search = values.q;
  const [acting, setActing] = useState<{ id: string; name: string; action: "suspend" | "restore" | "remove" } | null>(null);
  // Remove (M20-FR-15): the reason first, then the master's authenticator code, then what it did.
  const [removing, setRemoving] = useState<{ id: string; name: string; reason: string } | null>(null);
  const [removed, setRemoved] = useState<(GymRemoved & { name: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useQuery({ queryKey: ["admin-gyms", status, search], queryFn: () => gymAdmin.gyms({ status: (status || undefined) as GymStatus | undefined, q: search || undefined }), enabled: ready });
  const month = (g: { packages: { kind: string; price: number }[] }) => g.packages.find((p) => p.kind === "month")?.price;
  const isMaster = Boolean(me?.isMaster);
  const canSuspend = Boolean(me && (me.isMaster || me.permissions.includes("manage_users" as never)));

  async function act(reason: string) {
    if (!acting) return;
    if (acting.action === "remove") {
      setRemoving({ id: acting.id, name: acting.name, reason });
      setActing(null);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await (acting.action === "suspend" ? gymAdmin.suspend(acting.id, reason) : gymAdmin.restore(acting.id, reason));
      setActing(null);
      await qc.invalidateQueries({ queryKey: ["admin-gyms"] });
    } catch (err) {
      setError(problemOf(err)?.title ?? t("failed"));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<Row>[] = [
    {
      id: "name",
      header: t("name"),
      primary: true,
      sort: (g) => g.name,
      cell: (g) => (
        <>
          <span className="block font-semibold">{g.name}</span>
          <span className="block text-xs font-normal text-muted">{g.addressLine}</span>
        </>
      ),
    },
    { id: "month", header: t("monthPrice"), align: "end", sort: (g) => month(g), cell: (g) => (month(g) !== undefined ? formatTaka(month(g)!, locale) : "–") },
    {
      id: "status",
      header: t("status"),
      sort: (g) => g.status,
      cell: (g) => (
        <StatusBadge status={g.status} domain="gym">
          {g.status === "draft" ? t("private") : t(`gymStatus.${g.status}`)}
        </StatusBadge>
      ),
    },
  ];

  const actions = (g: Row): MenuItem[] => {
    const items: MenuItem[] = [];
    if (canSuspend && (g.status === "live" || g.status === "paused")) items.push({ label: t("suspend"), icon: <Prohibit />, danger: true, onSelect: () => setActing({ id: g.id, name: g.name, action: "suspend" }) });
    if (g.status === "suspended" && isMaster) items.push({ label: t("restore"), icon: <ArrowCounterClockwise />, onSelect: () => setActing({ id: g.id, name: g.name, action: "restore" }) });
    if (isMaster && g.status !== "removed") items.push({ label: t("remove"), icon: <Trash />, danger: true, onSelect: () => setActing({ id: g.id, name: g.name, action: "remove" }) });
    return items;
  };

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        search={{ value: search, onChange: (v) => set({ q: v }), label: t("name") }}
        selects={[{ id: "status", label: t("status"), value: status, onChange: (v) => set({ status: v }), anyLabel: t("all"), options: GYM_STATUSES.map((s) => ({ value: s, label: s === "draft" ? t("privateFilter") : t(`gymStatus.${s}`) })) }]}
        onClear={clear}
      />
      <DataTable
        label={t("tab.gyms")}
        testId="admin-gyms"
        columns={columns}
        rows={list.data?.items}
        rowId={(g) => g.id}
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
        title={acting ? t(`${acting.action}Title`, { name: acting.name }) : ""}
        description={acting?.action === "remove" ? t("removeHelp") : undefined}
        label={t("reason")}
        confirmLabel={acting ? t(acting.action) : ""}
        danger={acting?.action === "suspend" || acting?.action === "remove"}
        minLength={5}
        maxLength={300}
        busy={busy}
        error={error}
        onConfirm={(reason) => void act(reason)}
        testId={acting?.action === "remove" ? "gym-remove" : undefined}
      />
      {removing ? (
        <CodeDialog
          title={t("removeCodeTitle", { name: removing.name })}
          help={t("removeCodeHelp")}
          confirmLabel={t("remove")}
          onClose={() => setRemoving(null)}
          onConfirm={async (c) => {
            const token = await stepUp(c, "escrow.manage");
            const res = await gymAdmin.remove(removing.id, removing.reason, token);
            setRemoving(null);
            setRemoved({ ...res, name: removing.name });
            await qc.invalidateQueries({ queryKey: ["admin-gyms"] });
          }}
        />
      ) : null}
      <RemovedDialog result={removed} onClose={() => setRemoved(null)} />
    </div>
  );
}

/** What a master's remove did: how many running subscriptions were refunded, and what support settles with the owner. */
function RemovedDialog({ result, onClose }: { result: (GymRemoved & { name: string }) | null; onClose: () => void }) {
  const t = useTranslations("gymAdmin");
  const locale = useLocale();
  const sum = result ? removalSummary(result) : null;
  return (
    <Dialog
      open={Boolean(result)}
      onOpenChange={(o) => (o ? undefined : onClose())}
      title={result ? t("removedTitle", { name: result.name }) : ""}
      footer={
        <Button type="button" onClick={onClose} data-testid="gym-removed-close">
          {t("close")}
        </Button>
      }
    >
      {result && sum ? (
        <div className="flex flex-col gap-3 px-6 pb-4 text-sm" data-testid="gym-removed">
          <p>{t("removedRefunded", { count: sum.refundedCount, amount: formatTaka(sum.refundedTotal, locale) })}</p>
          {result.paidToGym.length ? (
            <Notice tone="warning">
              <p>{t("removedPaidToGym", { amount: formatTaka(sum.paidToGymTotal, locale) })}</p>
              <ul className="mt-2 flex flex-col gap-1">
                {result.paidToGym.map((p) => (
                  <li key={p.code} className="tabular">
                    <span className="font-mono">{p.code}</span> · {t("removedPaidLine", { paid: formatTaka(p.paidToGym, locale), held: formatTaka(p.heldBefore, locale) })}
                  </li>
                ))}
              </ul>
            </Notice>
          ) : (
            <p className="text-muted">{t("removedNothingPaid")}</p>
          )}
        </div>
      ) : null}
    </Dialog>
  );
}

/** A code lookup: the field and Find. */
function Lookup({ id, label, placeholder, testId, onFind }: { id: string; label: string; placeholder: string; testId: string; onFind: (code: string) => void }) {
  const t = useTranslations("gymAdmin");
  const [code, setCode] = useState("");
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onFind(code.trim().toUpperCase());
      }}
    >
      <Field id={id} label={label} value={code} onChange={(e) => setCode(e.target.value)} placeholder={placeholder} className="w-full sm:w-72" data-testid={testId} />
      <Button type="submit" icon={<MagnifyingGlass size={18} aria-hidden />}>
        {t("find")}
      </Button>
    </form>
  );
}

function Passes() {
  const t = useTranslations("gymAdmin");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready } = useAdminMe();
  const [open, setOpen] = useState("");
  const [cancelling, setCancelling] = useState<StaffPass | null>(null);
  const [reason, setReason] = useState("");
  const q = useQuery({ queryKey: ["admin-gym-pass", open], queryFn: () => gymAdmin.pass(open), enabled: ready && Boolean(open), retry: false });
  const money = (n: number) => formatTaka(n, locale);
  const p = q.data;
  return (
    <div className="flex flex-col gap-4">
      <Lookup id="gym-pass-code" label={t("passCode")} placeholder="GP-26-000123" testId="gym-pass-code" onFind={setOpen} />
      {q.isError ? <Notice tone="error">{problemOf(q.error)?.title ?? t("failed")}</Notice> : null}
      {open && q.isPending ? <Skeleton className="h-48" /> : null}
      {p ? (
        <Card data-testid="gym-pass">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xl font-bold">{p.code}</span>
            <StatusBadge status={p.status} domain="pass">
              {t(`passStatus.${p.status}`)}
            </StatusBadge>
          </div>
          <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted">{t("gym")}</dt>
            <dd>{p.gym?.name ?? "–"}</dd>
            <dt className="text-muted">{t("pass")}</dt>
            <dd>
              {t(`kind.${p.kind}`)} · {p.validFrom === p.validTo ? p.validFrom : `${p.validFrom} – ${p.validTo}`}
            </dd>
            <dt className="text-muted">{t("money")}</dt>
            <dd className="tabular">{t("moneyLine", { price: money(p.money.price), fee: money(p.money.fee), net: money(p.money.net), released: money(p.money.released), refunded: money(p.money.refunded) })}</dd>
            <dt className="text-muted">{t("paidAt")}</dt>
            <dd>{p.paidAt ? formatDhaka(p.paidAt, locale) : "–"}</dd>
            <dt className="text-muted">{t("firstUse")}</dt>
            <dd>{p.firstRedeemedAt ? formatDhaka(p.firstRedeemedAt, locale) : "–"}</dd>
            <dt className="text-muted">{t("escrow")}</dt>
            <dd className="break-all font-mono text-xs">{p.escrow ? JSON.stringify(p.escrow) : "–"}</dd>
          </dl>
          {p.status === "active" && heldOf(p) > 0 ? (
            <Button type="button" variant="danger" className="mt-5" onClick={() => setCancelling(p)} data-testid="gym-pass-cancel">
              {t("cancelPass", { amount: money(heldOf(p)) })}
            </Button>
          ) : null}
        </Card>
      ) : null}
      {cancelling ? (
        <CodeDialog
          title={t("cancelTitle", { code: cancelling.code })}
          help={t("cancelHelp", { amount: money(heldOf(cancelling)) })}
          onClose={() => setCancelling(null)}
          onConfirm={async (c) => {
            if (reason.trim().length < 5) throw { code: "VALIDATION_FAILED", title: t("reasonNeeded"), status: 422 };
            const token = await stepUp(c, "escrow.manage");
            await gymAdmin.cancelPass(cancelling.code, reason.trim(), token);
            setCancelling(null);
            await qc.invalidateQueries({ queryKey: ["admin-gym-pass", open] });
          }}
        >
          <Textarea id="gym-cancel-reason" className="mt-4" label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        </CodeDialog>
      ) : null}
    </div>
  );
}

function Subscriptions() {
  const t = useTranslations("gymAdmin");
  const locale = useLocale();
  const { ready } = useAdminMe();
  const [open, setOpen] = useState("");
  const q = useQuery({ queryKey: ["admin-gym-sub", open], queryFn: () => gymAdmin.subscription(open), enabled: ready && Boolean(open), retry: false });
  const money = (n: number) => formatTaka(n, locale);
  const s = q.data;
  const columns: Column<Period>[] = [
    { id: "seq", header: "#", width: "3rem", cell: (p) => p.seq },
    { id: "period", header: t("period"), primary: true, cell: (p) => `${p.periodStart} – ${p.periodEnd}` },
    { id: "status", header: t("status"), cell: (p) => t(`periodStatus.${p.status}`) },
    { id: "price", header: t("price"), align: "end", cell: (p) => money(p.price) },
    { id: "released", header: t("released"), align: "end", cell: (p) => money(p.released) },
    { id: "refunded", header: t("refundedCol"), align: "end", cell: (p) => money(p.refunded) },
    { id: "releaseAt", header: t("releaseAt"), hideBelow: "lg", cell: (p) => (p.releaseAt ? formatDhaka(p.releaseAt, locale) : "–") },
  ];
  return (
    <div className="flex flex-col gap-4">
      <Lookup id="gym-sub-code" label={t("subCode")} placeholder="TS-26-000123" testId="gym-sub-code" onFind={setOpen} />
      {q.isError ? <Notice tone="error">{problemOf(q.error)?.title ?? t("failed")}</Notice> : null}
      {open && q.isPending ? <Skeleton className="h-48" /> : null}
      {s ? (
        <Card data-testid="gym-sub">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xl font-bold">{s.code}</span>
            <Badge tone={s.status === "active" ? "brand" : s.status === "lapsed" ? "danger" : "neutral"}>{t(`subStatus.${s.status}`)}</Badge>
          </div>
          <p className="mt-2 text-sm">
            {s.title} · {t("perMonth", { price: money(s.price) })} · {t("startedOn", { date: s.startedOn })}
            {s.paidThrough ? ` · ${t("paidThrough", { date: s.paidThrough })}` : ""}
          </p>
          <DataTable className="mt-4" label={t("period")} columns={columns} rows={s.periods} rowId={(p) => String(p.seq)} />
        </Card>
      ) : null}
    </div>
  );
}

"use client";

import { Suspense, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Medal, Plus, Prohibit, XCircle } from "@phosphor-icons/react";
import { Badge, Button, Card, DataTable, DetailLayout, Field, FilterBar, Notice, PageTitle, Select, Skeleton, Tabs, Textarea, type Column, type MenuItem } from "@kriraghor/ui/kit";
import { DateTimePicker, MonthPicker } from "@kriraghor/ui/date";
import { formatTaka } from "@/lib/admin/finance";
import {
  canWrite,
  deskTabs,
  foundingParam,
  gymManageAdmin,
  INVOICE_STATUSES,
  invoiceTotals,
  overrideBody,
  overrideValue,
  periodParam,
  problemInfo,
  REFERRAL_KEY,
  SAAS_TIERS,
  SUB_STATUSES,
  voidable,
  type AdminInvoice,
  type DeskTab,
  type FeeOverride,
  type InvoiceStatus,
  type OverrideForm,
  type OwnerRow,
  type SaasTier,
  type SubStatus,
} from "@/lib/admin/gymManage";
import { stepUp } from "@/lib/admin/stepUp";
import { useUrlFilters } from "@/lib/use-url-filters";
import { StatusBadge } from "../../StatusBadge";
import { CodeDialog } from "../CodeDialog";
import { formatDhaka, useAdminMe } from "../useAdminMe";

const TABS = ["owners", "invoices", "overrides"] as const;

/**
 * /admin/gym-manage (M24 §4.4, §9.2): the gym management system's owners (plan, status, founding
 * partner, active members, gyms, invoices, overrides and imports, counts only), every plan invoice
 * with totals per status, and the per-owner and per-gym fee overrides. manage_gyms and view_payouts
 * read (the overrides need manage_gyms); masters write, each change with a fresh authenticator code:
 * founding partner on or off and overrides (step-up settings.write), voiding an invoice (escrow.manage).
 */
export function GymManageDesk() {
  // The tab, the filters and the open owner live in the URL (useSearchParams): render inside Suspense.
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-10 h-64 max-w-[1320px]" />}>
      <Desk />
    </Suspense>
  );
}

/** A problem as this desk's words: its M24 codes (with the bounds for out-of-bounds), else the API's title. */
function useErrText() {
  const t = useTranslations("gymManageDesk");
  const locale = useLocale();
  return (err: unknown, key?: string) => {
    const p = problemInfo(err);
    if (p.code === "GYM_OVERRIDE_OUT_OF_BOUNDS" && p.min !== undefined && p.max !== undefined)
      return t("err.GYM_OVERRIDE_OUT_OF_BOUNDS_RANGE", { min: key === REFERRAL_KEY ? formatTaka(p.min, locale) : `${p.min}%`, max: key === REFERRAL_KEY ? formatTaka(p.max, locale) : `${p.max}%` });
    if (p.code && t.has(`err.${p.code}`)) return t(`err.${p.code}`);
    return p.title ?? t("failed");
  };
}

/** Run a step-up write; a failure comes back as a problem with this desk's words (CodeDialog shows its title). */
async function guarded(run: () => Promise<unknown>, text: (err: unknown) => string) {
  try {
    await run();
  } catch (err) {
    throw { ...(typeof err === "object" && err ? err : {}), code: problemInfo(err).code ?? "UNKNOWN", status: 0, title: text(err) };
  }
}

function Desk() {
  const t = useTranslations("gymManageDesk");
  const { ready, me } = useAdminMe();
  const { values, set } = useUrlFilters({ tab: { default: "owners", allowed: TABS } });
  const tabs = deskTabs(me);
  if (!ready) return <Skeleton className="mx-auto mt-10 h-64 max-w-[1320px]" />;
  const tab = (tabs.includes(values.tab as DeskTab) ? values.tab : tabs[0]) as DeskTab | undefined;
  const panes: Record<DeskTab, ReactNode> = { owners: <Owners canOverrides={tabs.includes("overrides")} />, invoices: <Invoices />, overrides: <Overrides /> };
  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-16 pt-8 sm:px-5" data-testid="gym-manage-desk">
      <PageTitle title={t("title")} description={t("intro")} />
      {!tab ? (
        <Notice tone="warning" className="mt-6">
          {t("noAccess")}
        </Notice>
      ) : (
        <>
          {!canWrite(me) ? (
            <div className="mt-4" data-testid="gym-manage-readonly">
              <Notice tone="info">{t("readOnly")}</Notice>
            </div>
          ) : null}
          <Tabs
            className="mt-6"
            label={t("title")}
            value={tab}
            onValueChange={(v) => set({ tab: v, id: null, status: null, tier: null, founding: null, period: null, owner: null })}
            items={tabs.map((k) => ({ value: k, label: t(`tab.${k}`), testId: `gm-tab-${k}`, content: <div className="pt-4">{panes[k]}</div> }))}
          />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- owners

function Owners({ canOverrides }: { canOverrides: boolean }) {
  const t = useTranslations("gymManageDesk");
  const locale = useLocale();
  const { values, set, clear, params } = useUrlFilters({ status: { default: "", allowed: ["", ...SUB_STATUSES] }, tier: { default: "", allowed: ["", ...SAAS_TIERS] }, founding: { default: "", allowed: ["", "true", "false"] } });
  const open = params.get("id");
  const q = { tier: (values.tier || undefined) as SaasTier | undefined, status: (values.status || undefined) as SubStatus | undefined, founding: foundingParam(values.founding) };
  const list = useQuery({ queryKey: ["admin-gm-owners", q], queryFn: () => gymManageAdmin.owners(q) });
  const openRow = list.data?.items.find((o) => o.ownerId === open);
  const columns: Column<OwnerRow>[] = [
    { id: "name", header: t("owner"), primary: true, sort: (o) => o.displayName ?? "", cell: (o) => <span className="font-semibold">{o.displayName ?? t("unnamed")}</span> },
    {
      id: "plan",
      header: t("plan"),
      sort: (o) => SAAS_TIERS.indexOf(o.subscription.chosenTier),
      cell: (o) => (
        <span className="inline-flex flex-wrap items-center gap-1">
          {t(`tier.${o.subscription.chosenTier}`)}
          {o.subscription.foundingPartner ? (
            <Badge tone="prize">
              <Medal size={12} aria-hidden /> {t("foundingNo", { no: o.subscription.foundingNo ?? "–" })}
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: "status",
      header: t("statusLabel"),
      sort: (o) => o.subscription.status,
      cell: (o) => (
        <StatusBadge status={o.subscription.status} domain="gymSaas">
          {t(`subStatus.${o.subscription.status}`)}
        </StatusBadge>
      ),
    },
    { id: "gyms", header: t("gyms"), align: "end", sort: (o) => o.gyms, cell: (o) => <span className="tabular">{o.gyms}</span> },
    { id: "active", header: t("activeMembers"), align: "end", sort: (o) => o.activeMembers?.count ?? -1, cell: (o) => <span className="tabular">{o.activeMembers ? o.activeMembers.count : "–"}</span> },
    {
      id: "last",
      header: t("lastInvoice"),
      hideBelow: "lg",
      cell: (o) =>
        o.lastInvoice ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{o.lastInvoice.number}</span>
            <span className="tabular">{formatTaka(o.lastInvoice.totalPoisha, locale)}</span>
            <StatusBadge status={o.lastInvoice.status} domain="gymSaas">
              {t(`invoiceStatus.${o.lastInvoice.status}`)}
            </StatusBadge>
          </span>
        ) : (
          "–"
        ),
    },
  ];
  return (
    <DetailLayout open={Boolean(open)} onClose={() => set({ id: null })} title={openRow?.displayName ?? t("ownerDetail")} pane={open ? <OwnerPane key={open} ownerId={open} canOverrides={canOverrides} /> : null} width={620} testId="gm-owner">
      <div className="flex flex-col gap-4">
        <FilterBar
          chips={{ value: values.status, onChange: (v) => set({ status: v }), label: t("statusLabel"), options: [{ value: "", label: t("all") }, ...SUB_STATUSES.map((s) => ({ value: s, label: t(`subStatus.${s}`) }))], testId: "gm-owner-status" }}
          selects={[
            { id: "gm-tier", label: t("plan"), value: values.tier, onChange: (v) => set({ tier: v }), options: SAAS_TIERS.map((k) => ({ value: k, label: t(`tier.${k}`) })), anyLabel: t("anyPlan") },
            {
              id: "gm-founding",
              label: t("founding"),
              value: values.founding,
              onChange: (v) => set({ founding: v }),
              options: [
                { value: "true", label: t("foundingYes") },
                { value: "false", label: t("foundingNoLabel") },
              ],
              anyLabel: t("anyone"),
            },
          ]}
          onClear={values.status || values.tier || values.founding ? () => clear() : undefined}
        />
        <DataTable label={t("tab.owners")} testId="gm-owners" columns={columns} rows={list.data?.items} rowId={(o) => o.ownerId} loading={list.isPending} error={list.error} onRetry={() => void list.refetch()} empty={{ title: t("noOwners") }} onRowClick={(o) => set({ id: o.ownerId })} selectedId={open} />
      </div>
    </DetailLayout>
  );
}

function Fact({ label, children, testId }: { label: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm" data-testid={testId}>
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold tabular">{children}</span>
    </div>
  );
}

function OwnerPane({ ownerId, canOverrides }: { ownerId: string; canOverrides: boolean }) {
  const t = useTranslations("gymManageDesk");
  const locale = useLocale();
  const qc = useQueryClient();
  const { me } = useAdminMe();
  const errText = useErrText();
  const { set } = useUrlFilters({ tab: { default: "owners", allowed: TABS } });
  const q = useQuery({ queryKey: ["admin-gm-owner", ownerId], queryFn: () => gymManageAdmin.owner(ownerId) });
  const [founding, setFounding] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<string | null>(null);
  if (q.isPending) return <Skeleton className="h-64" />;
  if (q.isError) return <Notice tone="error">{errText(q.error)}</Notice>;
  const d = q.data;
  const s = d.subscription;
  const a = d.activeMembers;
  const date = (v: string | null | undefined) => (v ? new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${v.slice(0, 10)}T12:00:00Z`)) : "–");
  const source = (v: string) => t(`source.${v}`);
  return (
    <div className="flex flex-col gap-5" data-testid="gm-owner-detail">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={s.status} domain="gymSaas">
          {t(`subStatus.${s.status}`)}
        </StatusBadge>
        <Badge>{t(`tier.${s.chosenTier}`)}</Badge>
        {s.foundingPartner ? <Badge tone="prize">{t("foundingNo", { no: s.foundingNo ?? "–" })}</Badge> : null}
        <span className="text-xs text-muted">{t("role", { status: d.owner.gymOwnerRole ? t.has(`roleStatus.${d.owner.gymOwnerRole}`) ? t(`roleStatus.${d.owner.gymOwnerRole}`) : d.owner.gymOwnerRole : t("roleNone") })}</span>
      </div>

      <section>
        <h3 className="font-display text-base font-bold">{t("subscription")}</h3>
        <div className="mt-1 divide-y divide-line">
          <Fact label={t("chosenTier")}>{t(`tier.${s.chosenTier}`)}</Fact>
          <Fact label={t("monthMaxTier", { month: s.monthOf.slice(0, 7) })}>{t(`tier.${s.monthMaxTier}`)}</Fact>
          <Fact label={t("startedOn")}>{date(s.startedOn)}</Fact>
          <Fact label={t("paidTierSince")}>{date(s.paidTierSince)}</Fact>
          {s.pastDueAt ? <Fact label={t("pastDueAt")}>{formatDhaka(s.pastDueAt, locale)}</Fact> : null}
          {s.restrictedAt ? <Fact label={t("restrictedAt")}>{formatDhaka(s.restrictedAt, locale)}</Fact> : null}
          {a.restrictOn ? <Fact label={t("restrictOn")}>{date(a.restrictOn)}</Fact> : null}
        </div>
      </section>

      <section>
        <h3 className="font-display text-base font-bold">{t("activeMembers")}</h3>
        <div className="mt-1 grid grid-cols-3 gap-2">
          <Card padded={false} className="p-3">
            <p className="text-xs text-muted">{t("today")}</p>
            <p className="font-display text-xl font-bold tabular" data-testid="gm-active-today">
              {a.today}
            </p>
          </Card>
          <Card padded={false} className="p-3">
            <p className="text-xs text-muted">{t("monthPeak")}</p>
            <p className="font-display text-xl font-bold tabular">{a.monthPeak ?? "–"}</p>
          </Card>
          <Card padded={false} className="p-3">
            <p className="text-xs text-muted">{t("gymsWithMembers")}</p>
            <p className="font-display text-xl font-bold tabular">{a.gymsWithMembers}</p>
          </Card>
        </div>
      </section>

      <section data-testid="gm-founding">
        <h3 className="font-display text-base font-bold">{t("founding")}</h3>
        <div className="mt-1 divide-y divide-line">
          <Fact label={t("foundingPartner")}>{a.founding.partner ? t("foundingNo", { no: a.founding.no ?? "–" }) : t("foundingNoLabel")}</Fact>
          {a.founding.partner ? <Fact label={t("freeUntil")}>{date(a.founding.freeUntil)}</Fact> : null}
          {a.founding.partner ? <Fact label={t("discountUntil", { pct: a.founding.discountPct })}>{date(a.founding.discountUntil)}</Fact> : null}
          <Fact label={t("placesLeft")}>{a.founding.placesLeft}</Fact>
        </div>
        {canWrite(me) ? (
          <Button
            type="button"
            size="sm"
            variant={s.foundingPartner ? "secondary" : "primary"}
            className="mt-2"
            icon={s.foundingPartner ? <XCircle size={16} aria-hidden /> : <Medal size={16} aria-hidden />}
            disabled={!s.foundingPartner && a.founding.placesLeft <= 0}
            onClick={() => (setReason(""), setFounding(!s.foundingPartner))}
            data-testid="gm-founding-toggle"
          >
            {s.foundingPartner ? t("foundingOff") : t("foundingOn")}
          </Button>
        ) : null}
        {done ? (
          <Notice tone="success" className="mt-2">
            {done}
          </Notice>
        ) : null}
      </section>

      <SmsSection ownerId={ownerId} addon={d.smsAddon} canAdjust={canWrite(me)} />

      <section>
        <h3 className="font-display text-base font-bold">{t("fees")}</h3>
        <div className="mt-1 divide-y divide-line">
          <Fact label={t("referral")}>
            {formatTaka(a.fees.referral.valuePoisha, locale)} · {source(a.fees.referral.source)}
            {a.fees.referral.validTo ? ` · ${t("until", { date: formatDhaka(a.fees.referral.validTo, locale) })}` : ""}
          </Fact>
          <Fact label={t("passCommission")}>
            {a.fees.passCommission.pct}% · {source(a.fees.passCommission.source)}
            {a.fees.passCommission.validTo ? ` · ${t("until", { date: formatDhaka(a.fees.passCommission.validTo, locale) })}` : ""}
          </Fact>
        </div>
      </section>

      <section>
        <h3 className="font-display text-base font-bold">{t("gyms")}</h3>
        {!d.gyms.length ? <p className="mt-1 text-sm text-muted">{t("noGyms")}</p> : null}
        <ul className="mt-1 divide-y divide-line rounded-card border border-line">
          {d.gyms.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 font-semibold">{g.name}</span>
              <Badge>{g.listingStatus === "draft" ? t("private") : t("listed")}</Badge>
              <span className="tabular text-muted">{t("membersCount", { n: g.members, active: g.activeMembers })}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold">{t("tab.invoices")}</h3>
          <Button type="button" variant="link" size="sm" onClick={() => set({ tab: "invoices", owner: ownerId, id: null })}>
            {t("seeAll")}
          </Button>
        </div>
        {!d.invoices.length ? <p className="mt-1 text-sm text-muted">{t("noInvoices")}</p> : null}
        <ul className="mt-1 divide-y divide-line rounded-card border border-line">
          {d.invoices.slice(0, 12).map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
              <span className="font-mono text-xs font-semibold">{i.number}</span>
              <span className="min-w-0 flex-1 text-muted">{i.period ?? t(`kind.${i.kind}`)}</span>
              <span className="tabular font-semibold">{formatTaka(i.totalPoisha, locale)}</span>
              <StatusBadge status={i.status} domain="gymSaas">
                {t(`invoiceStatus.${i.status}`)}
              </StatusBadge>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold">{t("tab.overrides")}</h3>
          {canOverrides ? (
            <Button type="button" variant="link" size="sm" onClick={() => set({ tab: "overrides", owner: ownerId, id: null })}>
              {t("seeAll")}
            </Button>
          ) : null}
        </div>
        {!d.overrides.length ? <p className="mt-1 text-sm text-muted">{t("noOverrides")}</p> : null}
        <ul className="mt-1 divide-y divide-line rounded-card border border-line">
          {d.overrides.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">{t(`key.${o.key === REFERRAL_KEY ? "referral" : "pass"}`)}</span>
              <span className="tabular font-semibold">{overrideValue(o.key, o.value, (p) => formatTaka(p, locale))}</span>
              <StatusBadge status={o.status === "active" ? "active" : "ended"} domain="gymSaas">
                {t(`overrideStatus.${o.status}`)}
              </StatusBadge>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="font-display text-base font-bold">{t("imports")}</h3>
        {!d.imports.length ? <p className="mt-1 text-sm text-muted">{t("noImports")}</p> : null}
        <ul className="mt-1 divide-y divide-line rounded-card border border-line">
          {d.imports.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
              <span className="text-muted">{formatDhaka(i.createdAt, locale)}</span>
              <span className="min-w-0 flex-1">{t("importRows", { ok: i.rowsOk, failed: i.rowsFailed })}</span>
              <Badge>{t(`importStatus.${i.status}`)}</Badge>
              <span className="text-xs text-muted">{t(`uploadedAs.${i.uploadedAs}`)}</span>
            </li>
          ))}
        </ul>
      </section>

      {founding !== null ? (
        <CodeDialog
          title={founding ? t("foundingOn") : t("foundingOff")}
          help={t("stepUpHelp")}
          onClose={() => setFounding(null)}
          onConfirm={async (code) => {
            if (reason.trim().length < 2) throw { code: "VALIDATION_FAILED", title: t("reasonNeeded"), status: 422 };
            const token = await stepUp(code, "settings.write");
            await guarded(() => gymManageAdmin.setFounding(ownerId, founding, reason.trim(), token), (e) => errText(e));
            setDone(founding ? t("foundingSet") : t("foundingRemoved"));
            setFounding(null);
            await qc.invalidateQueries({ queryKey: ["admin-gm-owner", ownerId] });
            await qc.invalidateQueries({ queryKey: ["admin-gm-owners"] });
          }}
        >
          <Textarea id="gm-founding-reason" label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} data-testid="gm-founding-reason" />
        </CodeDialog>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- invoices

function Invoices() {
  const t = useTranslations("gymManageDesk");
  const locale = useLocale();
  const qc = useQueryClient();
  const { me } = useAdminMe();
  const errText = useErrText();
  const { values, set, clear } = useUrlFilters({ status: { default: "", allowed: ["", ...INVOICE_STATUSES] }, period: { default: "" }, owner: { default: "" } });
  const q = { status: (values.status || undefined) as InvoiceStatus | undefined, period: periodParam(values.period), ownerId: /^[0-9a-f-]{36}$/i.test(values.owner.trim()) ? values.owner.trim() : undefined };
  const list = useQuery({ queryKey: ["admin-gm-invoices", q], queryFn: () => gymManageAdmin.invoices(q) });
  const [voiding, setVoiding] = useState<AdminInvoice | null>(null);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const totals = invoiceTotals(list.data?.totals);
  const columns: Column<AdminInvoice>[] = [
    { id: "number", header: t("number"), primary: true, sort: (i) => i.number, cell: (i) => <span className="font-mono text-xs font-semibold">{i.number}</span> },
    { id: "owner", header: t("owner"), sort: (i) => i.ownerName ?? "", cell: (i) => i.ownerName ?? t("unnamed") },
    { id: "period", header: t("period"), sort: (i) => i.period ?? "", cell: (i) => (i.period ? `${i.period}${i.billedTier ? ` · ${t(`tier.${i.billedTier}`)}` : ""}` : t(`kind.${i.kind}`)) },
    { id: "peak", header: t("peak"), align: "end", hideBelow: "lg", cell: (i) => <span className="tabular">{i.peakActive ?? "–"}</span> },
    { id: "total", header: t("total"), align: "end", sort: (i) => i.totalPoisha, cell: (i) => <span className="tabular font-semibold">{formatTaka(i.totalPoisha, locale)}</span> },
    { id: "due", header: t("dueOn"), sort: (i) => i.dueOn, hideBelow: "xl", cell: (i) => i.dueOn },
    {
      id: "status",
      header: t("statusLabel"),
      sort: (i) => i.status,
      cell: (i) => (
        <StatusBadge status={i.status} domain="gymSaas">
          {t(`invoiceStatus.${i.status}`)}
        </StatusBadge>
      ),
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        chips={{ value: values.status, onChange: (v) => set({ status: v }), label: t("statusLabel"), options: [{ value: "", label: t("all") }, ...INVOICE_STATUSES.map((s) => ({ value: s, label: t(`invoiceStatus.${s}`), count: list.data?.totals[s]?.count }))], testId: "gm-invoice-status" }}
        extra={
          <div className="grid gap-3 sm:grid-cols-2">
            <MonthPicker id="gm-period" label={t("period")} value={values.period} onChange={(v) => set({ period: v })} />
            <Field id="gm-owner-id" label={t("ownerId")} value={values.owner} onChange={(e) => set({ owner: e.target.value })} placeholder="00000000-0000-…" />
          </div>
        }
        onClear={values.status || values.period || values.owner ? () => clear() : undefined}
      />
      {totals.length ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="gm-invoice-totals">
          {totals.map((x) => (
            <li key={x.status}>
              <Card padded={false} className="p-3">
                <p className="text-xs text-muted">{t("totalOf", { status: t(`invoiceStatus.${x.status}`), n: x.count })}</p>
                <p className="font-display text-lg font-bold tabular">{formatTaka(x.totalPoisha, locale)}</p>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
      {done ? <Notice tone="success">{done}</Notice> : null}
      <DataTable
        label={t("tab.invoices")}
        testId="gm-invoices"
        columns={columns}
        rows={list.data?.items}
        rowId={(i) => i.id}
        loading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        empty={{ title: t("noInvoices") }}
        rowActions={(i): MenuItem[] => (canWrite(me) && voidable(i.status) ? [{ label: t("void"), icon: <Prohibit size={16} aria-hidden />, danger: true, onSelect: () => (setReason(""), setVoiding(i)) }] : [])}
        expanded={(i) => (i.status === "void" && i.voidReason ? <p className="text-sm text-muted">{t("voidedBecause", { reason: i.voidReason, at: formatDhaka(i.voidedAt, locale) })}</p> : null)}
      />
      {voiding ? (
        <CodeDialog
          title={t("voidTitle", { number: voiding.number })}
          help={t("voidHelp")}
          confirmLabel={t("void")}
          onClose={() => setVoiding(null)}
          onConfirm={async (code) => {
            if (reason.trim().length < 2) throw { code: "VALIDATION_FAILED", title: t("reasonNeeded"), status: 422 };
            const token = await stepUp(code, "escrow.manage");
            await guarded(() => gymManageAdmin.voidInvoice(voiding.id, reason.trim(), token), (e) => errText(e));
            setDone(t("voided", { number: voiding.number }));
            setVoiding(null);
            await qc.invalidateQueries({ queryKey: ["admin-gm-invoices"] });
            await qc.invalidateQueries({ queryKey: ["admin-gm-owners"] });
            await qc.invalidateQueries({ queryKey: ["admin-gm-owner"] });
          }}
        >
          <Textarea id="gm-void-reason" label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} data-testid="gm-void-reason" />
        </CodeDialog>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- fee overrides

const EMPTY: OverrideForm = { scopeType: "owner", scopeId: "", kind: "referral", value: "", reason: "", validFrom: "", validTo: "" };

function Overrides() {
  const t = useTranslations("gymManageDesk");
  const locale = useLocale();
  const qc = useQueryClient();
  const { me } = useAdminMe();
  const errText = useErrText();
  const { values, set, clear } = useUrlFilters({ status: { default: "active", allowed: ["", "active", "ended"] }, owner: { default: "" } });
  const q = { status: (values.status || undefined) as "active" | "ended" | undefined, ownerId: /^[0-9a-f-]{36}$/i.test(values.owner.trim()) ? values.owner.trim() : undefined };
  const list = useQuery({ queryKey: ["admin-gm-overrides", q], queryFn: () => gymManageAdmin.overrides(q) });
  const [form, setForm] = useState<OverrideForm>(() => ({ ...EMPTY, scopeId: values.owner }));
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [ending, setEnding] = useState<FeeOverride | null>(null);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const write = canWrite(me);
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-gm-overrides"] });
    await qc.invalidateQueries({ queryKey: ["admin-gm-owner"] });
  };
  const built = overrideBody(form);
  const columns: Column<FeeOverride>[] = [
    { id: "key", header: t("fee"), primary: true, cell: (o) => <span className="font-semibold">{t(`key.${o.key === REFERRAL_KEY ? "referral" : "pass"}`)}</span> },
    { id: "value", header: t("value"), align: "end", sort: (o) => o.value, cell: (o) => <span className="tabular font-semibold">{overrideValue(o.key, o.value, (p) => formatTaka(p, locale))}</span> },
    { id: "scope", header: t("scope"), cell: (o) => <span className="text-sm">{t(`scopeType.${o.scopeType}`)} · <span className="font-mono text-xs">{o.scopeId.slice(0, 8)}</span></span> },
    { id: "valid", header: t("valid"), hideBelow: "lg", cell: (o) => <span className="text-sm">{formatDhaka(o.validFrom, locale)} – {o.validTo ? formatDhaka(o.validTo, locale) : t("open")}</span> },
    {
      id: "status",
      header: t("statusLabel"),
      sort: (o) => o.status,
      cell: (o) => (
        <StatusBadge status={o.status} domain="gymSaas">
          {t(`overrideStatus.${o.status}`)}
        </StatusBadge>
      ),
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        chips={{
          value: values.status,
          onChange: (v) => set({ status: v }),
          label: t("statusLabel"),
          options: [
            { value: "active", label: t("overrideStatus.active") },
            { value: "ended", label: t("overrideStatus.ended") },
            { value: "", label: t("all") },
          ],
          testId: "gm-override-status",
        }}
        extra={<Field id="gm-override-owner" label={t("ownerId")} value={values.owner} onChange={(e) => set({ owner: e.target.value })} placeholder="00000000-0000-…" />}
        onClear={values.owner || values.status !== "active" ? () => clear() : undefined}
        actions={
          write ? (
            <Button type="button" size="sm" icon={<Plus size={16} aria-hidden />} onClick={() => setShowForm((v) => !v)} data-testid="gm-override-new">
              {t("newOverride")}
            </Button>
          ) : null
        }
      />
      {write && showForm ? (
        <form
          className="grid gap-3 rounded-card border border-line bg-surface-2/40 p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!built.ok) return setProblem(t(`problem.${built.problem}`));
            setProblem(null);
            setCreating(true);
          }}
          data-testid="gm-override-form"
        >
          <Select id="gm-ov-scope" label={t("scope")} value={form.scopeType} onChange={(e) => setForm({ ...form, scopeType: e.target.value as "owner" | "gym" })}>
            <option value="owner">{t("scopeType.owner")}</option>
            <option value="gym">{t("scopeType.gym")}</option>
          </Select>
          <Field id="gm-ov-scope-id" label={form.scopeType === "owner" ? t("ownerId") : t("gymId")} value={form.scopeId} onChange={(e) => setForm({ ...form, scopeId: e.target.value })} required data-testid="gm-ov-scope-id" />
          <Select id="gm-ov-key" label={t("fee")} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "referral" | "pass" })}>
            <option value="referral">{t("key.referral")}</option>
            <option value="pass">{t("key.pass")}</option>
          </Select>
          <Field
            id="gm-ov-value"
            label={form.kind === "referral" ? t("valueTaka") : t("valuePct")}
            inputMode="decimal"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            leading={form.kind === "referral" ? <span className="text-muted">৳</span> : undefined}
            required
            data-testid="gm-ov-value"
          />
          <DateTimePicker id="gm-ov-from" label={t("validFrom")} hint={t("validFromHint")} value={form.validFrom} onChange={(v) => setForm({ ...form, validFrom: v })} />
          <DateTimePicker id="gm-ov-to" label={t("validTo")} hint={t("validToHint")} value={form.validTo} onChange={(v) => setForm({ ...form, validTo: v })} />
          <Textarea id="gm-ov-reason" className="sm:col-span-2" label={t("reason")} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={300} data-testid="gm-ov-reason" />
          {problem ? (
            <p role="alert" className="text-sm text-danger sm:col-span-2">
              {problem}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" data-testid="gm-ov-submit">
              {t("createOverride")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => (setShowForm(false), setForm(EMPTY), setProblem(null))}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : null}
      {done ? <Notice tone="success">{done}</Notice> : null}
      <DataTable
        label={t("tab.overrides")}
        testId="gm-overrides"
        columns={columns}
        rows={list.data?.items}
        rowId={(o) => o.id}
        loading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        empty={{ title: t("noOverrides") }}
        rowActions={(o): MenuItem[] => (write && o.status === "active" ? [{ label: t("end"), icon: <XCircle size={16} aria-hidden />, danger: true, onSelect: () => (setReason(""), setEnding(o)) }] : [])}
        expanded={(o) => (
          <p className="text-sm text-muted">
            {o.reason}
            {o.endReason ? ` · ${t("endedBecause", { reason: o.endReason })}` : ""}
          </p>
        )}
      />
      {creating && built.ok ? (
        <CodeDialog
          title={t("createOverride")}
          help={t("stepUpHelp")}
          onClose={() => setCreating(false)}
          onConfirm={async (code) => {
            const token = await stepUp(code, "settings.write");
            await guarded(() => gymManageAdmin.createOverride(built.body, token), (e) => errText(e, built.body.key));
            setDone(t("created"));
            setCreating(false);
            setShowForm(false);
            setForm(EMPTY);
            await refresh();
          }}
        >
          <p className="text-sm">
            {t("confirmOverride", { fee: t(`key.${form.kind}`), value: overrideValue(built.body.key, built.body.value, (p) => formatTaka(p, locale)), scope: t(`scopeType.${form.scopeType}`) })}
          </p>
        </CodeDialog>
      ) : null}
      {ending ? (
        <CodeDialog
          title={t("endTitle")}
          help={t("stepUpHelp")}
          confirmLabel={t("end")}
          onClose={() => setEnding(null)}
          onConfirm={async (code) => {
            if (reason.trim().length < 2) throw { code: "VALIDATION_FAILED", title: t("reasonNeeded"), status: 422 };
            const token = await stepUp(code, "settings.write");
            await guarded(() => gymManageAdmin.endOverride(ending.id, reason.trim(), token), (e) => errText(e));
            setDone(t("ended"));
            setEnding(null);
            await refresh();
          }}
        >
          <Textarea id="gm-end-reason" label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} data-testid="gm-end-reason" />
        </CodeDialog>
      ) : null}
    </div>
  );
}

/**
 * The owner's SMS add-on (M24 prompt 3b): its state, the balance and the month's allowance left; a master
 * adds or takes units with a note (step-up settings.write), never below 0.
 */
function SmsSection({ ownerId, addon, canAdjust }: { ownerId: string; addon: { available: boolean; enabled: boolean; status: string | null; balance: number; allowanceLeft: number }; canAdjust: boolean }) {
  const t = useTranslations("gymManageDesk");
  const qc = useQueryClient();
  const errText = useErrText();
  const [units, setUnits] = useState("");
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const n = Number(units);
  const valid = Number.isInteger(n) && n !== 0 && Math.abs(n) <= 100000 && note.trim().length >= 3;
  return (
    <section data-testid="gm-sms">
      <h3 className="font-display text-base font-bold">{t("sms.title")}</h3>
      <div className="mt-1 divide-y divide-line">
        <Fact label={t("sms.state")}>{addon.status ? t(`sms.status.${addon.status}`) : addon.enabled ? t("sms.notOn") : t("sms.platformOff")}</Fact>
        <Fact label={t("sms.balance")}>
          <span className="tabular" data-testid="gm-sms-balance">
            {addon.balance}
          </span>
        </Fact>
        <Fact label={t("sms.allowanceLeft")}>{addon.allowanceLeft}</Fact>
      </div>
      {canAdjust ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-end">
          <Field id="gm-sms-units" label={t("sms.units")} inputMode="numeric" value={units} onChange={(e) => setUnits(e.target.value.replace(/[^0-9-]/g, ""))} hint={t("sms.unitsHint")} data-testid="gm-sms-units" />
          <Field id="gm-sms-note" label={t("sms.note")} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} data-testid="gm-sms-note" />
          <Button type="button" size="sm" disabled={!valid} onClick={() => setAsking(true)} data-testid="gm-sms-adjust">
            {t("sms.adjust")}
          </Button>
        </div>
      ) : null}
      {done ? (
        <Notice tone="success" className="mt-2">
          {done}
        </Notice>
      ) : null}
      {asking ? (
        <CodeDialog
          title={t("sms.adjustTitle", { units: n })}
          help={t("stepUpHelp")}
          onClose={() => setAsking(false)}
          onConfirm={async (code) => {
            const token = await stepUp(code, "settings.write");
            await guarded(() => gymManageAdmin.smsAdjust(ownerId, n, note.trim(), token), (e) => errText(e));
            setDone(t("sms.adjusted", { units: n }));
            setAsking(false);
            setUnits("");
            setNote("");
            await qc.invalidateQueries({ queryKey: ["admin-gm-owner", ownerId] });
          }}
        />
      ) : null}
    </section>
  );
}

"use client";

import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowCounterClockwise, FilePdf, Prohibit } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { DatePicker } from "@kriraghor/ui/date";
import { Button, DataTable, DetailLayout, Field, FilterBar, Notice, PageTitle, ReasonDialog, Select, Skeleton, Textarea, buttonClass, cn, type Column } from "@kriraghor/ui/kit";
import { formatTaka } from "@/lib/admin/finance";
import { contractBody, organisersAdmin, type Contract, type Invoice, type OrgStatus } from "@/lib/admin/organisers";
import { stepUp } from "@/lib/admin/stepUp";
import { useUrlFilters } from "@/lib/use-url-filters";
import { externalOrganisersEnabled, usePublicSettings } from "@/lib/public-settings";
import { StatusBadge } from "../../StatusBadge";
import { CodeDialog } from "../CodeDialog";
import { formatDhaka, useAdminMe } from "../useAdminMe";

type Row = Awaited<ReturnType<typeof organisersAdmin.list>>["items"][number];
const STATUSES = ["pending_review", "verified", "suspended", "changes_requested", "rejected"] as const;

/**
 * /admin/esports/organisers (M22): organisations (their review is on the Moderation desk), each with
 * its contracts (a draft, the signed PDF, activate / suspend / end with step-up esports.money) and
 * invoices (void with step-up). Suspending an organisation needs manage_organisers; restoring, a master.
 * 21 Oct 2026: esports is run by Kriraghor only. While esports.external_organisers_enabled is off
 * (the default) the contracts and invoices are hidden; the list, the detail and suspend / restore
 * stay, as they also serve sports organisations.
 */
export function OrganisersDesk() {
  // The status and the open organisation live in the URL (useSearchParams), so the desk renders inside Suspense.
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-10 h-64 max-w-[1320px]" />}>
      <Desk />
    </Suspense>
  );
}

function Desk() {
  const t = useTranslations("organisersDesk");
  const { ready } = useAdminMe();
  const { values, set, params } = useUrlFilters({ status: { default: "", allowed: ["", ...STATUSES] } });
  const status = values.status as OrgStatus | "";
  const open = params.get("id");
  const list = useQuery({ queryKey: ["admin-orgs", status], queryFn: () => organisersAdmin.list({ status: status || undefined }), enabled: ready });
  const openName = list.data?.items.find((o) => o.id === open)?.name;
  const settings = usePublicSettings("admin");
  const external = externalOrganisersEnabled(settings.data);

  const columns: Column<Row>[] = [
    { id: "name", header: t("panel.name"), primary: true, sort: (o) => o.name, cell: (o) => <span className="font-semibold">{o.name}</span> },
    {
      id: "status",
      header: t("statusLabel"),
      sort: (o) => o.status,
      cell: (o) => (
        <StatusBadge status={o.status} domain="organiser">
          {t(`status.${o.status}`)}
        </StatusBadge>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
      <PageTitle title={t("title")} description={t("intro")} />
      {settings.isSuccess && !external ? (
        <div className="mt-4" data-testid="external-organisers-off">
          <Notice tone="info">{t("externalOff")}</Notice>
        </div>
      ) : null}
      <DetailLayout className="mt-6" open={Boolean(open)} onClose={() => set({ id: null })} title={openName ?? t("title")} pane={open ? <OrgDetail key={open} id={open} external={external} /> : null} width={600} testId="admin-org">
        <div className="flex flex-col gap-4">
          <FilterBar
            chips={{
              value: status,
              onChange: (v) => set({ status: v }),
              label: t("title"),
              options: [{ value: "", label: t("all") }, ...STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))],
            }}
          />
          <DataTable
            label={t("title")}
            testId="admin-orgs"
            columns={columns}
            rows={list.data?.items}
            rowId={(o) => o.id}
            loading={list.isPending}
            error={list.error}
            onRetry={() => void list.refetch()}
            empty={{ title: t("none") }}
            onRowClick={(o) => set({ id: o.id })}
            selectedId={open}
          />
        </div>
      </DetailLayout>
    </div>
  );
}

function OrgDetail({ id, external }: { id: string; external: boolean }) {
  const t = useTranslations("organisersDesk");
  const locale = useLocale();
  const qc = useQueryClient();
  const { me } = useAdminMe();
  const org = useQuery({ queryKey: ["admin-org", id], queryFn: () => organisersAdmin.get(id) });
  const contracts = useQuery({ queryKey: ["admin-org-contracts", id], queryFn: () => organisersAdmin.contracts(id), enabled: external });
  const invoices = useQuery({ queryKey: ["admin-org-invoices", id], queryFn: () => organisersAdmin.invoices(id), enabled: external });
  const [form, setForm] = useState(() => ({ model: "percentage" as "percentage" | "flat", pct: "", flatFee: "", billingCycle: "monthly" as "monthly" | "quarterly" | "per_tournament", startsOn: new Date(Date.now() + 6 * 3600000).toISOString().slice(0, 10), endsOn: "" }));
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const [dialog, setDialog] = useState<{ title: string; reason?: boolean; run: (token: string, reason: string) => Promise<unknown> } | null>(null);
  const [reason, setReason] = useState("");
  const [orgAction, setOrgAction] = useState<"suspend" | "restore" | null>(null);
  const [orgBusy, setOrgBusy] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const canManage = Boolean(me && (me.isMaster || me.permissions.includes("manage_organisers" as never)));
  const refresh = async () => {
    for (const k of ["admin-org", "admin-org-contracts", "admin-org-invoices", "admin-orgs"]) await qc.invalidateQueries({ queryKey: [k] });
  };
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ text: done, tone: "info" });
      await refresh();
    } catch (err) {
      setMsg({ text: problemOf(err)?.title ?? t("failed"), tone: "error" });
    }
  };
  async function actOnOrg(why: string) {
    if (!orgAction) return;
    setOrgError(null);
    setOrgBusy(true);
    try {
      await (orgAction === "suspend" ? organisersAdmin.suspend(id, why) : organisersAdmin.restore(id, why));
      setMsg({ text: t(orgAction === "suspend" ? "suspended" : "restored"), tone: "info" });
      setOrgAction(null);
      await refresh();
    } catch (err) {
      setOrgError(problemOf(err)?.title ?? t("failed"));
    } finally {
      setOrgBusy(false);
    }
  }
  if (org.isPending) return <Skeleton className="h-64" />;
  if (org.isError) return <Notice tone="error">{t("failed")}</Notice>;
  const o = org.data;
  const body = contractBody(form);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <StatusBadge status={o.status} domain="organiser">
          {t(`status.${o.status}`)}
        </StatusBadge>
        {o.about ? <p className="mt-2 text-sm">{o.about}</p> : null}
        <p className="mt-2 text-sm text-muted">{t("members", { list: o.members.map((m) => `${m.name ?? "–"} (${m.role})`).join(", ") })}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {canManage && o.status === "verified" ? (
            <Button type="button" variant="secondary" size="sm" className="text-danger" icon={<Prohibit size={16} aria-hidden />} onClick={() => setOrgAction("suspend")}>
              {t("suspend")}
            </Button>
          ) : null}
          {me?.isMaster && o.status === "suspended" ? (
            <Button type="button" variant="secondary" size="sm" icon={<ArrowCounterClockwise size={16} aria-hidden />} onClick={() => setOrgAction("restore")}>
              {t("restore")}
            </Button>
          ) : null}
        </div>
      </div>

      {external ? (
        <section>
          <h3 className="font-display text-lg font-bold">{t("contracts")}</h3>
          <ul className="mt-2 flex flex-col gap-2" data-testid="admin-contracts">
            {((contracts.data?.items ?? []) as Contract[]).map((k) => (
              <li key={k.id} className="rounded-card border border-line p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1 font-semibold">{k.model === "percentage" ? t("pct", { pct: k.effectivePct ?? 0 }) : t("flat", { fee: formatTaka(k.flatFee ?? 0, locale), cycle: t(`cycle.${k.billingCycle}`) })}</span>
                  <span className="text-sm text-muted">
                    {k.startsOn}
                    {k.endsOn ? ` – ${k.endsOn}` : ""}
                  </span>
                  <StatusBadge status={k.status} domain="organiser">
                    {t(`contractStatus.${k.status}`)}
                  </StatusBadge>
                </div>
                {canManage ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {k.status !== "ended" ? (
                      <label className={cn(buttonClass({ variant: "secondary", size: "sm" }), "cursor-pointer")}>
                        <FilePdf size={16} aria-hidden />
                        {k.hasSignedDocument ? t("replacePdf") : t("attachPdf")}
                        <input
                          type="file"
                          accept="application/pdf"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) void run(() => organisersAdmin.attachDocument(k.id, file), t("pdfSaved"));
                          }}
                        />
                      </label>
                    ) : null}
                    {["draft", "suspended"].includes(k.status) ? (
                      <Button type="button" size="sm" disabled={!k.hasSignedDocument} onClick={() => setDialog({ title: t("activateTitle"), run: (token) => organisersAdmin.activate(k.id, token) })} data-testid="contract-activate">
                        {k.status === "draft" ? t("activate") : t("reinstate")}
                      </Button>
                    ) : null}
                    {k.status === "active" ? (
                      <Button type="button" variant="secondary" size="sm" className="text-danger" onClick={() => setDialog({ title: t("suspendContract"), reason: true, run: (token, why) => organisersAdmin.stop(k.id, "suspend", why, token) })}>
                        {t("suspendContract")}
                      </Button>
                    ) : null}
                    {k.status !== "ended" ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setDialog({ title: t("endContract"), reason: true, run: (token, why) => organisersAdmin.stop(k.id, "end", why, token) })}>
                        {t("endContract")}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {canManage && o.status === "verified" ? (
            <form
              className="mt-4 grid gap-3 rounded-card border border-line bg-surface-2/40 p-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (body) void run(() => organisersAdmin.createContract(id, body), t("contractCreated"));
              }}
              data-testid="contract-form"
            >
              <Select id="contract-model" label={t("model")} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value as "percentage" | "flat" })}>
                <option value="percentage">{t("model_percentage")}</option>
                <option value="flat">{t("model_flat")}</option>
              </Select>
              {form.model === "percentage" ? (
                <Field id="contract-pct" label={t("pctLabel")} value={form.pct} onChange={(e) => setForm({ ...form, pct: e.target.value })} inputMode="decimal" placeholder={t("pctDefault")} />
              ) : (
                <>
                  <Field id="contract-fee" label={t("feeLabel")} value={form.flatFee} onChange={(e) => setForm({ ...form, flatFee: e.target.value })} inputMode="decimal" required />
                  <Select id="contract-cycle" label={t("cycleLabel")} value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value as "monthly" | "quarterly" })}>
                    <option value="monthly">{t("cycle.monthly")}</option>
                    <option value="quarterly">{t("cycle.quarterly")}</option>
                  </Select>
                </>
              )}
              <DatePicker id="contract-starts" label={t("startsOn")} value={form.startsOn} onChange={(v) => setForm({ ...form, startsOn: v })} required />
              <DatePicker id="contract-ends" label={t("endsOn")} value={form.endsOn} onChange={(v) => setForm({ ...form, endsOn: v })} />
              <div className="flex items-end sm:col-span-2">
                <Button type="submit" disabled={!body}>
                  {t("createContract")}
                </Button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}

      {external ? (
        <section>
          <h3 className="font-display text-lg font-bold">{t("invoices")}</h3>
          {invoices.data && !invoices.data.items.length ? <p className="mt-2 text-sm text-muted">{t("noInvoices")}</p> : null}
          {invoices.data?.items.length ? (
            <ul className="mt-2 divide-y divide-line rounded-card border border-line">
              {((invoices.data?.items ?? []) as Invoice[]).map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                  <span className="font-mono font-semibold">{i.number}</span>
                  <span className="min-w-0 flex-1 text-muted">
                    {i.periodStart} – {i.periodEnd}
                    {i.dueAt ? ` · ${t("due", { at: formatDhaka(i.dueAt, locale) })}` : ""}
                  </span>
                  <span className="font-semibold tabular">{formatTaka(i.total, locale)}</span>
                  <StatusBadge status={i.status} domain="organiser">
                    {t(`invoiceStatus.${i.status}`)}
                  </StatusBadge>
                  {canManage && ["issued", "overdue"].includes(i.status) ? (
                    <Button type="button" variant="link" className="text-danger" onClick={() => setDialog({ title: t("voidTitle", { number: i.number }), reason: true, run: (token, why) => organisersAdmin.voidInvoice(i.id, why, token) })}>
                      {t("void")}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <ReasonDialog
        open={Boolean(orgAction)}
        onOpenChange={(v) => {
          if (!v) {
            setOrgAction(null);
            setOrgError(null);
          }
        }}
        title={orgAction ? `${t(orgAction)}: ${o.name}` : ""}
        label={t("reason")}
        confirmLabel={orgAction ? t(orgAction) : ""}
        danger={orgAction === "suspend"}
        minLength={5}
        maxLength={300}
        busy={orgBusy}
        error={orgError}
        onConfirm={(why) => void actOnOrg(why)}
      />
      {dialog ? (
        <CodeDialog
          title={dialog.title}
          help={t("stepUpHelp")}
          onClose={() => setDialog(null)}
          onConfirm={async (c) => {
            if (dialog.reason && reason.trim().length < 5) throw { code: "VALIDATION_FAILED", title: t("reasonNeeded"), status: 422 };
            const token = await stepUp(c, "esports.money");
            await dialog.run(token, reason.trim());
            setDialog(null);
            setReason("");
            await refresh();
          }}
        >
          {dialog.reason ? <Textarea id="org-dialog-reason" className="mt-4" label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /> : null}
        </CodeDialog>
      ) : null}
    </div>
  );
}

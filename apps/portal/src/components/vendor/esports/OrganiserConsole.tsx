"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { formatTaka } from "@/lib/admin/finance";
import { contrast, fundState, isHex, orgDesk, organiser, type Branding, type Contract, type Fund } from "@/lib/vendor/organiser";
import { MePanel } from "../../MePanel";
import { Notice } from "@kriraghor/ui/primitives";
import { CheckinBoard, CreateForm, Finalise, Matches } from "../../admin/esports/EsportsDesk";
import { Chip, Field, inputCls } from "../../admin/finance/shared";
import { formatDhaka } from "../../admin/useAdminMe";

const btn = "min-h-11 border-2 px-4 text-sm font-bold disabled:opacity-50";
const TONE: Record<string, "ok" | "warn" | "bad" | "muted"> = {
  draft: "muted",
  review: "warn",
  scheduled: "ok",
  registration_open: "ok",
  registration_closed: "warn",
  check_in: "warn",
  live: "bad",
  results_pending: "warn",
  finalised: "ok",
  paid_out: "ok",
  cancelled: "bad",
  issued: "warn",
  overdue: "bad",
  paid: "ok",
  voided: "muted",
  active: "ok",
  suspended: "bad",
  ended: "muted",
};
const TABS = ["", "/tournaments", "/billing", "/branding", "/members"] as const;
const tabKey = (t: string) => (t ? t.slice(1) : "dashboard");

/** /vendor/esports: pick one of my verified organisations (one goes straight in). */
export function OrganiserHome() {
  const t = useTranslations("organiser");
  const { status } = useAuth();
  const router = useRouter();
  const q = useQuery({
    queryKey: ["my-orgs"],
    queryFn: () => organiser.mine(),
    enabled: status === "signed_in",
  });
  const usable = (q.data?.items ?? []).filter((o) => o.kind !== "sports" && ["verified", "suspended"].includes(o.status));
  useEffect(() => {
    if (usable.length === 1) router.replace(`/vendor/esports/${usable[0].id}`);
  }, [usable, router]);
  if (status !== "signed_in") return <MePanel signInHref="/vendor/sign-in" />;
  if (q.isPending) return <div className="mx-auto mt-10 h-40 max-w-3xl animate-pulse bg-surface-2" />;
  return (
    <section className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-3xl font-extrabold">{t("title")}</h1>
      {usable.length ? (
        <ul className="mt-6 flex flex-col gap-3">
          {usable.map((o) => (
            <li key={o.id}>
              <Link href={`/vendor/esports/${o.id}`} className="flex items-center justify-between border-2 border-line p-4 font-bold hover:border-brand">
                {o.name} <span className="text-sm text-muted">{t(`role.${o.role}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 border-2 border-line p-5" data-testid="org-apply-first">
          <p className="font-bold">{t("applyFirst")}</p>
          <p className="mt-1 text-sm text-muted">{t("applyHelp")}</p>
        </div>
      )}
    </section>
  );
}

/** The console frame: the organisation's name and the section tabs (404 for non-members comes from the API). */
export function OrgShell({ orgId, children }: { orgId: string; children: ReactNode }) {
  const t = useTranslations("organiser");
  const pathname = usePathname();
  const { status } = useAuth();
  const dash = useQuery({
    queryKey: ["org-dash", orgId],
    queryFn: () => organiser.dashboard(orgId),
    enabled: status === "signed_in",
    retry: false,
  });
  if (status !== "signed_in") return <MePanel signInHref="/vendor/sign-in" />;
  if (dash.isError)
    return (
      <section className="mx-auto max-w-3xl px-5 py-10">
        <Notice tone="error">{t("notFound")}</Notice>
      </section>
    );
  const base = `/vendor/esports/${orgId}`;
  return (
    <section className="mx-auto max-w-[1200px] px-5 py-8" data-testid="org-console">
      <p className="text-sm font-bold uppercase tracking-wide text-muted">{t("kicker")}</p>
      <h1 className="text-3xl font-extrabold">{dash.data?.organisation.name ?? "…"}</h1>
      <nav aria-label={t("kicker")} className="mt-5 flex flex-wrap gap-2 border-b-2 border-line">
        {TABS.map((x) => {
          const href = `${base}${x}`;
          const on = x ? pathname.startsWith(href) : pathname === base;
          return (
            <Link
              key={x || "home"}
              href={href}
              aria-current={on ? "page" : undefined}
              className={`-mb-0.5 min-h-11 border-b-4 px-4 py-2 font-bold ${on ? "border-brand" : "border-transparent text-muted"}`}
            >
              {t(`tab.${tabKey(x)}`)}
            </Link>
          );
        })}
      </nav>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function OrgDashboard({ orgId }: { orgId: string }) {
  const t = useTranslations("organiser");
  const locale = useLocale();
  const q = useQuery({
    queryKey: ["org-dash", orgId],
    queryFn: () => organiser.dashboard(orgId),
  });
  if (q.isPending) return <div className="h-40 animate-pulse bg-surface-2" />;
  if (q.isError) return null;
  const d = q.data;
  return (
    <div className="grid gap-4 md:grid-cols-3" data-testid="org-dashboard">
      <div className="border-2 border-line p-4">
        <p className="text-sm font-semibold text-muted">{t("dash.contract")}</p>
        {d.contract ? (
          <>
            <p className="mt-1 text-lg font-extrabold">
              {d.contract.model === "percentage"
                ? t("dash.pct", { pct: d.contract.effectivePct ?? 0 })
                : t("dash.flat", {
                    fee: formatTaka(d.contract.flatFee ?? 0, locale),
                    cycle: t(`cycle.${d.contract.billingCycle}`),
                  })}
            </p>
            <Chip tone={TONE[d.contract.status] ?? "muted"}>{t(`contractStatus.${d.contract.status}`)}</Chip>
          </>
        ) : (
          <p className="mt-1 font-semibold">{t("dash.noContract")}</p>
        )}
      </div>
      <div className="border-2 border-line p-4">
        <p className="text-sm font-semibold text-muted">{t("dash.invoices")}</p>
        <p className="mt-1 text-lg font-extrabold tabular-nums">
          {d.unpaidInvoices
            ? t("dash.unpaid", {
                n: d.unpaidInvoices,
                total: formatTaka(d.unpaidTotal, locale),
              })
            : t("dash.allPaid")}
        </p>
      </div>
      <div className={`border-2 p-4 ${d.canSubmit ? "border-brand" : "border-danger"}`}>
        <p className="text-sm font-semibold text-muted">{t("dash.submits")}</p>
        <p className="mt-1 font-bold">{d.canSubmit ? t("dash.canSubmit") : t("dash.cannotSubmit")}</p>
      </div>
      <div className="md:col-span-3">
        <h2 className="text-xl font-extrabold">{t("dash.upcoming")}</h2>
        {d.upcoming.length ? (
          <ul className="mt-3 divide-y-2 divide-line border-y-2 border-line">
            {(
              d.upcoming as {
                id: string;
                titleEn: string;
                status: string;
                startsAt: string;
              }[]
            ).map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-3 py-2">
                <Link href={`/vendor/esports/${orgId}/events/${x.id}`} className="min-w-0 flex-1 font-semibold underline">
                  {x.titleEn}
                </Link>
                <span className="text-sm text-muted">{formatDhaka(x.startsAt, locale)}</span>
                <Chip tone={TONE[x.status] ?? "muted"}>{t(`status.${x.status}`)}</Chip>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted">{t("dash.none")}</p>
        )}
      </div>
    </div>
  );
}

export function OrgTournaments({ orgId }: { orgId: string }) {
  const t = useTranslations("organiser");
  const locale = useLocale();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const q = useQuery({
    queryKey: ["org-tournaments", orgId],
    queryFn: () => organiser.tournaments(orgId),
  });
  return (
    <div>
      <button type="button" className={`${btn} border-brand bg-brand text-white`} onClick={() => setAdding(!adding)} data-testid="org-new-tournament">
        {t("tour.new")}
      </button>
      {adding ? (
        <div className="mt-4">
          <CreateForm client={orgDesk(orgId)} organiser onCreated={(id) => router.push(`/vendor/esports/${orgId}/events/${id}`)} />
        </div>
      ) : null}
      {q.isPending ? <div className="mt-6 h-32 animate-pulse bg-surface-2" /> : null}
      {q.data && !q.data.items.length ? <p className="mt-6 border-2 border-dashed border-line p-8 text-center text-muted">{t("tour.empty")}</p> : null}
      <ul className="mt-6 divide-y-2 divide-line border-y-2 border-line" data-testid="org-tournaments">
        {(q.data?.items ?? []).map((x) => (
          <li key={x.id}>
            <Link href={`/vendor/esports/${orgId}/events/${x.id}`} className="flex flex-wrap items-center gap-3 py-3 hover:bg-surface-2">
              <span className="min-w-0 flex-1 font-bold">{x.titleEn}</span>
              <span className="text-sm text-muted">{formatDhaka(x.startsAt, locale)}</span>
              <span className="text-sm tabular-nums">{formatTaka(x.prizePool.amount, locale)}</span>
              <Chip tone={TONE[x.status] ?? "muted"}>{t(`status.${x.status}`)}</Chip>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FundBox({ orgId, id, fund, onChange }: { orgId: string; id: string; fund: Fund; onChange: () => void }) {
  const t = useTranslations("organiser");
  const locale = useLocale();
  const pay = useMutation({
    mutationFn: () => organiser.fund(orgId, id),
    onSuccess: (r) => window.location.assign(r.payment.payUrl),
  });
  const state = fundState(fund);
  void onChange;
  return (
    <div className={`border-2 p-4 ${state === "funded" ? "border-brand" : "border-amber-500"}`} data-testid="fund-box">
      <h3 className="font-bold">{t("fund.title")}</h3>
      <p className="mt-1 text-sm">
        {t("fund.line", {
          required: formatTaka(fund.required, locale),
          deposited: formatTaka(fund.deposited, locale),
        })}
      </p>
      <p className="mt-1 text-sm text-muted">{t(`fund.${state}`)}</p>
      {state === "needs" ? (
        <button type="button" className={`${btn} mt-3 border-brand bg-brand text-white`} disabled={pay.isPending} onClick={() => pay.mutate()} data-testid="fund-now">
          {t("fund.now", { amount: formatTaka(fund.toDeposit, locale) })}
        </button>
      ) : null}
      {pay.error ? <Notice tone="error">{problemOf(pay.error)?.title ?? t("failed")}</Notice> : null}
    </div>
  );
}

export function OrgTournament({ orgId, id }: { orgId: string; id: string }) {
  const t = useTranslations("organiser");
  const locale = useLocale();
  const qc = useQueryClient();
  const client = orgDesk(orgId);
  const q = useQuery({
    queryKey: ["org-tournament", orgId, id],
    queryFn: () => organiser.tournament(orgId, id),
  });
  const [msg, setMsg] = useState<{
    text: string;
    tone: "info" | "error";
  } | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["org-tournament", orgId, id] });
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
  if (q.isPending) return <div className="h-64 animate-pulse bg-surface-2" />;
  if (q.isError) return <Notice tone="error">{t("notFound")}</Notice>;
  const x = q.data;
  const draft = x.status === "draft";
  const published = !["draft", "review", "cancelled"].includes(x.status);
  return (
    <div className="space-y-6" data-testid="org-tournament">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/vendor/esports/${orgId}/events`} className="text-sm font-semibold text-brand underline">
          ← {t("tab.tournaments")}
        </Link>
        <h2 className="text-2xl font-extrabold">{x.titleEn}</h2>
        <Chip tone={TONE[x.status] ?? "muted"}>{t(`status.${x.status}`)}</Chip>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted">{t("tour.entry")}</dt>
          <dd className="font-bold tabular-nums">{formatTaka(x.entryFee.amount, locale)}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("tour.pool")}</dt>
          <dd className="font-bold tabular-nums">{formatTaka(x.prizePool.amount, locale)}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("tour.starts")}</dt>
          <dd className="font-bold">{formatDhaka(x.startsAt, locale)}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("tour.fee")}</dt>
          <dd className="font-bold">{x.saas.feeBps !== null ? `${x.saas.feeBps / 100}%` : "–"}</dd>
        </div>
      </dl>
      {draft || x.status === "review" ? <FundBox orgId={orgId} id={id} fund={x.fund} onChange={refresh} /> : null}
      <div className="flex flex-wrap gap-2">
        {draft ? (
          <button type="button" className={`${btn} border-brand`} onClick={() => void run(() => organiser.submit(orgId, id), t("tour.submitted"))} data-testid="org-submit">
            {t("tour.submit")}
          </button>
        ) : null}
        {draft || x.status === "review" ? (
          <button
            type="button"
            className={`${btn} border-danger text-danger`}
            onClick={() => {
              const why = window.prompt(t("tour.cancelReason"));
              if (why && why.trim().length >= 5) void run(() => organiser.cancel(orgId, id, why.trim()), t("tour.cancelled"));
            }}
          >
            {t("tour.cancel")}
          </button>
        ) : null}
      </div>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {published ? (
        <>
          <div>
            <h3 className="text-xl font-extrabold">{t("tour.checkins")}</h3>
            <div className="mt-2">
              <CheckinBoard id={id} client={client} />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-extrabold">{t("tour.matches")}</h3>
            <Matches matches={x.matches} canManage onChange={refresh} client={client} />
          </div>
          {["results_pending", "finalised", "paid_out"].includes(x.status) ? (
            <div>
              <h3 className="text-xl font-extrabold">{t("tour.finalise")}</h3>
              <Finalise
                id={id}
                status={x.status}
                client={client}
                totals={["collected", "paid"]}
                onFinalise={() => void run(() => organiser.finaliseCode(orgId, id).then(() => setCode("")), t("tour.codeSent"))}
              />
              {code !== null ? (
                <form
                  className="mt-3 flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(() => organiser.finalise(orgId, id, code), t("tour.finalised")).then(() => setCode(null));
                  }}
                >
                  <Field label={t("tour.code")}>
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className={`${inputCls} w-40`}
                      data-testid="finalise-code"
                    />
                  </Field>
                  <button type="submit" className={`${btn} border-brand bg-brand text-white`} disabled={code.length < 4}>
                    {t("tour.confirmFinalise")}
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function OrgBilling({ orgId }: { orgId: string }) {
  const t = useTranslations("organiser");
  const locale = useLocale();
  const contracts = useQuery({
    queryKey: ["org-contracts", orgId],
    queryFn: () => organiser.contracts(orgId),
  });
  const invoices = useQuery({
    queryKey: ["org-invoices", orgId],
    queryFn: () => organiser.invoices(orgId),
  });
  const pay = useMutation({
    mutationFn: (id: string) => organiser.payInvoice(orgId, id),
    onSuccess: (r) => window.location.assign(r.payment.payUrl),
  });
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-extrabold">{t("bill.contracts")}</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {((contracts.data?.items ?? []) as Contract[]).map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-3 border-2 border-line p-3">
              <span className="min-w-0 flex-1 font-semibold">
                {k.model === "percentage"
                  ? t("dash.pct", { pct: k.effectivePct ?? 0 })
                  : t("dash.flat", {
                      fee: formatTaka(k.flatFee ?? 0, locale),
                      cycle: t(`cycle.${k.billingCycle}`),
                    })}
              </span>
              <span className="text-sm text-muted">
                {k.startsOn}
                {k.endsOn ? ` – ${k.endsOn}` : ""}
              </span>
              <Chip tone={TONE[k.status] ?? "muted"}>{t(`contractStatus.${k.status}`)}</Chip>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="text-xl font-extrabold">{t("bill.invoices")}</h2>
        {invoices.data && !invoices.data.items.length ? <p className="mt-2 text-muted">{t("bill.none")}</p> : null}
        <ul className="mt-3 divide-y-2 divide-line border-y-2 border-line" data-testid="org-invoices">
          {(invoices.data?.items ?? []).map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="font-mono font-semibold">{i.number}</span>
              <span className="min-w-0 flex-1 text-sm text-muted">
                {i.periodStart} – {i.periodEnd}
                {i.dueAt ? ` · ${t("bill.due", { at: formatDhaka(i.dueAt, locale) })}` : ""}
              </span>
              <span className="font-bold tabular-nums">{formatTaka(i.total, locale)}</span>
              <Chip tone={TONE[i.status] ?? "muted"}>{t(`invoiceStatus.${i.status}`)}</Chip>
              {["issued", "overdue"].includes(i.status) ? (
                <button type="button" className={`${btn} border-brand bg-brand text-white`} disabled={pay.isPending} onClick={() => pay.mutate(i.id)}>
                  {t("bill.pay")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {pay.error ? <Notice tone="error">{problemOf(pay.error)?.title ?? t("failed")}</Notice> : null}
      </div>
    </div>
  );
}

export function OrgBranding({ orgId }: { orgId: string }) {
  const q = useQuery({
    queryKey: ["org-branding", orgId],
    queryFn: () => organiser.branding(orgId),
  });
  if (!q.data) return <div className="h-40 animate-pulse bg-surface-2" />;
  return <BrandingForm orgId={orgId} data={q.data} />;
}

function BrandingForm({ orgId, data }: { orgId: string; data: Branding }) {
  const t = useTranslations("organiser");
  const qc = useQueryClient();
  const q = { data };
  const [f, setF] = useState({
    primaryHex: data.primaryHex,
    accentHex: data.accentHex,
    taglineEn: data.taglineEn ?? "",
    taglineBn: data.taglineBn ?? "",
  });
  const [sub, setSub] = useState(data.subdomain ?? "");
  const [msg, setMsg] = useState<{
    text: string;
    tone: "info" | "error";
  } | null>(null);
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ text: done, tone: "info" });
      await qc.invalidateQueries({ queryKey: ["org-branding", orgId] });
    } catch (err) {
      setMsg({ text: problemOf(err)?.title ?? t("failed"), tone: "error" });
    }
  };
  const okPrimary = isHex(f.primaryHex) && contrast(f.primaryHex, "#ffffff") >= 4.5;
  const okAccent = isHex(f.accentHex) && contrast(f.accentHex, "#111210") >= 4.5;
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="grid content-start gap-3 border-2 border-line p-5" data-testid="org-branding">
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              () =>
                organiser.saveBranding(orgId, {
                  primaryHex: f.primaryHex.toLowerCase(),
                  accentHex: f.accentHex.toLowerCase(),
                  taglineEn: f.taglineEn || null,
                  taglineBn: f.taglineBn || null,
                }),
              t("brand.saved"),
            );
          }}
        >
          <h2 className="text-xl font-extrabold">{t("brand.colours")}</h2>
          {(["primaryHex", "accentHex"] as const).map((k) => (
            <Field key={k} label={t(`brand.${k}`)}>
              <span className="flex items-center gap-2">
                <input
                  type="color"
                  value={isHex(f[k]) ? f[k] : "#000000"}
                  onChange={(e) => setF({ ...f, [k]: e.target.value })}
                  className="h-11 w-14 border-2 border-line"
                  aria-label={t(`brand.${k}`)}
                />
                <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={`${inputCls} w-32 font-mono`} />
                <span className={`text-sm font-semibold ${(k === "primaryHex" ? okPrimary : okAccent) ? "text-brand" : "text-danger"}`}>
                  {(k === "primaryHex" ? okPrimary : okAccent) ? t("brand.ok") : t("brand.low")}
                </span>
              </span>
            </Field>
          ))}
          <Field label={t("brand.taglineEn")}>
            <input value={f.taglineEn} onChange={(e) => setF({ ...f, taglineEn: e.target.value })} maxLength={120} className={inputCls} />
          </Field>
          <Field label={t("brand.taglineBn")}>
            <input value={f.taglineBn} onChange={(e) => setF({ ...f, taglineBn: e.target.value })} maxLength={120} className={inputCls} />
          </Field>
          <button type="submit" className={`${btn} border-brand`} disabled={!okPrimary || !okAccent}>
            {t("brand.save")}
          </button>
        </form>
        <label className="mt-2 block">
          <span className="text-sm font-semibold text-muted">{t("brand.logo")}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="mt-1 block min-h-12 w-full border-2 border-line px-3 py-2 text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void run(() => organiser.uploadLogo(orgId, file), t("brand.logoSaved"));
            }}
          />
        </label>
        <form
          className="mt-4 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => organiser.claimSubdomain(orgId, sub.trim().toLowerCase()), t("brand.subSaved"));
          }}
        >
          <Field label={t("brand.subdomain")}>
            <span className="flex items-center gap-1">
              <input value={sub} onChange={(e) => setSub(e.target.value.toLowerCase())} className={`${inputCls} w-48`} data-testid="org-subdomain" />
              <span className="text-sm text-muted">.esports.kriraghor.com</span>
            </span>
          </Field>
          <button type="submit" className={`${btn} border-line`}>
            {t("brand.claim")}
          </button>
        </form>
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      </div>
      <div>
        <h2 className="text-xl font-extrabold">{t("brand.preview")}</h2>
        <div
          className="mt-3 border-b-4 p-6 text-white"
          style={{
            background: isHex(f.primaryHex) ? f.primaryHex : "#0b7a4b",
            borderColor: isHex(f.accentHex) ? f.accentHex : "#f2a33a",
          }}
        >
          {q.data.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={q.data.logoUrl} alt="" className="mb-3 h-14 w-14 bg-white object-contain p-1" />
          ) : null}
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: isHex(f.accentHex) ? f.accentHex : undefined }}>
            {t("brand.kicker")}
          </p>
          <p className="text-2xl font-extrabold">{q.data.name}</p>
          {f.taglineEn ? <p className="mt-1 text-white/90">{f.taglineEn}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function OrgMembers({ orgId }: { orgId: string }) {
  const t = useTranslations("organiser");
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["org-members", orgId],
    queryFn: () => organiser.members(orgId),
  });
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("staff");
  const done = () => qc.invalidateQueries({ queryKey: ["org-members", orgId] });
  const add = useMutation({
    mutationFn: () => organiser.addMember(orgId, phone.trim(), role),
    onSuccess: () => (setPhone(""), done()),
  });
  const remove = useMutation({
    mutationFn: (id: string) => organiser.removeMember(orgId, id),
    onSuccess: done,
  });
  const problem = problemOf(add.error ?? remove.error);
  return (
    <div className="max-w-2xl space-y-6">
      <ul className="divide-y-2 divide-line border-y-2 border-line" data-testid="org-members">
        {(q.data?.items ?? []).map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1 font-semibold">{m.name ?? "–"}</span>
            <span className="text-sm text-muted">{t(`role.${m.role}`)}</span>
            {m.role !== "owner" ? (
              <button type="button" className="text-sm font-semibold text-danger underline" onClick={() => remove.mutate(m.id)}>
                {t("members.remove")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <Field label={t("members.phone")}>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="off" className={`${inputCls} w-48`} required />
        </Field>
        <Field label={t("members.role")}>
          <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "staff")} className={inputCls}>
            <option value="staff">{t("role.staff")}</option>
            <option value="admin">{t("role.admin")}</option>
          </select>
        </Field>
        <button type="submit" className={`${btn} border-brand`} disabled={add.isPending}>
          {t("members.add")}
        </button>
      </form>
      <p className="text-sm text-muted">{t("members.help")}</p>
      {problem ? <Notice tone="error">{problem.title}</Notice> : null}
    </div>
  );
}

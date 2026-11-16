"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { problemOf } from "@kriraghor/api-client";
import { formatTaka } from "@/lib/admin/finance";
import { dhakaIso, halfHours, nextDays, toPoisha, vendor, type Rules, type RuleInput } from "@/lib/vendor/grounds";
import { Notice } from "@kriraghor/ui/primitives";
import { Field, inputCls } from "../admin/finance/shared";
import { BackLink } from "@kriraghor/ui/kit";

const btn = "rounded-control min-h-11 border px-4 text-sm font-bold disabled:opacity-50";
const TONE: Record<string, string> = { low: "bg-brand/10", base: "bg-surface-2", high: "bg-accent-soft", peak: "bg-accent/45" };
const KEYS = ["basePricePoisha", "peakFromHour", "peakPct", "weekendPct", "earlyToHour", "earlyPct", "minBookingMin", "advancePct", "fullRefundHours", "halfRefundHours", "checkinGraceMin", "seriesDiscountPct"] as const;
type Form = Record<(typeof KEYS)[number], string>;

function toForm(r: Rules): Form {
  return Object.fromEntries(KEYS.map((k) => [k, k === "basePricePoisha" ? String(r.basePricePoisha / 100) : String(r[k])])) as Form;
}
function fromForm(f: Form): RuleInput | null {
  const base = toPoisha(f.basePricePoisha);
  if (base === null) return null;
  const out: Record<string, number> = { basePricePoisha: base };
  for (const k of KEYS.filter((x) => x !== "basePricePoisha")) out[k] = Number(f[k]);
  return out as RuleInput;
}

/** /vendor/grounds/[id]/pricing (M09 §4.1): the rules editor, quote calculator, heatmap and history. */
export function PricingEditor({ id }: { id: string }) {
  const t = useTranslations("vendorGrounds");
  const locale = useLocale();
  const qc = useQueryClient();
  const ground = useQuery({ queryKey: ["vendor-ground", id], queryFn: () => vendor.get(id) });
  const p = useQuery({ queryKey: ["vendor-pricing", id], queryFn: () => vendor.pricing(id) });
  const history = useQuery({ queryKey: ["vendor-pricing-history", id], queryFn: () => vendor.history(id) });
  const current = p.data ? (p.data.draft ?? p.data.published) : null;
  // Local edits over the saved version; null = nothing changed.
  const [edits, setForm] = useState<Form | null>(null);
  const form = edits ?? (current ? toForm(current) : null);
  const [applyToAll, setApplyToAll] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);
  const draft = form ? fromForm(form) : null;
  const dirty = Boolean(form && current && JSON.stringify(form) !== JSON.stringify(toForm(current)));

  const refresh = async () => {
    for (const k of ["vendor-pricing", "vendor-pricing-history", "vendor-heat"]) await qc.invalidateQueries({ queryKey: [k, id] });
  };
  const act = async (fn: () => Promise<unknown>, done: string, reset = false) => {
    setMsg(null);
    setBusy(true);
    try {
      await fn();
      await refresh();
      if (reset) setForm(null);
      setMsg({ text: done, tone: "info" });
    } catch (err) {
      const pr = problemOf(err);
      setMsg({ text: pr?.errors?.length ? pr.errors.map((e) => e.message).join(" · ") : pr?.title ?? t("failed"), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (p.isPending || !form || !p.data) return <div className="rounded-card mx-auto mt-10 h-64 max-w-[1100px] kg-shimmer bg-surface-2" />;
  const { limits, policy } = p.data;
  const set = (k: keyof Form, v: string) => setForm({ ...form, [k]: v });
  const num = (k: keyof Form, label: string, help?: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label}>
      <input value={form[k]} onChange={(e) => set(k, e.target.value)} inputMode="decimal" className={inputCls} aria-describedby={help ? `${k}-help` : undefined} {...props} />
      {help ? (
        <span id={`${k}-help`} className="text-xs font-normal text-muted">
          {help}
        </span>
      ) : null}
    </Field>
  );

  return (
    <section className="mx-auto max-w-[1100px] px-5 py-8">
      <BackLink href={`/vendor/venues/${id}`}>{ground.data?.name ?? t("title")}</BackLink>
      <h1 className="mt-3 text-3xl font-extrabold">{t("pricingTitle")}</h1>
      <p className="mt-1 max-w-2xl text-muted">{t("pricingLead")}</p>

      <form
        className="rounded-card mt-6 grid gap-6 border border-line bg-surface p-5"
        data-testid="pricing-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft) void act(() => vendor.saveDraft(id, draft), t("draftSaved"), true);
        }}
      >
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 font-bold">{t("rules.base")}</legend>
          {num("basePricePoisha", t("rules.basePrice"), t("rules.baseHelp", { min: formatTaka(limits.baseMin, locale), max: formatTaka(limits.baseMax, locale) }), { disabled: p.data.baseLocked })}
        </fieldset>
        <fieldset className="grid gap-3 sm:grid-cols-3">
          <legend className="mb-2 font-bold">{t("rules.time")}</legend>
          <Field label={t("rules.peakFrom")}>
            <select value={form.peakFromHour} onChange={(e) => set("peakFromHour", e.target.value)} className={inputCls}>
              {[15, 16, 17, 18, 19, 20].map((h) => (
                <option key={h} value={h}>{`${h}:00`}</option>
              ))}
            </select>
          </Field>
          {num("peakPct", t("rules.peak"), t("rules.capped", { n: limits.peakMax }))}
          {num("weekendPct", t("rules.weekend"), t("rules.capped", { n: limits.weekendMax }))}
          <Field label={t("rules.earlyTo")}>
            <select value={form.earlyToHour} onChange={(e) => set("earlyToHour", e.target.value)} className={inputCls}>
              {[7, 8, 9, 10].map((h) => (
                <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00`}</option>
              ))}
            </select>
          </Field>
          {num("earlyPct", t("rules.early"), t("rules.capped", { n: limits.earlyMax }))}
        </fieldset>
        <fieldset className="grid gap-3 sm:grid-cols-3">
          <legend className="mb-2 font-bold">{t("rules.booking")}</legend>
          <Field label={t("rules.minBooking")}>
            <select value={form.minBookingMin} onChange={(e) => set("minBookingMin", e.target.value)} className={inputCls}>
              {limits.minLengthOptions.map((m) => (
                <option key={m} value={m}>
                  {t("minutes", { n: m })}
                </option>
              ))}
            </select>
          </Field>
          {num("advancePct", t("rules.advance"), t("rules.advanceHelp", { min: limits.advanceMin, max: limits.advanceMax, fee: limits.feePct }))}
          {num("checkinGraceMin", t("rules.grace"))}
          {num("seriesDiscountPct", t("rules.series"), t("rules.capped", { n: limits.seriesMax }))}
          {num("fullRefundHours", t("rules.fullRefund"), undefined, { disabled: !policy.advanceRefundable })}
          {num("halfRefundHours", t("rules.halfRefund"), undefined, { disabled: !policy.advanceRefundable })}
          {!policy.advanceRefundable ? <p className="text-sm text-muted sm:col-span-3">{t("rules.noRefund")}</p> : null}
        </fieldset>
        <p className="text-sm text-muted" role="status">
          {dirty ? t("footer.unsaved", { n: p.data.upcomingBookings }) : p.data.draft ? t("footer.draft") : t("footer.saved")}
        </p>
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={busy || !dirty || !draft} className={`${btn} border-brand`} data-testid="save-draft">
            {t("saveDraft")}
          </button>
          {p.data.draft ? (
            <>
              <button type="button" disabled={busy || dirty} className={`${btn} border-brand bg-brand text-on-brand`} onClick={() => void act(() => vendor.publish(id, applyToAll), t("published"), true)} data-testid="publish">
                {t("publish")}
              </button>
              <button type="button" disabled={busy} className={`${btn} border-line`} onClick={() => void act(() => vendor.discard(id), t("discarded"), true)}>
                {t("discard")}
              </button>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={applyToAll} onChange={(e) => setApplyToAll(e.target.checked)} />
                {t("applyToAll")}
              </label>
            </>
          ) : null}
          {dirty ? (
            <button type="button" className={`${btn} border-line`} onClick={() => setForm(null)}>
              {t("undo")}
            </button>
          ) : null}
        </div>
      </form>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <QuoteBox id={id} courts={(ground.data?.courts ?? []).map((c) => ({ id: c.id, name: c.name }))} draft={dirty ? draft : null} allowFull={policy.allowFullPayment} />
        <HeatmapBox id={id} />
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-extrabold">{t("history")}</h2>
        <ul className="mt-3 divide-y-2 divide-line border-y-2 border-line" data-testid="pricing-history">
          {(history.data?.items ?? []).map((h) => (
            <li key={h.version} className="flex flex-wrap gap-3 py-3 text-sm">
              <span className="font-mono text-muted">v{h.version}</span>
              <span className="flex-1">{h.summary}</span>
              <span className="text-muted">
                {h.publishedBy?.name ?? "–"} · {h.effectiveFrom ? new Date(h.effectiveFrom).toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }) : "–"}
              </span>
            </li>
          ))}
          {history.data && !history.data.items.length ? <li className="py-3 text-muted">{t("noHistory")}</li> : null}
        </ul>
      </div>
    </section>
  );
}

function QuoteBox({ id, courts, draft, allowFull }: { id: string; courts: { id: string; name: string }[]; draft: RuleInput | null; allowFull: boolean }) {
  const t = useTranslations("vendorGrounds");
  const locale = useLocale();
  const days = useMemo(() => nextDays(7), []);
  const [f, setF] = useState({ courtId: "", day: days[0], start: "18:00", minutes: "60" });
  const courtId = f.courtId || courts[0]?.id;
  const q = useQuery({
    queryKey: ["vendor-quote", id, courtId, f, draft],
    enabled: Boolean(courtId),
    retry: false,
    queryFn: () => vendor.quote(id, { courtIds: [courtId!], start: dhakaIso(f.day, f.start), minutes: Number(f.minutes), ...(draft ? { draft } : {}) }),
  });
  const money = (n: number) => formatTaka(n, locale);
  return (
    <div className="rounded-card border border-line bg-surface p-5" data-testid="quote-box">
      <h2 className="text-xl font-extrabold">{t("quote.title")}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label={t("quote.court")}>
          <select value={courtId ?? ""} onChange={(e) => setF({ ...f, courtId: e.target.value })} className={inputCls}>
            {courts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("quote.day")}>
          <select value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })} className={inputCls}>
            {days.map((d) => (
              <option key={d} value={d}>
                {new Date(`${d}T00:00:00+06:00`).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Dhaka" })}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("quote.start")}>
          <select value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} className={inputCls}>
            {halfHours("06:00", "22:30").map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("quote.length")}>
          <select value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} className={inputCls}>
            {[60, 90, 120, 180].map((m) => (
              <option key={m} value={m}>
                {t("minutes", { n: m })}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {draft ? <p className="mt-2 text-xs text-muted">{t("quote.usingDraft")}</p> : null}
      {q.isError ? <p className="mt-3 text-sm text-danger">{problemOf(q.error)?.title}</p> : null}
      {q.data ? (
        <dl className="mt-4 grid grid-cols-[1fr_auto] gap-y-2 text-sm" data-testid="quote-result">
          <dt className="text-muted">{t("quote.rate")}</dt>
          <dd className="text-right tabular-nums">{money(q.data.rateAtStart)}</dd>
          <dt className="text-muted">{t("quote.advance")}</dt>
          <dd className="text-right tabular-nums">{money(q.data.advance)}</dd>
          <dt className="text-muted">{t("quote.balance")}</dt>
          <dd className="text-right tabular-nums">{money(q.data.balance)}</dd>
          <dt className="text-muted">{t("quote.fee")}</dt>
          <dd className="text-right tabular-nums">−{money(q.data.fee)}</dd>
          <dt className="border-t-2 border-line pt-2 font-bold">{t("quote.total")}</dt>
          <dd className="border-t-2 border-line pt-2 text-right text-lg font-extrabold tabular-nums">{money(q.data.price)}</dd>
          {q.data.options.map((o) => (
            <span key={o.kind} className="contents">
              <dt className="text-muted">{t(`quote.youGet.${o.kind}`)}</dt>
              <dd className="text-right tabular-nums">
                {money(o.ownerGetsOnline)}
                {o.atVenue ? ` + ${money(o.atVenue)} ${t("quote.cash")}` : ""}
              </dd>
            </span>
          ))}
          {!allowFull ? <dd className="col-span-2 text-xs text-muted">{t("quote.noFull")}</dd> : null}
        </dl>
      ) : null}
    </div>
  );
}

function HeatmapBox({ id }: { id: string }) {
  const t = useTranslations("vendorGrounds");
  const locale = useLocale();
  const [draft, setDraft] = useState(true);
  const q = useQuery({ queryKey: ["vendor-heat", id, draft], queryFn: () => vendor.heatmap(id, draft), retry: false });
  const k = (n: number) => `${(n / 100000).toFixed(1)}k`;
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-extrabold">{t("heat.title")}</h2>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
          {t("heat.draft")}
        </label>
      </div>
      {q.data ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-0.5 text-center text-xs tabular-nums" data-testid="heatmap">
            <thead>
              <tr>
                <th />
                {q.data.rows[0]?.cells.map((c) => (
                  <th key={c.hour} scope="col" className="font-semibold text-muted">
                    {c.hour}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.data.rows.map((r) => (
                <tr key={r.date}>
                  <th scope="row" className="pr-2 text-left font-semibold">
                    {new Date(`${r.date}T00:00:00+06:00`).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "short", timeZone: "Asia/Dhaka" })}
                  </th>
                  {r.cells.map((c) => (
                    <td key={c.hour} className={`h-8 ${TONE[c.tone]}`} title={`${c.hour}:00 · ${formatTaka(c.rate, locale)}`}>
                      {k(c.rate)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">{t("heat.legend")}</p>
        </div>
      ) : (
        <div className="rounded-card mt-3 h-40 kg-shimmer bg-surface-2" />
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { api, problemOf, type Problem } from "@kriraghor/api-client";
import { stepUp } from "@/lib/admin/stepUp";
import {
  CATEGORY_ORDER,
  display,
  effectiveAtIso,
  parseInput,
  rangeHint,
  sameValue,
  toInput,
  type ChangeRequest,
  type Setting,
  type SettingValue,
} from "@/lib/admin/settings";
import { Button, Notice } from "@kriraghor/ui/primitives";
import { DateTimePicker, TimePicker } from "@kriraghor/ui/date";
import { EntityHistory } from "./EntityHistory";
import { formatDhaka, useAdminMe } from "./useAdminMe";

type Raw = string | boolean | Record<string, string>;
type Change = { key: string; to: SettingValue };

/**
 * M03 §4 Fees and rules (master). Grouped cards, typed inputs with bounds, a History drawer,
 * an "N unsaved changes" bar, a review dialog (diff, effective time, reason, authenticator code)
 * and the pending four-eyes proposals. manage_catalog staff see everything read-only.
 */
export function FeesAndRules() {
  const t = useTranslations("fees");
  const tc = useTranslations("categories");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready, me } = useAdminMe();
  const canEdit = Boolean(me?.isMaster);

  const settingsQ = useQuery({
    queryKey: ["admin-settings"],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await api("admin").GET("/admin/settings");
      if (error) throw error;
      return data.items;
    },
  });
  const requestsQ = useQuery({
    queryKey: ["settings-requests"],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await api("admin").GET("/admin/settings/change-requests", { params: { query: { limit: 50 } } });
      if (error) throw error;
      return data.items;
    },
  });

  const [drafts, setDrafts] = useState<Record<string, Raw>>({});
  const [historyKey, setHistoryKey] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const byKey = useMemo(() => new Map((settingsQ.data ?? []).map((s) => [s.key, s])), [settingsQ.data]);
  const label = (s: Pick<Setting, "label">) => (locale === "bn" ? s.label.bn : s.label.en);

  // Parse every draft; keep only real changes.
  const parsed = useMemo(() => {
    const changes: Change[] = [];
    const errors: Record<string, string> = {};
    for (const [key, raw] of Object.entries(drafts)) {
      const s = byKey.get(key);
      if (!s) continue;
      const p = parseInput(s, raw);
      if (!p.ok) errors[key] = p.error;
      else if (!sameValue(p.value, s.value)) changes.push({ key, to: p.value });
    }
    return { changes, errors };
  }, [drafts, byKey]);
  const dirty = parsed.changes.length + Object.keys(parsed.errors).length;

  const refresh = async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ["admin-settings"] }), qc.invalidateQueries({ queryKey: ["settings-requests"] })]);
  };

  if (!ready || settingsQ.isPending) {
    return (
      <p className="px-5 py-12 text-muted" role="status">
        {t("loading")}
      </p>
    );
  }
  if (settingsQ.isError) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-12">
        <Notice tone="error">{problemOf(settingsQ.error)?.title ?? "Could not load settings"}</Notice>
      </div>
    );
  }

  const settings = settingsQ.data ?? [];
  const pending = (requestsQ.data ?? []).filter((r) => r.status === "proposed" || r.status === "approved");

  return (
    <>
      <div className="mx-auto max-w-[1320px] px-5 pb-32 pt-8">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <div className="mt-3 max-w-3xl">
          <Notice>{canEdit ? t("banner") : t("readOnly")}</Notice>
        </div>
        {notice ? (
          <div className="mt-4 max-w-3xl" data-testid="fees-notice">
            <Notice tone={notice.tone}>{notice.text}</Notice>
          </div>
        ) : null}

        <PendingList
          items={pending}
          settings={byKey}
          meId={me?.id}
          canAct={canEdit}
          label={label}
          onDone={async (text) => {
            setNotice({ tone: "info", text });
            await refresh();
          }}
        />

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          {CATEGORY_ORDER.map((cat) => {
            const rows = settings.filter((s) => s.category === cat);
            if (!rows.length) return null;
            return (
              <section key={cat} aria-labelledby={`cat-${cat}`} className="rounded-card border border-line bg-surface">
                <h2 id={`cat-${cat}`} className="border-b-2 border-line px-5 py-3 text-lg font-bold">
                  {tc(cat)}
                </h2>
                <ul className="divide-y divide-line">
                  {rows.map((s) => (
                    <SettingRow
                      key={s.key}
                      setting={s}
                      raw={drafts[s.key] ?? toInput(s)}
                      changed={s.key in drafts}
                      error={parsed.errors[s.key] ?? serverErrors[s.key]}
                      disabled={!canEdit}
                      label={label(s)}
                      onChange={(raw) => {
                        setServerErrors((e) => ({ ...e, [s.key]: "" }));
                        setDrafts((d) => {
                          const next = { ...d, [s.key]: raw };
                          const p = parseInput(s, raw);
                          if (p.ok && sameValue(p.value, s.value)) delete next[s.key];
                          return next;
                        });
                      }}
                      onHistory={() => setHistoryKey(s.key)}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      {canEdit && dirty > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-line-strong bg-surface">
          <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-3 px-5 py-3">
            <p className="font-bold" role="status" data-testid="unsaved-count">
              {t("unsaved", { count: dirty })}
            </p>
            <div className="ml-auto flex gap-2">
              <button type="button" className="rounded-control min-h-12 border border-line-strong/60 px-4 font-semibold" onClick={() => setDrafts({})}>
                {t("discard")}
              </button>
              <Button type="button" disabled={Object.keys(parsed.errors).length > 0 || parsed.changes.length === 0} onClick={() => setReviewOpen(true)}>
                {t("review")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {reviewOpen ? (
        <ReviewDialog
          changes={parsed.changes}
          settings={byKey}
          label={label}
          onClose={() => setReviewOpen(false)}
          onSaved={async (request) => {
            setReviewOpen(false);
            setDrafts({});
            setServerErrors({});
            const text =
              request.status === "applied"
                ? t("savedApplied")
                : request.status === "approved"
                  ? t("savedScheduled", { date: formatDhaka(request.effectiveAt, locale) })
                  : t("savedWaiting");
            setNotice({ tone: "info", text });
            await refresh();
          }}
          onFieldErrors={(errs) => setServerErrors(errs)}
        />
      ) : null}

      {historyKey ? <HistoryDrawer setting={byKey.get(historyKey)!} label={label} onClose={() => setHistoryKey(null)} /> : null}
    </>
  );
}

// ---------------------------------------------------------------- one setting

function SettingRow({
  setting: s,
  raw,
  changed,
  error,
  disabled,
  label,
  onChange,
  onHistory,
}: {
  setting: Setting;
  raw: Raw;
  changed: boolean;
  error?: string;
  disabled: boolean;
  label: string;
  onChange: (raw: Raw) => void;
  onHistory: () => void;
}) {
  const t = useTranslations("fees");
  const locale = useLocale();
  const id = `set-${s.key.replace(/\./g, "-")}`;
  const hint = rangeHint(s);
  const why = s.why ? (locale === "bn" ? s.why.bn || s.why.en : s.why.en) : null;
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  const inputCls = `rounded-control min-h-11 w-full border bg-surface px-3 text-base text-ink focus:border-brand disabled:bg-surface-2 ${error ? "border-danger" : changed ? "border-brand" : "border-line"}`;

  let control;
  if (s.valueType === "bool") {
    const on = raw === true;
    control = (
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={`${id}-label`}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={`inline-flex min-h-11 min-w-24 items-center justify-center rounded-full border px-4 text-sm font-bold disabled:opacity-60 ${on ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink"}`}
      >
        {on ? t("on") : t("off")}
      </button>
    );
  } else if (s.valueType === "enum") {
    control = (
      <select id={id} className={inputCls} value={String(raw)} disabled={disabled} aria-describedby={describedBy} onChange={(e) => onChange(e.target.value)}>
        {(s.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  } else if (s.valueType === "json") {
    const obj = raw as Record<string, string>;
    control = (
      <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby={`${id}-label`}>
        {Object.entries(obj).map(([k, v]) => (
          <label key={k} className="flex flex-col text-xs font-semibold text-muted">
            {k}
            <input className={inputCls} inputMode="decimal" value={v} disabled={disabled} onChange={(e) => onChange({ ...obj, [k]: e.target.value })} />
          </label>
        ))}
      </div>
    );
  } else if (s.valueType === "time") {
    // A time of day ("HH:MM"): the shared picker, every 15 minutes, an off-step stored value kept in the list.
    control = <TimePicker id={id} label={label} labelHidden value={String(raw)} step={15} disabled={disabled} onChange={(v) => onChange(v)} triggerClassName={error ? "border-danger" : changed ? "border-brand" : undefined} />;
  } else {
    const isNumber = s.valueType === "int" || s.valueType === "decimal" || s.valueType === "money";
    control = (
      <div className="flex items-center gap-2">
        {s.valueType === "money" ? <span aria-hidden className="font-bold text-muted">৳</span> : null}
        <input
          id={id}
          className={inputCls}
          type="text"
          inputMode={isNumber ? (s.valueType === "int" ? "numeric" : "decimal") : undefined}
          value={String(raw)}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
        {s.unit && s.valueType !== "money" ? <span className="shrink-0 text-sm text-muted">{s.unit}</span> : null}
        {s.valueType === "money" ? <span className="sr-only">{t("inTaka")}</span> : null}
      </div>
    );
  }

  return (
    <li className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_minmax(0,14rem)]" data-key={s.key}>
      <div>
        {/* A time setting labels its own picker (hidden there); this visible name stays, without a second label on the control. */}
        <label id={s.valueType === "time" ? undefined : `${id}-label`} htmlFor={s.valueType === "json" || s.valueType === "time" ? undefined : id} className="font-semibold">
          {label}
        </label>
        {why ? <p className="mt-1 text-sm text-muted">{why}</p> : null}
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
          <code className="font-mono">{s.key}</code>
          <span>{t("version", { version: s.version })}</span>
          {s.updatedAt && s.version > 1 ? <span>{t("changed", { date: formatDhaka(s.updatedAt, locale) })}</span> : null}
          {s.approval === "four_eyes" ? <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">{t("fourEyes")}</span> : null}
          {s.isPublic ? <span className="rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-brand-text">{t("public")}</span> : null}
          <button type="button" className="min-h-8 underline" onClick={onHistory}>
            {t("history")}
          </button>
        </p>
      </div>
      <div>
        {control}
        {hint && !error ? (
          <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------- review and save

function ReviewDialog({
  changes,
  settings,
  label,
  onClose,
  onSaved,
  onFieldErrors,
}: {
  changes: Change[];
  settings: Map<string, Setting>;
  label: (s: Setting) => string;
  onClose: () => void;
  onSaved: (r: ChangeRequest) => void | Promise<void>;
  onFieldErrors: (errors: Record<string, string>) => void;
}) {
  const t = useTranslations("fees");
  const [when, setWhen] = useState<"now" | "at">("now");
  const [at, setAt] = useState("");
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    reasonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const fourEyes = changes.some((c) => settings.get(c.key)?.approval === "four_eyes");
  const valid = reason.trim().length >= 5 && /^\d{6}$/.test(code) && (when === "now" || Boolean(effectiveAtIso(at)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setProblem(null);
    try {
      const token = await stepUp(code);
      const { data, error } = await api("admin").POST("/admin/settings/change-requests", {
        params: { header: { "x-step-up": token } },
        body: { changes, reason: reason.trim(), source: "fees_screen", effectiveAt: when === "at" ? effectiveAtIso(at) : undefined },
      });
      if (error || !data) throw problemOf(error) ?? { code: "UNKNOWN", title: "Could not save", status: 0 };
      await onSaved(data);
    } catch (err) {
      const p = problemOf(err) ?? { code: "UNKNOWN", title: "Could not save", status: 0 };
      setProblem(p);
      setCode("");
      const fieldErrors = Object.fromEntries((p.errors ?? []).filter((x) => settings.has(x.field)).map((x) => [x.field, x.message]));
      if (Object.keys(fieldErrors).length) onFieldErrors(fieldErrors);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form role="dialog" aria-modal="true" aria-labelledby="review-title" onSubmit={submit} className="rounded-card max-h-[90dvh] w-full max-w-2xl overflow-y-auto border border-line-strong bg-surface p-6">
        <h2 id="review-title" className="text-xl font-extrabold">
          {t("reviewTitle")}
        </h2>
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b-2 border-line">
              <th className="py-2 pr-3" scope="col"></th>
              <th className="py-2 pr-3" scope="col">
                {t("from")}
              </th>
              <th className="py-2" scope="col">
                {t("to")}
              </th>
            </tr>
          </thead>
          <tbody>
            {changes.map((c) => {
              const s = settings.get(c.key)!;
              return (
                <tr key={c.key} className="border-b border-line">
                  <th scope="row" className="py-2 pr-3 font-semibold">
                    {label(s)}
                    {s.approval === "four_eyes" ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{t("fourEyes")}</span> : null}
                  </th>
                  <td className="py-2 pr-3 text-muted line-through">{display(s, s.value)}</td>
                  <td className="py-2 font-bold">{display(s, c.to)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-muted">{t("effective")}</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {(["now", "at"] as const).map((w) => (
              <label key={w} className="inline-flex min-h-11 items-center gap-2">
                <input type="radio" name="when" checked={when === w} onChange={() => setWhen(w)} className="size-5 accent-brand" />
                {t(w)}
              </label>
            ))}
          </div>
          {when === "at" ? <DateTimePicker id="review-at" className="mt-2 max-w-md" label={t("at")} labelHidden value={at} onChange={setAt} /> : null}
        </fieldset>

        <label htmlFor="review-reason" className="mt-5 block text-sm font-semibold text-muted">
          {t("reason")}
        </label>
        <textarea id="review-reason" ref={reasonRef} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="rounded-card mt-1 w-full border border-line bg-surface p-3" aria-describedby="review-reason-hint" />
        <p id="review-reason-hint" className="text-xs text-muted">
          {t("reasonHint")}
        </p>

        <label htmlFor="review-code" className="mt-5 block text-sm font-semibold text-muted">
          {t("code")}
        </label>
        <input
          id="review-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          className="rounded-control mt-1 min-h-12 w-40 border border-line-strong/60 bg-surface px-3 font-mono text-lg tracking-widest"
          aria-describedby="review-code-hint"
        />
        <p id="review-code-hint" className="text-xs text-muted">
          {t("codeHint")}
        </p>
        {fourEyes ? <p className="mt-3 text-sm">{t("savedWaiting")}</p> : null}

        {problem ? (
          <div className="mt-4">
            <Notice tone="error">
              {problem.title}
              {problem.detail ? `: ${problem.detail}` : ""}
            </Notice>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="rounded-control min-h-12 border border-line-strong/60 px-4 font-semibold" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </button>
          <Button type="submit" busy={busy} disabled={!valid}>
            {t("save")}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- pending proposals

function PendingList({
  items,
  settings,
  meId,
  canAct,
  label,
  onDone,
}: {
  items: ChangeRequest[];
  settings: Map<string, Setting>;
  meId?: string;
  canAct: boolean;
  label: (s: Setting) => string;
  onDone: (text: string) => void | Promise<void>;
}) {
  const t = useTranslations("fees");
  const locale = useLocale();
  return (
    <section aria-labelledby="pending-title" className="mt-8">
      <h2 id="pending-title" className="text-xl font-bold">
        {t("pending")}
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{t("pendingEmpty")}</p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {items.map((r) => (
            <li key={r.id} className="rounded-card border border-line bg-surface p-4" data-testid="pending-item">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">{t(`status.${r.status}`)}</span>
                <span className="text-muted">{t("proposedBy", { name: r.proposedBy?.displayName ?? "" })}</span>
                <span className="text-muted">· {formatDhaka(r.effectiveAt, locale)}</span>
              </div>
              <ul className="mt-2 text-sm">
                {r.changes.map((c) => {
                  const s = settings.get(c.key);
                  return (
                    <li key={c.key}>
                      <span className="font-semibold">{s ? label(s) : c.key}</span>: {s ? display(s, c.from) : String(c.from)} → <strong>{s ? display(s, c.to) : String(c.to)}</strong>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1 text-sm text-muted">{r.reason}</p>
              {canAct ? <PendingActions request={r} mine={r.proposedBy?.id === meId} onDone={onDone} /> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PendingActions({ request, mine, onDone }: { request: ChangeRequest; mine: boolean; onDone: (text: string) => void | Promise<void> }) {
  const t = useTranslations("fees");
  const [action, setAction] = useState<"approve" | "reject" | "withdraw" | null>(null);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  const actions: ("approve" | "reject" | "withdraw")[] = mine ? ["withdraw"] : request.status === "proposed" ? ["approve", "reject"] : [];
  if (!actions.length) return null;

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!action) return;
    setBusy(true);
    setProblem(null);
    try {
      const token = await stepUp(code);
      const opts = { params: { path: { id: request.id }, header: { "x-step-up": token } }, body: { note: note.trim() || undefined } };
      const res =
        action === "approve"
          ? await api("admin").POST("/admin/settings/change-requests/{id}/approve", opts)
          : action === "withdraw"
            ? await api("admin").POST("/admin/settings/change-requests/{id}/withdraw", opts)
            : await api("admin").POST("/admin/settings/change-requests/{id}/reject", { ...opts, body: { note: note.trim() } });
      if (res.error || !res.data) throw problemOf(res.error);
      await onDone(t(`status.${res.data.status}`));
      setAction(null);
    } catch (err) {
      setProblem(problemOf(err) ?? { code: "UNKNOWN", title: "Could not save", status: 0 });
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  if (!action) {
    return (
      <div className="mt-3 flex gap-2">
        {actions.map((a) => (
          <button key={a} type="button" onClick={() => setAction(a)} className={`rounded-control min-h-11 px-4 text-sm font-bold ${a === "approve" ? "bg-brand text-white hover:bg-brand-hover" : "border border-line-strong/60"}`}>
            {t(a)}
          </button>
        ))}
      </div>
    );
  }

  const needsNote = action === "reject";
  const valid = /^\d{6}$/.test(code) && (!needsNote || note.trim().length >= 3);
  return (
    <form onSubmit={run} className="mt-3 flex flex-wrap items-end gap-3">
      <label className="flex flex-col text-xs font-semibold text-muted">
        {t("note")}
        <input value={note} onChange={(e) => setNote(e.target.value)} className="rounded-control min-h-11 border border-line-strong/60 bg-surface px-3 text-base text-ink" aria-describedby={needsNote ? `note-${request.id}` : undefined} />
      </label>
      <label className="flex flex-col text-xs font-semibold text-muted">
        {t("code")}
        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" className="rounded-control min-h-11 w-32 border border-line-strong/60 bg-surface px-3 font-mono text-base text-ink" />
      </label>
      <Button type="submit" busy={busy} disabled={!valid}>
        {t(action)}
      </Button>
      <button type="button" className="min-h-12 px-3 text-sm underline" onClick={() => setAction(null)} disabled={busy}>
        {t("cancel")}
      </button>
      {needsNote ? (
        <p id={`note-${request.id}`} className="w-full text-xs text-muted">
          {t("noteRequired")}
        </p>
      ) : null}
      {problem ? (
        <div className="w-full">
          <Notice tone="error">
            {problem.title}
            {problem.detail ? `: ${problem.detail}` : ""}
          </Notice>
        </div>
      ) : null}
    </form>
  );
}

// ---------------------------------------------------------------- history drawer

function HistoryDrawer({ setting, label, onClose }: { setting: Setting; label: (s: Setting) => string; onClose: () => void }) {
  const t = useTranslations("fees");
  const locale = useLocale();
  const closeRef = useRef<HTMLButtonElement>(null);
  const q = useQuery({
    queryKey: ["settings-history", setting.key],
    queryFn: async () => {
      const { data, error } = await api("admin").GET("/admin/settings/{key}/history", { params: { path: { key: setting.key } } });
      if (error) throw error;
      return data.items;
    },
  });

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" aria-labelledby="history-title" className="h-full w-full max-w-md overflow-y-auto border-l-2 border-line-strong bg-surface p-6">
        <div className="flex items-start gap-3">
          <h2 id="history-title" className="text-lg font-extrabold">
            {t("historyTitle", { label: label(setting) })}
          </h2>
          <button ref={closeRef} type="button" className="rounded-control ml-auto min-h-11 border border-line-strong/60 px-3 text-sm font-semibold" onClick={onClose}>
            {t("close")}
          </button>
        </div>
        {q.isPending ? (
          <p className="mt-4 text-sm text-muted" role="status">
            {t("loading")}
          </p>
        ) : !q.data?.length ? (
          <p className="mt-4 text-sm text-muted">{t("historyEmpty")}</p>
        ) : (
          <ol className="mt-4 grid gap-3">
            {q.data.map((h) => (
              <li key={h.version} className="border-l-4 border-brand pl-3 text-sm">
                <p className="font-bold">
                  {t("version", { version: h.version })}: {h.oldValue === null ? "" : `${display(setting, h.oldValue)} → `}
                  {display(setting, h.newValue)}
                </p>
                <p className="text-muted">
                  {formatDhaka(h.effectiveAt, locale)}
                  {h.changedBy?.displayName ? ` · ${h.changedBy.displayName}` : ""}
                  {h.approvedBy?.displayName ? ` · ✓ ${h.approvedBy.displayName}` : ""}
                </p>
                {h.reason ? <p className="text-muted">{h.reason}</p> : null}
              </li>
            ))}
          </ol>
        )}
        <EntityHistory entityType="platform_setting" entityId={setting.key} />
      </aside>
    </div>
  );
}

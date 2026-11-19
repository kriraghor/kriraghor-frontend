"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { DownloadSimple, UploadSimple } from "@phosphor-icons/react";
import { newKey } from "@kriraghor/ui/format";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Badge, Button, Card, Checkbox, Notice, Skeleton, useConfirm, useToast } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { useUrlFilters } from "@kriraghor/ui/url-filters";
import { countdown, gymManage, importPreview, importTemplateCsv, secondsLeft, type GymImport } from "@/lib/gym-manage";
import { GymPage, useFmt, useGymError, type GymCtx } from "./common";

const SPEC = { id: { default: "" } };

/**
 * /manage/[gymId]/import (owner; M24-FR-75 to FR-79): download the template (built here, CSV), upload a
 * CSV or XLSX, read the preview row by row with its errors, **Apply** the good rows, **Undo** inside
 * the window (a countdown), **Discard**, **Send app invites** (nothing is sent until asked), and the
 * owner's consent for Kriraghor to upload on their behalf.
 */
export function Import({ gymId }: { gymId: string }) {
  const t = useTranslations("gm");
  return (
    <GymPage gymId={gymId} page="import" title={t("import.title")} description={t("import.lead")} testId="gm-import" wide>
      {(ctx) => (ctx.gym.setupDone ? <Body ctx={ctx} /> : <Notice tone="warning" title={t("gyms.setupTitle")} action={<Link href={`/start?gym=${gymId}&step=code`} className="font-semibold underline">{t("gyms.setupCta")}</Link>}>{t("gyms.setupBody")}</Notice>)}
    </GymPage>
  );
}

function Body({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gm");
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const { values, set } = useUrlFilters(SPEC);
  const list = useQuery({ queryKey: ["gm-imports", ctx.gymId], queryFn: () => gymManage.imports(ctx.gymId) });
  const currentId = values.id || list.data?.items.find((i) => i.status === "previewed" || (i.status === "applied" && i.can.undo))?.id || "";
  const current = useQuery({ queryKey: ["gm-import", ctx.gymId, currentId], queryFn: () => gymManage.import(ctx.gymId, currentId), enabled: Boolean(currentId) });
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [applyKey, setApplyKey] = useState(newKey);
  const template = useMemo(() => importTemplateCsv([t("import.example.name"), "01712345678", "male", "1995-04-21", t("import.example.package"), "2026-10-01", "2026-10-30", "2026-10-01", "1500", "0", ""]), [t]);
  const templateHref = useMemo(() => `data:text/csv;charset=utf-8,${encodeURIComponent(template)}`, [template]);

  const refresh = async (id?: string) => {
    await qc.invalidateQueries({ queryKey: ["gm-imports", ctx.gymId] });
    if (id) await qc.invalidateQueries({ queryKey: ["gm-import", ctx.gymId, id] });
    await qc.invalidateQueries({ queryKey: ["gm-members", ctx.gymId] });
    await qc.invalidateQueries({ queryKey: ["gm-overview", ctx.gymId] });
  };
  const run = async (name: string, fn: () => Promise<GymImport | unknown>, done?: string) => {
    // Keep the import on screen after it changes state (an undone import leaves the default pick).
    if (!values.id && currentId) set({ id: currentId });
    setBusy(name);
    setProblem(null);
    try {
      const r = await fn();
      await refresh(currentId);
      if (done) toast.show(done);
      return r;
    } catch (e) {
      setProblem(err(e));
      return null;
    } finally {
      setBusy(null);
    }
  };
  const upload = async (file: File) => {
    setBusy("upload");
    setProblem(null);
    try {
      const imp = await gymManage.upload(ctx.gymId, file);
      setApplyKey(newKey());
      qc.setQueryData(["gm-import", ctx.gymId, imp.id], imp);
      set({ id: imp.id });
      await qc.invalidateQueries({ queryKey: ["gm-imports", ctx.gymId] });
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Card padded={false} className="flex flex-col gap-2 p-4">
          <h2 className="font-display text-lg font-bold">{t("import.step1")}</h2>
          <p className="text-sm text-muted">{t("import.templateBody")}</p>
          <a href={templateHref} download="kriraghor-members-template.csv" className="inline-flex min-h-11 items-center gap-2 self-start rounded-control border border-line-strong/70 px-4 text-sm font-semibold no-underline hover:border-brand" data-testid="import-template">
            <DownloadSimple size={18} aria-hidden /> {t("import.template")}
          </a>
          <p className="text-xs text-muted">{t("import.formats")}</p>
        </Card>
        <Card padded={false} className="flex flex-col gap-2 p-4">
          <h2 className="font-display text-lg font-bold">{t("import.step2")}</h2>
          <p className="text-sm text-muted">{t("import.uploadBody")}</p>
          <label className={cn("inline-flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-control bg-brand px-4 text-sm font-bold text-on-brand", busy === "upload" && "opacity-60")}>
            <UploadSimple size={18} aria-hidden /> {busy === "upload" ? t("import.uploading") : t("import.choose")}
            <input
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              disabled={busy === "upload"}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void upload(file);
              }}
              data-testid="import-file"
            />
          </label>
        </Card>
      </div>
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      {currentId ? current.isPending ? <Skeleton className="h-64 rounded-card" /> : current.data ? <ImportView imp={current.data} busy={busy} onApply={() => run("apply", () => gymManage.applyImport(ctx.gymId, currentId, applyKey), t("import.applied"))} onUndo={() => run("undo", () => gymManage.undoImport(ctx.gymId, currentId), t("import.undone"))} onDiscard={async () => { if (await run("discard", () => gymManage.discardImport(ctx.gymId, currentId), t("import.discarded"))) set({ id: null }); }} onInvites={() => run("invites", () => gymManage.sendInvites(ctx.gymId, currentId)).then((r) => r && toast.show(t("import.invitesSent", { n: (r as GymImport).sent ?? 0 })))} /> : <Notice tone="error">{err(current.error)}</Notice> : null}
      <History items={list.data?.items ?? []} currentId={currentId} onPick={(id) => set({ id })} />
      <Consent ctx={ctx} />
    </div>
  );
}

function ImportView({ imp, busy, onApply, onUndo, onDiscard, onInvites }: { imp: GymImport; busy: string | null; onApply: () => void; onUndo: () => void; onDiscard: () => void; onInvites: () => void }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const [now, setNow] = useState(() => Date.now());
  const [onlyErrors, setOnlyErrors] = useState(false);
  useEffect(() => {
    if (!imp.undoUntil || imp.status !== "applied") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [imp.undoUntil, imp.status]);
  const preview = importPreview(imp.report ?? []);
  const rows = onlyErrors ? preview.rows.filter((r) => r.status === "error") : preview.rows;
  const left = secondsLeft(imp.undoUntil, now);
  return (
    <Card padded={false} className="flex flex-col gap-3 p-4" data-testid="import-view" data-status={imp.status}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold">{imp.fileName}</h2>
          <p className="text-sm text-muted">{t("import.uploadedAt", { date: f.short(imp.createdAt), time: f.time(imp.createdAt) })}</p>
        </div>
        <Badge tone={imp.status === "applied" ? "brand" : imp.status === "previewed" ? "info" : "neutral"}>{t(`importStatus.${imp.status}`)}</Badge>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge>{t("import.total", { n: imp.rowsTotal })}</Badge>
        <Badge tone="brand">{t("import.ok", { n: imp.rowsOk })}</Badge>
        <Badge tone={imp.rowsFailed ? "danger" : "neutral"}>{t("import.failed", { n: imp.rowsFailed })}</Badge>
      </div>
      {imp.status === "applied" && left > 0 ? <Notice tone="info" title={t("import.undoWindow", { left: countdown(left) })}>{t("import.undoBody")}</Notice> : null}
      {imp.invitesSentAt ? <p className="text-sm text-muted">{t("import.invitesSentAt", { date: f.short(imp.invitesSentAt) })}</p> : null}
      <div className="flex flex-wrap gap-2">
        {imp.can.apply ? (
          <Button type="button" onClick={onApply} busy={busy === "apply"} disabled={!imp.rowsOk} confirm={{ kind: "add", title: t("import.applyAsk", { n: imp.rowsOk }) }} data-testid="import-apply">
            {t("import.apply", { n: imp.rowsOk })}
          </Button>
        ) : null}
        {imp.can.undo ? (
          <Button type="button" variant="secondary" onClick={onUndo} busy={busy === "undo"} confirm={{ kind: "remove", title: t("import.undoAsk"), body: t("import.undoBody") }} data-testid="import-undo">
            {t("import.undo")}
          </Button>
        ) : null}
        {imp.can.sendInvites ? (
          <Button type="button" variant="secondary" onClick={onInvites} busy={busy === "invites"} confirm={{ kind: "send", title: t("import.invitesAsk") }} data-testid="import-invites">
            {t("import.sendInvites")}
          </Button>
        ) : null}
        {imp.can.discard ? (
          <Button type="button" variant="ghost" onClick={onDiscard} busy={busy === "discard"} confirm={{ kind: "remove", title: t("import.discardAsk") }} data-testid="import-discard">
            {t("import.discard")}
          </Button>
        ) : null}
      </div>
      {(imp.status === "previewed" || imp.status === "applied") && !imp.invitesSentAt ? <p className="text-xs text-muted">{t("import.noContact")}</p> : null}
      {preview.rows.length ? (
        <>
          <Checkbox id="import-only-errors" label={t("import.onlyErrors", { n: preview.failed })} checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} />
          <div className="max-h-[60vh] overflow-auto rounded-control border border-line">
            <table className="w-full min-w-[720px] text-left text-sm" data-testid="import-preview">
              <thead className="sticky top-0 bg-surface-2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-2 py-1.5">#</th>
                  <th className="px-2 py-1.5">{t("import.col.status")}</th>
                  <th className="px-2 py-1.5">{t("member.name")}</th>
                  <th className="px-2 py-1.5">{t("member.phone")}</th>
                  <th className="px-2 py-1.5">{t("import.col.code")}</th>
                  <th className="px-2 py-1.5">{t("member.package")}</th>
                  <th className="px-2 py-1.5">{t("import.col.period")}</th>
                  <th className="px-2 py-1.5">{t("import.col.lastPaid")}</th>
                  <th className="px-2 py-1.5">{t("import.col.due")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.n} className={r.status === "error" ? "bg-danger-soft/50" : undefined} data-testid="import-row" data-status={r.status}>
                    <td className="px-2 py-1.5 tabular-nums text-muted">{r.n}</td>
                    <td className="px-2 py-1.5">
                      {r.status === "ok" ? (
                        <Badge tone="brand">{t("import.rowOk")}</Badge>
                      ) : (
                        <span className="flex flex-col gap-0.5">
                          {r.errors.map((e, i) => (
                            <span key={i} className="text-xs font-semibold text-danger">
                              {t.has(`import.field.${e.field}`) ? t(`import.field.${e.field}`) : e.field}: {t.has(`import.err.${e.code}`) ? t(`import.err.${e.code}`) : e.code}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 font-semibold">{r.displayName ?? "–"}</td>
                    <td className="px-2 py-1.5 tabular-nums">{r.phoneLast4 ? `••${r.phoneLast4}` : "–"}</td>
                    <td className="px-2 py-1.5 tabular-nums">{r.memberCode ?? "–"}</td>
                    <td className="px-2 py-1.5">{r.package ?? "–"}</td>
                    <td className="px-2 py-1.5 tabular-nums">{r.startsOn ? `${f.short(r.startsOn)} – ${f.short(r.endsOn)}` : "–"}</td>
                    <td className="px-2 py-1.5 tabular-nums">{r.lastPaidPoisha ? `${f.taka(r.lastPaidPoisha)} · ${f.short(r.lastPaidOn)}` : "–"}</td>
                    <td className="px-2 py-1.5 tabular-nums">{r.amountDuePoisha ? f.taka(r.amountDuePoisha) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </Card>
  );
}

function History({ items, currentId, onPick }: { items: GymImport[]; currentId: string; onPick: (id: string) => void }) {
  const t = useTranslations("gm");
  const f = useFmt();
  if (!items.length) return null;
  return (
    <Card padded={false} className="p-4">
      <h2 className="font-display text-lg font-bold">{t("import.history")}</h2>
      <ul className="mt-2 divide-y divide-line">
        {items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
            <button type="button" className={cn("min-h-9 font-semibold underline-offset-2 hover:underline", i.id === currentId && "text-brand-text")} onClick={() => onPick(i.id)}>
              {i.fileName}
            </button>
            <span className="text-muted">{f.short(i.createdAt)}</span>
            <Badge>{t(`importStatus.${i.status}`)}</Badge>
            <span className="text-xs text-muted">{t("import.okOf", { ok: i.rowsOk, total: i.rowsTotal })}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Consent({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const s = useQuery({ queryKey: ["gm-settings", ctx.gymId], queryFn: () => gymManage.settings(ctx.gymId) });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const until = s.data?.importConsentUntil ?? null;
  const on = Boolean(until && Date.parse(until) > now);
  const ask = useConfirm();
  const toggle = async (grant: boolean) => {
    if (!(await ask(grant ? { kind: "save", title: t("import.consentAskOn"), body: t("import.consentBody") } : { kind: "save", title: t("import.consentAskOff") }))) return;
    setBusy(true);
    setProblem(null);
    try {
      await gymManage.consent(ctx.gymId, grant);
      await qc.invalidateQueries({ queryKey: ["gm-settings", ctx.gymId] });
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card padded={false} className="flex flex-col gap-2 p-4" data-testid="import-consent">
      <h2 className="font-display text-lg font-bold">{t("import.consentTitle")}</h2>
      <p className="text-sm text-muted">{t("import.consentBody")}</p>
      <Checkbox id="import-consent-toggle" label={on ? t("import.consentOn", { date: f.date(until) }) : t("import.consentOff")} checked={on} disabled={busy || s.isPending} onChange={(e) => void toggle(e.target.checked)} />
      {problem ? <p role="alert" className="text-sm text-danger">{problem}</p> : null}
    </Card>
  );
}

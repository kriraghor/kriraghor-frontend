"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ChatCircleText, PaperPlaneTilt } from "@phosphor-icons/react";
import { newKey } from "@kriraghor/ui/format";
import { Badge, Button, Card, DataTable, Field, Notice, SegmentedControl, Textarea, useConfirm, useToast } from "@kriraghor/ui/kit";
import { emptySegment, segmentFrom, type SegmentDraft } from "@/lib/gym-ops";
import { featureLocked } from "@/lib/gym-manage";
import { gymWhatsapp, type BulkKind, type Estimate, type GymWhatsapp, type WaSegment } from "@/lib/gym-whatsapp";
import { notReached, previewText, sendBlock, sendCounts, type PreviewSay } from "@/lib/whatsapp";
import { SegmentPicker } from "../gym-ops/SegmentPicker";
import { Upsell, useFmt, type GymCtx } from "./common";
import { useWaError } from "./wa-parts";

const KINDS = ["active", "expiring", "expired", "not_seen", "package"] as const;
const TITLE_MAX = 80;
const MESSAGE_MAX = 500;

/** Calm "coming soon" while the platform switch is off. */
function Soon({ testId }: { testId: string }) {
  const t = useTranslations("gw");
  return (
    <Card padded={false} className="flex gap-3 border-dashed p-4" data-testid={testId} data-state="soon">
      <ChatCircleText size={24} className="shrink-0 text-muted" aria-hidden />
      <div>
        <p className="font-semibold">{t("api.title")}</p>
        <p className="text-sm text-muted">{t("api.soon")}</p>
      </div>
    </Card>
  );
}

/**
 * The Send tab (M24-FR-166 to FR-168): a notice (title and message) or a greeting to a group of members,
 * the live count of who it reaches and why the others are not, the units it holds against the balance,
 * the group sends left today and the message bubble members see. Sent once, after a confirm.
 */
export function WaSendTab({ ctx, w }: { ctx: GymCtx; w: GymWhatsapp }) {
  if (featureLocked(ctx.gym.features, "whatsapp")) return <Upsell feature="whatsapp" owner={ctx.owner} />;
  if (!w.apiEnabled) return <Soon testId="wa-send-soon" />;
  return <SendForm ctx={ctx} />;
}

function SendForm({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gw");
  const f = useFmt();
  const waErr = useWaError();
  const ask = useConfirm();
  const toast = useToast();
  const qc = useQueryClient();
  const [kind, setKind] = useState<BulkKind>("notice");
  const [seg, setSeg] = useState<SegmentDraft>(emptySegment);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [key, setKey] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const segment = segmentFrom(seg) as WaSegment | null;
  const segKey = JSON.stringify(segment);
  // Count again a moment after the group or the type stops changing.
  const [settled, setSettled] = useState(segKey);
  useEffect(() => {
    const h = window.setTimeout(() => setSettled(segKey), 350);
    return () => window.clearTimeout(h);
  }, [segKey]);
  const ready = Boolean(segment) && settled === segKey;
  const estQ = useQuery({ queryKey: ["gm-wa-estimate", ctx.gymId, kind, settled], queryFn: () => gymWhatsapp.estimate(ctx.gymId, kind, segment as WaSegment), enabled: ready, retry: false });
  const est: Estimate | null = ready ? (estQ.data ?? null) : null;
  const counting = Boolean(segment) && (!ready || estQ.isFetching);
  const estProblem = ready && estQ.isError ? waErr(estQ.error) : null;
  const block = sendBlock({ apiEnabled: true, est });
  const say: PreviewSay = (k, values) => t(`preview.${k}`, values ?? {});
  const filled = message.trim() && (kind === "greeting" || title.trim());
  const send = async () => {
    if (!segment) return setProblem(t("send.pickGroup"));
    if (!filled) return setProblem(kind === "notice" ? t("send.write") : t("send.writeMessage"));
    if (!est || block) return;
    if (!(await ask({ kind: "send", title: t("send.sendAsk", { n: f.n(est.reachable) }), body: t("send.sendBody") }))) return;
    setBusy(true);
    setProblem(null);
    try {
      const body = kind === "notice" ? { kind, segment, title: title.trim(), message: message.trim() } : { kind, segment, message: message.trim() };
      const r = await gymWhatsapp.send(ctx.gymId, body, key);
      toast.show(t("send.sent", { n: f.n(r.queuedCount) }));
      setTitle("");
      setMessage("");
      setKey(newKey());
      await qc.invalidateQueries({ queryKey: ["gm-wa-sends", ctx.gymId] });
      // The group sends left today change.
      await qc.invalidateQueries({ queryKey: ["gm-wa-estimate", ctx.gymId] });
    } catch (e) {
      setProblem(waErr(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      <Card className="flex flex-col gap-3" data-testid="wa-send-form">
        <h2 className="font-display text-lg font-bold">{t("send.title")}</h2>
        <div>
          <SegmentedControl
            label={t("send.kind")}
            value={kind}
            onChange={(v) => {
              setKind(v);
              setKey(newKey());
            }}
            options={(["notice", "greeting"] as const).map((k) => ({ value: k, label: t(`send.kinds.${k}`), testId: `wa-send-kind-${k}` }))}
          />
          <p className="mt-1 text-xs text-muted">{t(`send.kindHint.${kind}`)}</p>
        </div>
        <SegmentPicker ctx={ctx} kinds={KINDS} value={seg} onChange={setSeg} idPrefix="wa" testId="wa-segment" />
        {kind === "notice" ? (
          <Field id="wa-title" label={t("send.titleLabel")} value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} hint={t("send.count", { n: f.n(title.length), max: f.n(TITLE_MAX) })} data-testid="wa-title" />
        ) : null}
        <Textarea id="wa-message" label={t("send.message")} value={message} maxLength={MESSAGE_MAX} onChange={(e) => setMessage(e.target.value)} hint={t("send.count", { n: f.n(message.length), max: f.n(MESSAGE_MAX) })} data-testid="wa-message" />
        <EstimateBox est={est} counting={counting} problem={estProblem} />
        {block && block !== "off" ? (
          <div data-testid="wa-send-block" data-reason={block}>
            <Notice tone="warning">{t(`send.block.${block}`)}</Notice>
          </div>
        ) : null}
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
        <Button type="button" className="self-start" icon={<PaperPlaneTilt size={18} aria-hidden />} busy={busy} disabled={!segment || !est || Boolean(block) || !filled} onClick={() => void send()} data-testid="wa-send">
          {t("send.send", { n: f.n(est?.reachable ?? 0) })}
        </Button>
      </Card>
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-bold">{t("send.preview")}</h2>
        <div className="rounded-card bg-surface-2 p-3">
          <p className="max-w-[92%] whitespace-pre-line break-words rounded-control border border-line bg-surface px-3 py-2 text-sm shadow-sm" data-testid="wa-preview">
            {previewText(say, { kind, gym: ctx.gym.name, title, message })}
          </p>
        </div>
      </div>
    </div>
  );
}

function EstimateBox({ est, counting, problem }: { est: Estimate | null; counting: boolean; problem: string | null }) {
  const t = useTranslations("gw");
  const f = useFmt();
  if (problem)
    return (
      <div data-testid="wa-estimate" data-state="problem">
        <Notice tone="warning">{problem}</Notice>
      </div>
    );
  if (!est) return counting ? <p className="text-sm text-muted" data-testid="wa-estimate" data-state="counting">{t("send.estimating")}</p> : null;
  const missing = notReached(est);
  return (
    <div className="rounded-control border border-line p-3 text-sm" data-testid="wa-estimate" data-state="ready">
      <p className="font-semibold" data-testid="wa-reach">
        {t("send.reach", { reachable: f.n(est.reachable), members: f.n(est.members) })}
      </p>
      {missing.length ? (
        <ul className="mt-1 list-disc pl-5 text-muted">
          {missing.map((m) => (
            <li key={m.key}>{t(`send.notReached.${m.key}`, { n: f.n(m.n) })}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-1 text-muted">
        {t("send.units", { needed: f.n(est.unitsNeeded), neededCount: est.unitsNeeded, balance: f.n(est.balance) })} · {t("send.left", { n: f.n(est.bulkLeft) })}
      </p>
    </div>
  );
}

/** The History tab (M24-FR-170): each send with its group size, sent, delivered, read and failed. */
export function WaHistoryTab({ ctx, w }: { ctx: GymCtx; w: GymWhatsapp }) {
  if (featureLocked(ctx.gym.features, "whatsapp")) return <Upsell feature="whatsapp" owner={ctx.owner} />;
  if (!w.apiEnabled) return <Soon testId="wa-history-soon" />;
  return <History ctx={ctx} />;
}

type SendRow = Awaited<ReturnType<typeof gymWhatsapp.sends>>["items"][number];

function History({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gw");
  const f = useFmt();
  const waErr = useWaError();
  const q = useQuery({ queryKey: ["gm-wa-sends", ctx.gymId], queryFn: () => gymWhatsapp.sends(ctx.gymId), retry: false });
  if (q.isError) return <Notice tone="error">{waErr(q.error)}</Notice>;
  const n = (by: (c: ReturnType<typeof sendCounts>) => number) => (s: SendRow) => by(sendCounts(s.status));
  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-bold">{t("history.title")}</h2>
      <DataTable
        label={t("history.title")}
        testId="wa-history"
        rows={q.data?.items}
        rowId={(s) => s.id}
        loading={q.isPending}
        rowTestId="wa-send-row"
        rowProps={(s) => ({ data: { kind: s.kind } })}
        empty={{ title: t("history.none"), icon: <ChatCircleText size={28} aria-hidden /> }}
        columns={[
          { id: "sent", header: t("history.sentCol"), sort: (s) => s.sentAt ?? "", cell: (s) => <span className="whitespace-nowrap text-muted">{s.sentAt ? `${f.date(s.sentAt)} ${f.time(s.sentAt)}` : "–"}</span> },
          { id: "kind", header: t("history.kindCol"), sort: (s) => s.kind, cell: (s) => <Badge tone="neutral">{t(`history.kind.${s.kind}`)}</Badge> },
          {
            id: "message",
            header: t("history.messageCol"),
            primary: true,
            cell: (s) => <span className="line-clamp-2 max-w-md font-semibold">{s.params.title ?? s.params.message ?? "–"}</span>,
          },
          { id: "queued", header: t("history.queuedCol"), align: "end", sort: (s) => s.queuedCount, cell: (s) => t("history.ofTarget", { queued: f.n(s.queuedCount), target: f.n(s.targetCount) }) },
          { id: "delivered", header: t("history.deliveredCol"), align: "end", sort: n((c) => c.delivered), cell: (s) => f.n(n((c) => c.delivered)(s)), total: (rows) => f.n(rows.reduce((a, s) => a + n((c) => c.delivered)(s), 0)) },
          { id: "read", header: t("history.readCol"), align: "end", sort: n((c) => c.read), cell: (s) => f.n(n((c) => c.read)(s)), total: (rows) => f.n(rows.reduce((a, s) => a + n((c) => c.read)(s), 0)) },
          { id: "failed", header: t("history.failedCol"), align: "end", sort: n((c) => c.failed), cell: (s) => f.n(n((c) => c.failed)(s)), total: (rows) => f.n(rows.reduce((a, s) => a + n((c) => c.failed)(s), 0)) },
        ]}
      />
    </div>
  );
}

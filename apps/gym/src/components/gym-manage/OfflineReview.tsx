"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CloudSlash } from "@phosphor-icons/react";
import { Badge, Button, Dialog, EmptyState, Field, Notice, SegmentedControl, Select, Skeleton, Textarea, useToast } from "@kriraghor/ui/kit";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { gymManage } from "@/lib/gym-manage";
import { deskOffline, type ServerOfflineItem } from "@/lib/desk-offline";
import { GymPage, useFmt, useGymError, type GymCtx } from "./common";
import { ReceiptLink } from "./money";

type Action = "checked" | "apply" | "returned";

/**
 * /manage/[gymId]/offline-items (M24-FR-150): what the front desk took without a connection and the server
 * could not simply record. Flagged items were recorded and need a look (mark checked); parked cash was not
 * recorded: put it on another open due of the same member (a receipt now, dated the day it was taken) or
 * record that it went back. The owner and fees.adjust.
 */
export function OfflineReview({ gymId }: { gymId: string }) {
  const t = useTranslations("off.review");
  return (
    <GymPage gymId={gymId} page="offline" title={t("title")} description={t("lead")} testId="gm-offline">
      {(ctx) => <Body ctx={ctx} />}
    </GymPage>
  );
}

function Body({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("off.review");
  const err = useGymError();
  const [state, setState] = useState<"review" | "all">("review");
  const q = useQuery({ queryKey: ["gm-offline", ctx.gymId, state], queryFn: () => deskOffline.list(ctx.gymId, state) });
  const [acting, setActing] = useState<{ item: ServerOfflineItem; action: Action } | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        label={t("title")}
        value={state}
        onChange={(v) => setState(v as "review" | "all")}
        options={[
          { value: "review", label: q.data && state === "review" ? `${t("toCheck")} (${q.data.toCheck})` : t("toCheck") },
          { value: "all", label: t("all") },
        ]}
      />
      {q.isPending ? (
        <Skeleton className="h-48 rounded-card" />
      ) : q.isError ? (
        <Notice tone="error">{err(q.error)}</Notice>
      ) : !q.data.items.length ? (
        <EmptyState icon={<CloudSlash size={28} aria-hidden />} title={state === "review" ? t("empty") : t("emptyAll")} />
      ) : (
        <ul className="flex flex-col gap-2" data-testid="offline-items">
          {q.data.items.map((item) => (
            <ItemRow key={item.id} item={item} ctx={ctx} onAct={(action) => setActing({ item, action })} />
          ))}
        </ul>
      )}
      <ResolveDialog ctx={ctx} acting={acting} onClose={() => setActing(null)} />
    </div>
  );
}

function ItemRow({ item, ctx, onAct }: { item: ServerOfflineItem; ctx: GymCtx; onAct: (a: Action) => void }) {
  const t = useTranslations("off.review");
  const f = useFmt();
  const waiting = item.outcome !== "applied" && !item.resolution;
  const parkedCash = item.outcome === "parked" && item.kind === "cash_fee";
  const name = (w: { displayName: string | null } | null) => w?.displayName ?? t("someone");
  return (
    <li className="rounded-card border border-line bg-surface p-3" data-testid="offline-item" data-outcome={item.outcome}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {item.member.displayName ? (
              <Link href={`/manage/${ctx.gymId}/members/${item.member.id}`} className="hover:underline">
                {item.member.displayName}
              </Link>
            ) : null}{" "}
            <span className="text-xs font-normal text-muted">{item.member.memberCode}</span>
          </p>
          <p className="text-sm text-muted">
            {t(`kind.${item.kind}`)}
            {item.amountPoisha ? ` · ${f.taka(item.amountPoisha)}` : ""} · {f.short(item.takenOn)} {f.time(item.takenAt)}
            {item.slipNo ? ` · ${t("slip", { no: item.slipNo })}` : ""}
          </p>
        </div>
        <Badge tone={item.outcome === "applied" ? "brand" : item.outcome === "flagged" ? "warning" : "danger"}>{t(`outcome.${item.outcome}`)}</Badge>
      </div>
      {item.parkReason || item.flags.length ? (
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {item.parkReason ? <li className="font-semibold text-danger">{t(`park.${item.parkReason}`)}</li> : null}
          {item.flags.map((fl) => (
            <li key={fl} className="text-warning">
              {t(`flag.${fl}`)}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-xs text-muted">
        {[t("takenBy", { name: name(item.takenBy) }), item.recordedAs && item.recordedAs.userId !== item.takenBy?.userId ? t("recordedAs", { name: name(item.recordedAs) }) : null, t("sentBy", { name: name(item.sentBy) })].filter(Boolean).join(" · ")}
      </p>
      {item.receipt ? <ReceiptLink url={item.receipt.url} label={t("receipt", { no: item.receipt.receiptNo })} /> : null}
      {item.resolution ? (
        <p className="mt-2 text-sm font-semibold" data-testid="offline-resolved">
          {t(`resolved.${item.resolution}`, { name: name(item.resolvedBy) })}
          {item.resolutionNote ? <span className="block font-normal text-muted">{item.resolutionNote}</span> : null}
          {item.resolutionReceipt ? <ReceiptLink url={item.resolutionReceipt.url} label={t("receipt", { no: item.resolutionReceipt.receiptNo })} /> : null}
        </p>
      ) : null}
      {waiting ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {parkedCash ? (
            <>
              <Button type="button" size="sm" onClick={() => onAct("apply")} data-testid="offline-apply">
                {t("apply")}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => onAct("returned")} data-testid="offline-returned">
                {t("returned")}
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="secondary" onClick={() => onAct("checked")} data-testid="offline-checked">
              {t("checked")}
            </Button>
          )}
        </div>
      ) : null}
    </li>
  );
}

function ResolveDialog({ ctx, acting, onClose }: { ctx: GymCtx; acting: { item: ServerOfflineItem; action: Action } | null; onClose: () => void }) {
  const t = useTranslations("off.review");
  const tg = useTranslations("gm");
  const f = useFmt();
  const err = useGymError();
  const toast = useToast();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [dueId, setDueId] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const item = acting?.item ?? null;
  const action = acting?.action ?? null;
  const dues = useQuery({
    queryKey: ["gm-offline-dues", ctx.gymId, item?.member.id],
    queryFn: () => gymManage.dues(ctx.gymId, { memberId: item?.member.id }),
    enabled: action === "apply" && Boolean(item),
  });
  const open = (dues.data?.items ?? []).filter((d) => d.id !== item?.dueId && (d.status === "unpaid" || d.status === "partial") && (d.outstandingPoisha ?? 0) >= (item?.amountPoisha ?? 0));
  const chosen = dueId || open[0]?.id || "";
  const close = () => {
    setNote("");
    setDueId("");
    setProblem(null);
    onClose();
  };
  const submit = async () => {
    if (!item || !action) return;
    if (action === "returned" && note.trim().length < 2) return setProblem(t("returnedNote"));
    if (action === "apply" && !chosen) return setProblem(t("noOtherDue", { name: item.member.displayName ?? "" }));
    setBusy(true);
    setProblem(null);
    try {
      await deskOffline.resolve(ctx.gymId, item.id, { action, ...(action === "apply" ? { dueId: chosen } : {}), ...(note.trim() ? { note: note.trim() } : {}) });
      toast.show(tg("saved"));
      await qc.invalidateQueries({ queryKey: ["gm-offline", ctx.gymId] });
      close();
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  // Money moves (19 Nov 2026): putting the cash on another due or recording it went back asks first; "checked" is already a question.
  const resolveAsk = !item || action === "checked" || (action === "returned" && note.trim().length < 2) || (action === "apply" && !chosen) ? undefined : { kind: "money" as const, title: action === "apply" ? t("applyAsk", { amount: f.taka(item.amountPoisha ?? 0), name: item.member.displayName ?? "" }) : t("returnedAsk", { amount: f.taka(item.amountPoisha ?? 0) }), body: action === "apply" ? t("applyBody") : undefined };
  const title = !item ? "" : action === "apply" ? t("applyTitle", { amount: f.taka(item.amountPoisha ?? 0), name: item.member.displayName ?? "" }) : action === "returned" ? t("returnedTitle") : t("checkedTitle");
  return (
    <Dialog
      open={Boolean(acting)}
      onOpenChange={(o) => !o && close()}
      title={title}
      description={action === "apply" ? t("applyBody") : action === "checked" ? t("checkedBody") : undefined}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={close} disabled={busy}>
            {tg("cancel")}
          </Button>
          <Button type="button" onClick={() => void submit()} busy={busy} disabled={action === "apply" && !dues.isPending && !open.length} confirm={resolveAsk} data-testid="offline-resolve">
            {action === "apply" ? t("apply") : action === "returned" ? t("returned") : t("checked")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-testid="offline-resolve-dialog">
        {action === "apply" ? (
          dues.isPending ? (
            <Skeleton className="h-11 rounded-control" />
          ) : open.length ? (
            <Select id="offline-due" label={t("due")} value={chosen} onChange={(e) => setDueId(e.target.value)}>
              {open.map((d) => (
                <option key={d.id} value={d.id}>
                  {`${f.short(d.dueOn)} · ${tg("money.outstanding", { amount: f.taka(d.outstandingPoisha ?? 0) })}`}
                </option>
              ))}
            </Select>
          ) : (
            <Notice tone="warning">{t("noOtherDue", { name: item?.member.displayName ?? "" })}</Notice>
          )
        ) : null}
        {action === "returned" ? (
          <Field id="offline-note" label={t("returnedNote")} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        ) : (
          <Textarea id="offline-note" label={t("note")} optional={tg("optional")} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        )}
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

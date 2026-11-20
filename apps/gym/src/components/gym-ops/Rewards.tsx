"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Gift, Plus, Trash } from "@phosphor-icons/react";
import { Badge, Button, Card, Dialog, EmptyState, Field, IconButton, Notice, Select, SkeletonList, useToast } from "@kriraghor/ui/kit";
import { newKey } from "@kriraghor/ui/format";
import { cn } from "@kriraghor/ui/cn";
import { poishaToTakaText, takaToPoisha } from "@/lib/gym-manage";
import { gymOps2, type Reward } from "@/lib/gym-ops";
import { GymPage, useFmt, useGymError, type GymCtx } from "../gym-manage/common";
import { MemberPick, type PickedMember } from "./parts";

/**
 * /manage/[gymId]/rewards (M27-FR-55 to FR-61; rewards.redeem, the list itself the owner's; Standard plan):
 * find a member, see their points and history, and redeem a reward at the desk (extra days on the running
 * membership, or money off what they owe). The owner keeps the rewards list, adjusts a balance with a note,
 * and records who referred a member.
 */
export function Rewards({ gymId }: { gymId: string }) {
  const t = useTranslations("go");
  return (
    <GymPage gymId={gymId} page="rewards" feature="points" title={t("rewards.title")} description={t("rewards.lead")} testId="go-rewards">
      {(ctx) => <Body ctx={ctx} />}
    </GymPage>
  );
}

function Body({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("go");
  const f = useFmt();
  const [member, setMember] = useState<PickedMember | null>(null);
  const [editing, setEditing] = useState(false);
  const list = useQuery({ queryKey: ["go-rewards", ctx.gymId], queryFn: () => gymOps2.rewards(ctx.gymId) });
  const active = (list.data?.items ?? []).filter((r) => r.status === "active");
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      <div className="flex flex-col gap-3">
        <Card>
          <MemberPick gymId={ctx.gymId} id="rw-member" label={t("rewards.findMember")} value={member} onChange={setMember} />
        </Card>
        {member ? <MemberCard ctx={ctx} member={member} /> : <p className="text-sm text-muted">{t("rewards.pickHint")}</p>}
      </div>
      <Card className="flex flex-col gap-3 self-start" data-testid="rw-list">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">{t("rewards.listTitle")}</h2>
          {ctx.owner ? (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)} data-testid="rw-edit">
              {t("rewards.editList")}
            </Button>
          ) : null}
        </div>
        {list.isPending ? (
          <SkeletonList rows={2} />
        ) : !active.length ? (
          <EmptyState icon={<Gift size={28} aria-hidden />} title={t("rewards.none")} body={ctx.owner ? t("rewards.noneHint") : undefined} />
        ) : (
          <ul className="divide-y divide-line">
            {active.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="font-semibold">{r.title}</span>
                <Badge tone="brand">{t("rewards.pts", { n: f.n(r.points) })}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {editing ? <RewardsDialog ctx={ctx} rewards={list.data?.items ?? []} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}

function MemberCard({ ctx, member }: { ctx: GymCtx; member: PickedMember }) {
  const t = useTranslations("go");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["go-points", ctx.gymId, member.id], queryFn: () => gymOps2.memberPoints(ctx.gymId, member.id) });
  const [key, setKey] = useState(newKey);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [referrer, setReferrer] = useState<PickedMember | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["go-points", ctx.gymId, member.id] });
  const redeem = async (r: Reward) => {
    setBusy(r.id);
    setProblem(null);
    try {
      const out = await gymOps2.redeem(ctx.gymId, member.id, r.id, key);
      const a = out.applied as { kind: "days"; days: number; endsOn: string } | { kind: "discount"; waivedPoisha: number };
      toast.show(a.kind === "days" ? t("rewards.redeemedDays", { days: f.n(a.days), date: f.date(a.endsOn) }) : t("rewards.redeemedOff", { amount: f.taka(a.waivedPoisha) }));
      setKey(newKey());
      refresh();
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(null);
    }
  };
  const saveReferral = async () => {
    if (!referrer) return;
    setBusy("ref");
    setProblem(null);
    try {
      await gymOps2.setReferral(ctx.gymId, member.id, referrer.id);
      toast.show(t("rewards.referralSaved"));
      setReferrer(null);
      refresh();
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(null);
    }
  };
  if (q.isPending) return <SkeletonList rows={3} />;
  if (q.isError) return <Notice tone="error">{err(q.error)}</Notice>;
  const p = q.data;
  return (
    <Card className="flex flex-col gap-3" data-testid="rw-member-card">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-semibold">
            {member.displayName} <span className="text-sm font-normal text-muted">{member.memberCode}</span>
          </p>
          {p.expiringIn30Days ? <p className="text-xs text-warning">{t("rewards.expiringSoon", { n: f.n(p.expiringIn30Days) })}</p> : null}
        </div>
        <p className="text-right">
          <span className="block text-xs font-semibold uppercase tracking-wide text-muted">{t("rewards.balance")}</span>
          <span className="font-display text-3xl font-extrabold tabular-nums" data-testid="rw-balance">
            {f.n(p.balance)}
          </span>
        </p>
      </div>
      {ctx.can("rewards.redeem") ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">{t("rewards.redeem")}</p>
          {!p.rewards.length ? <p className="text-sm text-muted">{t("rewards.none")}</p> : null}
          <ul className="grid gap-2 sm:grid-cols-2">
            {p.rewards.map((r) => (
              <li key={r.id}>
                <Button block variant="secondary" disabled={p.balance < r.points || busy !== null} busy={busy === r.id}
                  confirm={{ kind: "save", title: t("rewards.redeemAsk", { title: r.title, n: f.n(r.points) }), body: t("rewards.redeemBody", { name: member.displayName }), confirmLabel: t("rewards.redeemYes") }}
                  onClick={() => void redeem(r)}
                  data-testid={`rw-redeem-${r.id}`}>
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="truncate">{r.title}</span>
                    <span className="text-xs tabular-nums">{t("rewards.pts", { n: f.n(r.points) })}</span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {problem ? (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      ) : null}
      <div>
        <p className="text-sm font-semibold">{t("rewards.history")}</p>
        {!p.history.length ? <p className="text-sm text-muted">{t("rewards.noHistory")}</p> : null}
        <ul className="mt-1 divide-y divide-line text-sm">
          {p.history.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 py-1.5">
              <span className="text-muted">
                {f.short(e.localDate)} · {t(`rewards.kind.${e.kind}`)}
                {e.note ? ` · ${e.note}` : ""}
              </span>
              <span className={cn("font-semibold tabular-nums", e.points < 0 ? "text-danger" : "text-brand-text")}>
                {e.points > 0 ? "+" : ""}
                {f.n(e.points)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <p className="text-sm font-semibold">{t("rewards.referredBy")}</p>
        {p.referredBy ? (
          <p className="text-sm">
            {p.referredBy.displayName} ({p.referredBy.memberCode}) · <Badge tone={p.referredBy.status === "rewarded" ? "brand" : "neutral"}>{t(`rewards.refStatus.${p.referredBy.status}`)}</Badge>
          </p>
        ) : ctx.can("members.edit") ? (
          <div className="flex flex-col gap-2">
            <MemberPick gymId={ctx.gymId} id="rw-referrer" label={t("rewards.whoReferred")} optional={t("optional")} value={referrer} onChange={setReferrer} />
            <Button size="sm" variant="secondary" className="self-start" disabled={!referrer} busy={busy === "ref"} confirm="save" onClick={() => void saveReferral()}>
              {t("rewards.saveReferral")}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted">{t("rewards.noReferral")}</p>
        )}
      </div>
      {ctx.owner ? (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setAdjusting(true)}>
          {t("rewards.adjust")}
        </Button>
      ) : null}
      {adjusting ? <AdjustDialog ctx={ctx} memberId={member.id} onClose={() => setAdjusting(false)} onDone={refresh} /> : null}
    </Card>
  );
}

function AdjustDialog({ ctx, memberId, onClose, onDone }: { ctx: GymCtx; memberId: string; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("go");
  const err = useGymError();
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const save = async () => {
    const n = Number(points);
    if (!Number.isInteger(n) || n === 0) return setProblem(t("rewards.pointsBad"));
    if (note.trim().length < 3) return setProblem(t("rewards.noteNeeded"));
    setBusy(true);
    try {
      await gymOps2.adjustPoints(ctx.gymId, memberId, n, note.trim());
      onDone();
      onClose();
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={t("rewards.adjust")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void save()} busy={busy} confirm="save">
            {t("save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 px-6 pb-2">
        <Field id="adj-points" label={t("rewards.points")} inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value.replace(/[^\d-]/g, ""))} hint={t("rewards.pointsHint")} autoFocus />
        <Field id="adj-note" label={t("note")} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

type Draft = { id?: string; title: string; points: string; kind: "days" | "discount"; value: string; status: "active" | "retired" };

function RewardsDialog({ ctx, rewards, onClose }: { ctx: GymCtx; rewards: Reward[]; onClose: () => void }) {
  const t = useTranslations("go");
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const [list, setList] = useState<Draft[]>(() =>
    rewards.map((r) => ({ id: r.id, title: r.title, points: String(r.points), kind: r.kind, value: r.kind === "discount" ? poishaToTakaText(r.value) : String(r.value), status: r.status })),
  );
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const set = (i: number, patch: Partial<Draft>) => setList(list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const save = async () => {
    const out = [];
    for (const d of list) {
      if (!d.id && !d.title.trim()) continue;
      const points = Number(d.points);
      const value = d.kind === "discount" ? takaToPoisha(d.value) : Number(d.value);
      if (!d.title.trim() || !Number.isInteger(points) || points < 1 || !value || (d.kind === "days" && (!Number.isInteger(value) || value > 90))) return setProblem(t("rewards.rowBad", { title: d.title || "–" }));
      out.push({ ...(d.id ? { id: d.id } : {}), title: d.title.trim(), points, kind: d.kind, value, status: d.status });
    }
    setBusy(true);
    setProblem(null);
    try {
      await gymOps2.saveRewards(ctx.gymId, out);
      toast.show(t("rewards.saved"));
      void qc.invalidateQueries({ queryKey: ["go-rewards", ctx.gymId] });
      void qc.invalidateQueries({ queryKey: ["go-points", ctx.gymId] });
      onClose();
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={t("rewards.editList")}
      description={t("rewards.editHint")}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void save()} busy={busy} confirm="save" data-testid="rw-save">
            {t("save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 px-6 pb-2">
        {list.map((d, i) => (
          <div key={d.id ?? `n${i}`} className={cn("grid grid-cols-2 items-end gap-2 rounded-control border border-line p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]", d.status === "retired" && "opacity-60")}>
            <Field id={`rw-t-${i}`} label={t("rewards.rewardTitle")} value={d.title} maxLength={80} onChange={(e) => set(i, { title: e.target.value })} className="col-span-2 sm:col-span-1" />
            <Field id={`rw-p-${i}`} label={t("rewards.points")} inputMode="numeric" value={d.points} onChange={(e) => set(i, { points: e.target.value.replace(/\D/g, "") })} />
            <Select id={`rw-k-${i}`} label={t("rewards.kindLabel")} value={d.kind} onChange={(e) => set(i, { kind: e.target.value as Draft["kind"], value: "" })}>
              <option value="days">{t("rewards.kindDays")}</option>
              <option value="discount">{t("rewards.kindDiscount")}</option>
            </Select>
            <Field id={`rw-v-${i}`} label={d.kind === "days" ? t("rewards.days") : t("rewards.taka")} inputMode="decimal" leading={d.kind === "discount" ? "৳" : undefined} value={d.value} onChange={(e) => set(i, { value: e.target.value })} />
            <IconButton label={d.status === "active" ? t("rewards.retire") : t("rewards.restore")} variant="ghost" onClick={() => (d.id ? set(i, { status: d.status === "active" ? "retired" : "active" }) : setList(list.filter((_, j) => j !== i)))}>
              <Trash size={18} aria-hidden />
            </IconButton>
          </div>
        ))}
        <Button variant="secondary" size="sm" className="self-start" onClick={() => setList([...list, { title: "", points: "", kind: "days", value: "", status: "active" }])} data-testid="rw-add">
          <Plus size={16} aria-hidden />
          {t("rewards.addReward")}
        </Button>
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

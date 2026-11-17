"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { CloudSlash, Printer, Receipt as ReceiptIcon, WarningCircle } from "@phosphor-icons/react";
import { Avatar, Badge, Button, Dialog, Field, Notice, useToast } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import * as db from "@/lib/desk-db";
import { dhakaToday, takaToPoisha, poishaToTakaText } from "@/lib/gym-manage";
import { dueLeft, offlineEntry, waitingCounts, type CopyDue, type CopyMember, type WaitingItem } from "@/lib/desk-offline";
import { useFmt } from "@/components/gym-manage/common";
import { sendWaiting, useOffline, useWaiting } from "./useOffline";

/** How often the device tries to send what waits while it has items (and at once when the browser says it is online). */
const RETRY_MS = 30_000;

/**
 * The bar above every page of a gym while this device works offline or has items waiting (M24 §22): what is
 * waiting, Send now, and the items the server refused (kept until someone removes them). It also sends by
 * itself: when the connection comes back and every 30 seconds while something waits.
 */
export function OfflineBanner({ gymId, perms }: { gymId: string; perms: readonly string[] | null }) {
  const t = useTranslations("off.banner");
  const toast = useToast();
  const qc = useQueryClient();
  const offline = useOffline();
  const items = useWaiting(gymId);
  const counts = waitingCounts(items);
  const [busy, setBusy] = useState(false);
  const [stopped, setStopped] = useState<"network" | "blocked" | null>(null);
  const [memoryOnly, setMemoryOnly] = useState(false);
  const [removing, setRemoving] = useState<WaitingItem | null>(null);
  const live = counts.checkins + counts.payments;
  const canReview = perms === null || perms.includes("fees.adjust");

  const send = async (quiet: boolean) => {
    setBusy(true);
    try {
      const r = await sendWaiting(gymId, perms);
      setStopped(r.stopped);
      if (r.sent.length) {
        const toCheck = r.sent.filter((x) => x.outcome !== "applied").length;
        toast.show([t("sent", { n: r.sent.length }), toCheck && canReview ? t("toCheck", { n: toCheck }) : ""].filter(Boolean).join(" "));
        void qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && q.queryKey[0] !== "desk-mode" });
      } else if (!quiet && r.stopped === "network") toast.show(t("offlineTitle"), "error");
    } finally {
      setBusy(false);
    }
  };

  // Send by itself: now, when the browser comes back online, and every RETRY_MS while something waits.
  const permsKey = perms === null ? "*" : perms.join(",");
  useEffect(() => {
    if (!live) return;
    const as = permsKey === "*" ? null : permsKey ? permsKey.split(",") : [];
    void db.inMemoryOnly().then(setMemoryOnly);
    const go = () => void sendWaiting(gymId, as).then((r) => {
      setStopped(r.stopped);
      if (r.sent.length) void qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && q.queryKey[0] !== "desk-mode" });
    });
    go();
    const id = window.setInterval(go, RETRY_MS);
    window.addEventListener("online", go);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("online", go);
    };
  }, [gymId, permsKey, live, qc]);

  if (!offline && !items.length) return null;
  const problems = items.filter((i) => i.problem);
  return (
    <div className="mx-auto mb-4 flex w-full max-w-[1100px] flex-col gap-2 px-4 pt-4 sm:px-6" data-testid="offline-banner">
      {offline ? (
        <Notice tone="warning" title={t("offlineTitle")}>
          {t("offlineBody")}
        </Notice>
      ) : null}
      {live ? (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-3" data-testid="offline-waiting">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t("waitingTitle")}</p>
            <p className="text-sm text-muted">{[counts.checkins ? t("checkins", { n: counts.checkins }) : null, counts.payments ? t("payments", { n: counts.payments }) : null].filter(Boolean).join(" · ")}</p>
            {stopped === "blocked" ? <p className="mt-1 text-xs text-muted">{t("blocked")}</p> : null}
            {memoryOnly ? <p className="mt-1 text-xs font-semibold text-warning">{t("memoryOnly")}</p> : null}
          </div>
          <Button type="button" size="sm" onClick={() => void send(false)} busy={busy} data-testid="offline-send">
            {t("sendNow")}
          </Button>
        </div>
      ) : null}
      {problems.length ? (
        <div className="rounded-card border border-danger/40 bg-danger-soft p-3" data-testid="offline-refused">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-danger">
            <WarningCircle size={18} weight="bold" aria-hidden />
            {t("refusedTitle")}
          </p>
          <p className="text-sm">{t("refusedBody")}</p>
          <ul className="mt-2 divide-y divide-line">
            {problems.map((p) => (
              <li key={p.body.clientId} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{p.member.displayName}</span> <span className="text-xs text-muted">{p.member.memberCode}</span>
                  <span className="block text-xs text-muted">{p.problem}</span>
                </span>
                <Button type="button" size="sm" variant="secondary" onClick={() => setRemoving(p)}>
                  {t("remove")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Dialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t("removeTitle")}
        description={t("removeBody")}
        footer={
          <Button type="button" variant="danger" onClick={() => removing && void db.remove(removing.body.clientId).then(() => setRemoving(null))} data-testid="offline-remove">
            {t("remove")}
          </Button>
        }
      >
        {removing ? <p className="text-sm font-semibold">{removing.member.displayName}</p> : null}
      </Dialog>
    </div>
  );
}

/** A member found in the desk copy without a connection: the package, today's decision, check in, take cash. */
export function OfflineMemberCard({
  member,
  dues,
  waiting,
  canCollect,
  busy,
  onCheckIn,
  onCash,
}: {
  member: CopyMember;
  dues: readonly CopyDue[];
  waiting: readonly WaitingItem[];
  canCollect: boolean;
  busy: boolean;
  onCheckIn: () => void;
  onCash: (due: CopyDue) => void;
}) {
  const t = useTranslations("off.member");
  const tg = useTranslations("gm");
  const f = useFmt();
  const entry = offlineEntry(member);
  const inToday = member.inToday || waiting.some((w) => w.body.kind === "checkin" && w.body.memberId === member.id);
  const tone = entry === "blocked" ? "border-danger bg-danger-soft" : entry === "checkInWarn" ? "border-warning bg-warning-soft" : "border-brand bg-brand/10";
  return (
    <div className={cn("rounded-card border p-3", tone)} data-testid="offline-member" data-decision={member.decision}>
      <div className="flex items-start gap-3">
        <Avatar name={member.displayName} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-extrabold">{member.displayName}</p>
          <p className="text-xs text-muted tabular-nums">
            {member.memberCode}
            {member.phoneLast4 ? ` · ••${member.phoneLast4}` : ""}
          </p>
          <p className="mt-1 text-sm">{member.package ? `${member.package.title} · ${f.short(member.package.endsOn)}` : tg("desk.noPackage")}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge tone="neutral" icon={<CloudSlash size={12} aria-hidden />}>
              {t("copy")}
            </Badge>
            {member.flags.map((fl) => (
              <Badge key={fl} tone={fl === "expiring" ? "warning" : fl === "frozen" ? "info" : "danger"}>
                {tg(`deskFlag.${fl}`)}
              </Badge>
            ))}
            {inToday ? <Badge tone="info">{t("inToday")}</Badge> : null}
          </div>
        </div>
      </div>
      <p className={cn("mt-2 text-sm font-bold", entry === "blocked" ? "text-danger" : entry === "checkInWarn" ? "text-warning" : "text-brand-text")} data-testid="offline-decision">
        {tg(`decision.${member.decision}`)}
        {member.reasons.length ? `: ${member.reasons.map((r) => tg(`reason.${r}`)).join(" · ")}` : ""}
      </p>
      {entry === "blocked" ? (
        <p className="mt-2 text-sm text-muted">{t("blocked")}</p>
      ) : (
        <Button type="button" block size="lg" className="mt-2" busy={busy} onClick={onCheckIn} data-testid="offline-checkin">
          {entry === "checkInWarn" ? tg("desk.checkInAnyway") : tg("desk.checkIn")}
        </Button>
      )}
      {canCollect
        ? dues.map((d) => {
            const left = dueLeft(d, waiting);
            return left > 0 ? (
              <Button key={d.id} type="button" block variant="secondary" className="mt-2" onClick={() => onCash(d)} data-testid="offline-take-cash">
                {t("takeCash", { amount: f.taka(left) })}
              </Button>
            ) : null;
          })
        : null}
    </div>
  );
}

/** The answer to an offline check-in: saved here, sent later. */
export function OfflineCheckedIn({ item }: { item: WaitingItem }) {
  const t = useTranslations("off.checkedIn");
  const f = useFmt();
  return (
    <div className="rounded-card border-4 border-brand bg-brand/10 p-4" data-testid="offline-checked-in">
      <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide">
        <CloudSlash size={16} weight="bold" aria-hidden />
        {t("title")}
      </p>
      <p className="mt-1 text-2xl font-extrabold">{item.member.displayName}</p>
      <p className="text-sm text-muted tabular-nums">
        {item.member.memberCode} · {f.time(item.takenAtIso)}
      </p>
      <p className="mt-1 text-sm">{t("body")}</p>
    </div>
  );
}

/** Cash for one due without a connection (M24-FR-148): up to what is still owed, cash only. */
export function OfflineCashDialog({ open, onOpenChange, member, due, left, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; member: { displayName: string } | null; due: CopyDue | null; left: number; onSave: (amountPoisha: number) => void }) {
  const t = useTranslations("off.cash");
  const tg = useTranslations("gm");
  const f = useFmt();
  const [taka, setTaka] = useState("");
  const [error, setError] = useState<string>();
  const close = (o: boolean) => {
    if (!o) {
      setTaka("");
      setError(undefined);
    }
    onOpenChange(o);
  };
  const shown = taka || (open ? poishaToTakaText(left) : "");
  const submit = () => {
    const amount = takaToPoisha(shown);
    if (amount === null || amount < 100) return setError(tg("money.badAmount"));
    if (amount > left) return setError(t("tooMuch", { amount: f.taka(left) }));
    onSave(amount);
    close(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={t("title", { name: member?.displayName ?? "" })}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => close(false)}>
            {tg("cancel")}
          </Button>
          <Button type="button" onClick={submit} data-testid="offline-cash-save">
            {t("save")}
          </Button>
        </>
      }
    >
      {due ? (
        <div className="flex flex-col gap-3" data-testid="offline-cash-dialog">
          <p className="text-sm">
            {t("due", { title: due.title ?? "", date: f.short(due.dueOn) })} · {t("left", { amount: f.taka(left) })}
          </p>
          <Field id="offline-cash-amount" label={t("amount")} inputMode="decimal" value={shown} onChange={(e) => setTaka(e.target.value)} error={error} leading={<span className="text-muted">৳</span>} data-testid="offline-cash-amount" />
          <Notice tone="info">{t("note")}</Notice>
        </div>
      ) : null}
    </Dialog>
  );
}

/** The temporary slip for cash taken offline: its number, who, how much, for what, by whom, when. Printable. */
export function OfflineSlip({ item, className }: { item: WaitingItem; className?: string }) {
  const t = useTranslations("off.slip");
  const f = useFmt();
  const row = (label: string, value: string, mono = false) => (
    <div className="flex justify-between gap-3 py-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className={cn("text-right font-semibold", mono && "font-mono")}>{value}</dd>
    </div>
  );
  return (
    <div className={cn("rounded-card border-2 border-dashed border-ink/40 bg-surface p-4", className)} data-testid="offline-slip">
      <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide">
        <ReceiptIcon size={18} aria-hidden />
        {t("title")}
      </p>
      <p className="mt-2 font-mono text-3xl font-extrabold tracking-wider" data-testid="offline-slip-no">
        {item.body.slipNo}
      </p>
      <dl className="mt-3 divide-y divide-line text-sm">
        {row(t("member"), `${item.member.displayName} · ${item.member.memberCode}`)}
        {row(t("amount"), f.taka(item.body.amountPoisha ?? 0))}
        {item.dueTitle ? row(t("for"), item.dueTitle) : null}
        {item.takenByName ? row(t("takenBy"), item.takenByName) : null}
        {row(t("at"), `${f.short(dhakaToday(new Date(item.takenAtIso)))} ${f.time(item.takenAtIso)}`)}
      </dl>
      <p className="mt-3 text-sm">{t("body")}</p>
      <Button type="button" variant="secondary" size="sm" className="no-print mt-3" onClick={() => window.print()}>
        <Printer size={16} aria-hidden />
        {t("print")}
      </Button>
    </div>
  );
}

/** For the cash page: offline items still on this device (the day cannot be closed while any wait). */
export function useWaitingCount(gymId: string) {
  const c = waitingCounts(useWaiting(gymId));
  return c.checkins + c.payments;
}

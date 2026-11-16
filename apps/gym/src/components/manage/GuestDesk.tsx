"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Phone, UserPlus, WhatsappLogo } from "@phosphor-icons/react";
import { realtimeSocket } from "@kriraghor/api-client/notifications";
import { useAuth } from "@kriraghor/ui/auth";
import { useRouter } from "@kriraghor/ui/i18n/navigation";
import { Avatar, Badge, Button, IconButton, Notice, ReasonDialog, useToast } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { gymVisits, type GymVisit } from "@/lib/gym-visits";
import { telUrl, whatsappUrl } from "@/lib/gym-ops";
import { useFmt, useGymError, type GymCtx } from "@/components/gym-manage/common";

const TONE: Record<GymVisit["status"], "brand" | "info" | "neutral" | "warning"> = { booked: "brand", attended: "info", cancelled: "neutral", no_show: "warning" };

/** Re-read the guest list when any desk of this gym checks a guest in (Socket.IO `gym.desk_guest`). */
function useGuestFeed(gymId: string) {
  const qc = useQueryClient();
  const { status } = useAuth();
  useEffect(() => {
    if (status !== "signed_in") return;
    const socket = realtimeSocket("api");
    const on = (e: { gymId?: string }) => {
      if (e.gymId !== gymId) return;
      void qc.invalidateQueries({ queryKey: ["gm-visits", gymId] });
      void qc.invalidateQueries({ queryKey: ["gm-overview", gymId] });
    };
    socket.on("gym.desk_guest", on);
    return () => {
      socket.off("gym.desk_guest", on);
    };
  }, [status, gymId, qc]);
}

/** The actions on one guest, shared by the card and the list. */
function useGuestActions(ctx: GymCtx) {
  const t = useTranslations("gv");
  const err = useGymError();
  const toast = useToast();
  const qc = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["gm-visits", ctx.gymId] });
    await qc.invalidateQueries({ queryKey: ["gm-overview", ctx.gymId] });
  };
  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try {
      const r = await fn();
      if (ok) toast.show(ok, "success");
      await refresh();
      return r;
    } catch (e) {
      toast.show(err(e), "error");
      return null;
    } finally {
      setBusy(null);
    }
  };
  return {
    busy,
    checkIn: (v: GymVisit) => run(`in:${v.id}`, () => gymVisits.checkIn(ctx.gymId, v.id), t("desk.checkedIn", { name: v.guest.name ?? t("desk.guest") })) as Promise<{ visit: GymVisit } | null>,
    cancel: (v: GymVisit, reason: string) => run(`cancel:${v.id}`, () => gymVisits.cancel(ctx.gymId, v.id, reason), t("desk.cancelled")),
    convert: async (v: GymVisit) => {
      const r = (await run(`member:${v.id}`, () => gymVisits.convert(ctx.gymId, v.id), t("desk.madeMember"))) as { member: { id: string } } | null;
      if (r?.member?.id) router.push(`/manage/${ctx.gymId}/members/${r.member.id}`);
      return r?.member?.id ?? null;
    },
    // The number comes from the audited reveal at the moment of the tap (M24-FR-116), never kept on the page.
    reach: async (v: GymVisit, how: "call" | "whatsapp") => {
      setBusy(`${how}:${v.id}`);
      try {
        const { phone } = await gymVisits.revealPhone(ctx.gymId, v.id);
        if (how === "call") return window.location.assign(telUrl(phone));
        const url = whatsappUrl(phone, t("desk.waMessage", { name: (v.guest.name ?? "").split(" ")[0], gym: ctx.gym.name }));
        if (!url) return toast.show(t("desk.noWhatsapp"), "error");
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (e) {
        toast.show(err(e), "error");
      } finally {
        setBusy(null);
      }
    },
  };
}

type Actions = ReturnType<typeof useGuestActions>;

function GuestButtons({ v, ctx, a, isToday, onCancel, size = "sm" }: { v: GymVisit; ctx: GymCtx; a: Actions; isToday: boolean; onCancel: (v: GymVisit) => void; size?: "sm" | "lg" }) {
  const t = useTranslations("gv");
  const canDesk = ctx.can("attendance.mark");
  const canCall = ctx.can("members.view");
  const canMember = ctx.can("members.edit");
  return (
    <div className={cn("flex flex-wrap items-center gap-2", size === "lg" && "mt-3")}>
      {v.status === "booked" && isToday && canDesk ? (
        <Button type="button" size={size} busy={a.busy === `in:${v.id}`} onClick={() => void a.checkIn(v)} block={size === "lg"} data-testid="guest-checkin">
          {t("desk.checkIn")}
        </Button>
      ) : null}
      {v.status === "attended" && !v.memberId && canMember ? (
        <Button type="button" size={size} variant={size === "lg" ? "primary" : "secondary"} icon={<UserPlus size={18} aria-hidden />} busy={a.busy === `member:${v.id}`} onClick={() => void a.convert(v)} data-testid="guest-make-member">
          {t("desk.makeMember")}
        </Button>
      ) : null}
      {v.memberId ? <Badge tone="brand">{t("desk.isMember")}</Badge> : null}
      {canCall ? (
        <span className="flex gap-1">
          <IconButton variant="secondary" label={t("desk.call", { name: v.guest.name ?? t("desk.guest") })} onClick={() => void a.reach(v, "call")} disabled={a.busy !== null} data-testid="guest-call">
            <Phone size={18} aria-hidden className={cn(a.busy === `call:${v.id}` && "animate-pulse")} />
          </IconButton>
          <IconButton variant="secondary" label={t("desk.whatsapp", { name: v.guest.name ?? t("desk.guest") })} onClick={() => void a.reach(v, "whatsapp")} disabled={a.busy !== null} data-testid="guest-wa">
            <WhatsappLogo size={18} aria-hidden className={cn(a.busy === `whatsapp:${v.id}` && "animate-pulse")} />
          </IconButton>
        </span>
      ) : null}
      {v.status === "booked" && canDesk ? (
        <Button type="button" size="sm" variant="ghost" onClick={() => onCancel(v)} data-testid="guest-cancel">
          {t("desk.cancel")}
        </Button>
      ) : null}
    </div>
  );
}

function CancelGuest({ a, v, onClose }: { a: Actions; v: GymVisit | null; onClose: () => void }) {
  const t = useTranslations("gv");
  return (
    <ReasonDialog
      open={Boolean(v)}
      onOpenChange={(o) => !o && onClose()}
      title={t("desk.cancelTitle", { name: v?.guest.name ?? t("desk.guest") })}
      description={t("desk.cancelBody")}
      confirmLabel={t("desk.cancelConfirm")}
      danger
      minLength={3}
      maxLength={300}
      busy={Boolean(v && a.busy === `cancel:${v.id}`)}
      testId="guest-cancel-dialog"
      onConfirm={async (reason) => {
        if (v && (await a.cancel(v, reason)) !== null) onClose();
      }}
    />
  );
}

/**
 * A guest found at the desk by their QR or code (M24-FR-114): who, when, and **Check in guest**; after the
 * visit **Make member** (members.edit), and Call or WhatsApp through the audited reveal (members.view).
 */
export function GuestCard({ ctx, visit, today, onChanged }: { ctx: GymCtx; visit: GymVisit; today: string; onChanged?: (v: GymVisit) => void }) {
  const t = useTranslations("gv");
  const f = useFmt();
  const a = useGuestActions(ctx);
  const [v, setV] = useState(visit);
  const [cancelling, setCancelling] = useState<GymVisit | null>(null);
  const isToday = v.date === today;
  const actions: Actions = {
    ...a,
    checkIn: async (x) => {
      const r = await a.checkIn(x);
      if (r?.visit) {
        setV(r.visit);
        onChanged?.(r.visit);
      }
      return r;
    },
    // Make member: the card shows "Member" at once, while the member's page opens.
    convert: async (x) => {
      const memberId = await a.convert(x);
      if (memberId) setV({ ...x, memberId });
      return memberId;
    },
  };
  return (
    <div className={cn("rounded-card border p-3", v.status === "booked" && isToday ? "border-brand bg-brand/10" : v.status === "attended" ? "border-info bg-info-soft" : "border-line")} data-testid="desk-guest" data-status={v.status}>
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{t("desk.guestTitle")}</p>
      <div className="mt-1 flex items-start gap-3">
        <Avatar name={v.guest.name ?? "?"} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-extrabold">{v.guest.name ?? t("desk.guest")}</p>
          <p className="text-xs text-muted tabular-nums">{v.guest.phoneLast4 ? `••${v.guest.phoneLast4}` : ""}</p>
          <p className="mt-1 text-sm">{isToday ? t("desk.todayAt", { time: v.arriveAt }) : t("desk.onDayAt", { date: f.short(v.date), time: v.arriveAt })}</p>
        </div>
        <Badge tone={TONE[v.status]}>{t(`status.${v.status}`)}</Badge>
      </div>
      {v.status === "booked" && !isToday ? <p className="mt-2 text-sm font-semibold text-warning">{t("desk.notToday")}</p> : null}
      {v.status === "attended" ? <p className="mt-2 text-sm font-semibold text-brand-text">{t("desk.inAt", { time: f.time(v.attendedAt) })}</p> : null}
      <GuestButtons v={v} ctx={ctx} a={actions} isToday={isToday} onCancel={setCancelling} size="lg" />
      <CancelGuest a={a} v={cancelling} onClose={() => setCancelling(null)} />
    </div>
  );
}

/**
 * The desk's **Guests** for a day (M24-FR-113; today by default): free trial visits by time, with check-in,
 * cancel, Make member and the call buttons. Shown when the plan has visits.
 */
export function GuestsList({ ctx, date, today }: { ctx: GymCtx; date: string; today: string }) {
  const t = useTranslations("gv");
  const f = useFmt();
  const err = useGymError();
  const a = useGuestActions(ctx);
  const [cancelling, setCancelling] = useState<GymVisit | null>(null);
  const isToday = date === today;
  useGuestFeed(ctx.gymId);
  const q = useQuery({ queryKey: ["gm-visits", ctx.gymId, date], queryFn: () => gymVisits.list(ctx.gymId, isToday ? {} : { date }), refetchInterval: isToday ? 60_000 : false });
  const items = q.data?.items ?? [];
  return (
    <div data-testid="desk-guests">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{isToday ? t("desk.todayList", { n: f.n(q.data ? q.data.counts.booked + q.data.counts.attended : 0) }) : t("desk.dayList", { n: f.n(items.length) })}</h3>
        {q.data && !q.data.open ? <Badge>{t("desk.off")}</Badge> : null}
      </div>
      {q.isError ? <Notice tone="error">{err(q.error)}</Notice> : null}
      {q.data && !items.length ? <p className="mt-2 text-sm text-muted">{q.data.open ? t("desk.none") : t("desk.noneOff")}</p> : null}
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {items.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-2 py-2 text-sm" data-testid="desk-guest-row" data-status={v.status}>
            <span className="w-14 font-bold tabular-nums">{v.arriveAt}</span>
            <span className="min-w-0 flex-1 truncate font-semibold">
              {v.guest.name ?? t("desk.guest")} {v.guest.phoneLast4 ? <span className="text-xs font-normal text-muted">••{v.guest.phoneLast4}</span> : null}
            </span>
            <Badge tone={TONE[v.status]}>{v.status === "cancelled" && v.cancelledBy === "guest" ? t("status.cancelledByGuest") : t(`status.${v.status}`)}</Badge>
            <GuestButtons v={v} ctx={ctx} a={a} isToday={isToday} onCancel={setCancelling} />
          </li>
        ))}
      </ul>
      <CancelGuest a={a} v={cancelling} onClose={() => setCancelling(null)} />
    </div>
  );
}

"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { SignIn, SignOut } from "@phosphor-icons/react";
import { realtimeSocket } from "@kriraghor/api-client/notifications";
import { useAuth } from "@kriraghor/ui/auth";
import { Avatar, Badge } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { useFmt } from "../gym-manage/common";

/** One live desk event (M27-FR-44), as the API pushes it to the owner and staff with attendance.mark. */
export type DeskEvent = {
  gymId: string;
  kind: "in" | "out";
  attendanceId: string;
  at: string;
  member: { id: string; memberCode: string; displayName: string; photoUrl?: string | null };
  decision: "allow" | "warn" | null;
  reasons: string[];
  counted: boolean | null;
  visitMinutes: number | null;
  inGymNow: number;
};

/**
 * The live desk feed of one gym: every check-in and check-out as it happens (Socket.IO, the user's own room),
 * newest first, at most `keep`. The day's list and the count are re-read on each event and on reconnect.
 */
export function useDeskFeed(gymId: string, keep = 6) {
  const qc = useQueryClient();
  const { status } = useAuth();
  const [events, setEvents] = useState<DeskEvent[]>([]);
  const [inGymNow, setInGymNow] = useState<number | null>(null);
  const onFeed = useEffectEvent((e: DeskEvent) => {
    if (e.gymId !== gymId) return;
    setEvents((list) => [e, ...list.filter((x) => !(x.attendanceId === e.attendanceId && x.kind === e.kind))].slice(0, keep));
    setInGymNow(e.inGymNow);
    void qc.invalidateQueries({ queryKey: ["gm-checkins", gymId] });
    void qc.invalidateQueries({ queryKey: ["gm-overview", gymId] });
  });
  const onConnect = useEffectEvent(() => void qc.invalidateQueries({ queryKey: ["gm-checkins", gymId] }));
  useEffect(() => {
    if (status !== "signed_in") return;
    const socket = realtimeSocket("api");
    const feed = (e: DeskEvent) => onFeed(e);
    const connect = () => onConnect();
    socket.on("gym.desk_feed", feed);
    socket.on("connect", connect);
    return () => {
      socket.off("gym.desk_feed", feed);
      socket.off("connect", connect);
    };
  }, [status]);
  return { events, inGymNow };
}

/** Visit length as "1 h 25 min" / "৪০ মিনিট". */
export function useDuration() {
  const t = useTranslations("go");
  const f = useFmt();
  return (minutes: number | null | undefined) => {
    if (minutes == null) return "";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h ? t("desk.hm", { h: f.n(h), m: f.n(m) }) : t("desk.m", { m: f.n(m) });
  };
}

/** The live strip at the top of the desk: the last few comings and goings with the member's photo. */
export function LiveStrip({ events }: { events: DeskEvent[] }) {
  const t = useTranslations("go");
  const f = useFmt();
  const dur = useDuration();
  if (!events.length) return <p className="text-sm text-muted">{t("desk.liveEmpty")}</p>;
  return (
    <ul className="flex flex-col gap-2" aria-live="polite" data-testid="desk-live">
      {events.map((e, i) => (
        <li
          key={`${e.attendanceId}-${e.kind}`}
          className={cn(
            "flex items-center gap-3 rounded-control border px-3 py-2 transition-opacity",
            e.kind === "in" ? (e.decision === "warn" ? "border-warning/50 bg-warning-soft" : "border-brand/40 bg-brand-soft") : "border-line bg-surface-2",
            i > 2 && "opacity-70",
          )}
        >
          <Avatar name={e.member.displayName} src={e.member.photoUrl ?? null} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{e.member.displayName}</p>
            <p className="text-xs text-muted">
              {e.member.memberCode} · {f.time(e.at)}
              {e.kind === "out" && e.visitMinutes != null ? ` · ${dur(e.visitMinutes)}` : ""}
            </p>
          </div>
          {e.kind === "in" ? (
            <Badge tone={e.decision === "warn" ? "warning" : "brand"}>
              <SignIn size={14} aria-hidden /> {e.counted === false ? t("desk.again") : t("desk.in")}
            </Badge>
          ) : (
            <Badge tone="neutral">
              <SignOut size={14} aria-hidden /> {t("desk.out")}
            </Badge>
          )}
        </li>
      ))}
    </ul>
  );
}

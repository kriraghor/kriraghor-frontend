"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CalendarBlank, Gift } from "@phosphor-icons/react";
import { useAuth } from "@kriraghor/ui/auth";
import { SignedOutCard } from "@kriraghor/ui/account";
import { usePathname, useRouter } from "@kriraghor/ui/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Badge, Button, Card, EmptyState, Notice, SegmentedControl, SkeletonList, useToast } from "@kriraghor/ui/kit";
import { newKey } from "@kriraghor/ui/format";
import { cn } from "@kriraghor/ui/cn";
import { gymMe } from "@/lib/gym-manage";
import { byDay, dhakaTime, gymOps2 } from "@/lib/gym-ops";
import { useFmt, useGymError } from "@/components/gym-manage/common";

/**
 * /me/classes (M27-FR-48 to FR-50): the class timetable of my gym for two weeks; book a place (or the waitlist
 * when it is full) and cancel up to the cutoff. One gym at a time when I am a member of several (?m=).
 */
export function MyClasses() {
  const t = useTranslations("go");
  const { status } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const list = useQuery({ queryKey: ["my-gym-memberships"], queryFn: () => gymMe.memberships(), enabled: status === "signed_in" });
  if (status === "signed_out") return <SignedOutCard signInHref="/sign-in?next=%2Fme%2Fclasses" />;
  const linked = (list.data?.items ?? []).filter((m) => m.linked && !["removed", "left"].includes(m.status));
  const chosen = linked.find((m) => m.memberId === params.get("m")) ?? linked[0];
  return (
    <section className="mx-auto w-full max-w-[900px] px-4 py-6 sm:px-6" data-testid="me-classes">
      <h1 className="font-display text-3xl font-extrabold">{t("my.classesTitle")}</h1>
      <p className="mt-1 text-sm text-muted">{t("my.classesLead")}</p>
      {list.isPending ? (
        <SkeletonList className="mt-4" rows={4} />
      ) : !chosen ? (
        <EmptyState className="mt-4" icon={<CalendarBlank size={28} aria-hidden />} title={t("my.noGym")} />
      ) : (
        <>
          {linked.length > 1 ? (
            <SegmentedControl className="mt-4" label={t("my.chooseGym")} value={chosen.memberId} onChange={(v) => router.replace(`${pathname}?m=${v}`, { scroll: false })} options={linked.map((m) => ({ value: m.memberId, label: m.gym?.name ?? m.memberCode }))} />
          ) : null}
          <Timetable key={chosen.memberId} memberId={chosen.memberId} />
        </>
      )}
    </section>
  );
}

function Timetable({ memberId }: { memberId: string }) {
  const t = useTranslations("go");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["my-classes", memberId], queryFn: () => gymOps2.myTimetable(memberId) });
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const act = async (id: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(id);
    setProblem(null);
    try {
      await fn();
      toast.show(done);
      void qc.invalidateQueries({ queryKey: ["my-classes", memberId] });
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(null);
    }
  };
  if (q.isPending) return <SkeletonList className="mt-4" rows={4} />;
  if (q.isError) return <Notice tone="error">{err(q.error)}</Notice>;
  const days = byDay(q.data.items.filter((s) => s.status !== "done"));
  if (!days.length) return <EmptyState className="mt-4" icon={<CalendarBlank size={28} aria-hidden />} title={t("my.noClasses")} />;
  return (
    <div className="mt-4 flex flex-col gap-3">
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      {days.map((d) => (
        <Card key={d.date} padded={false}>
          <p className="border-b border-line px-4 py-2 text-sm font-bold">{f.date(d.date)}</p>
          <ul className="divide-y divide-line">
            {d.items.map((s) => {
              const mine = s.myBooking;
              const cancelled = s.status === "cancelled";
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="w-12 font-bold tabular-nums">{dhakaTime(s.startsAt)}</span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block font-semibold", cancelled && "line-through opacity-60")}>{s.name}</span>
                    <span className="block text-xs text-muted">
                      {[s.trainer?.displayName, s.room].filter(Boolean).join(" · ")}
                      {!cancelled ? ` · ${s.spaces ? t("my.spaces", { n: f.n(s.spaces) }) : t("my.full")}` : ""}
                    </span>
                  </span>
                  {cancelled ? (
                    <Badge tone="danger">{t("classes.cancelled")}</Badge>
                  ) : mine ? (
                    <span className="flex items-center gap-2">
                      <Badge tone={mine.status === "booked" ? "brand" : "warning"}>{mine.status === "booked" ? t("my.booked") : t("my.waiting")}</Badge>
                      <Button size="sm" variant="ghost" busy={busy === s.id} onClick={() => void act(s.id, () => gymOps2.myCancel(mine.id), t("my.cancelled"))} data-testid={`my-cancel-${s.id}`}>
                        {t("my.cancel")}
                      </Button>
                    </span>
                  ) : (
                    <Button size="sm" busy={busy === s.id} onClick={() => void act(s.id, () => gymOps2.myBook(s.id, memberId, newKey()), s.spaces ? t("my.bookedToast") : t("my.waitingToast"))} data-testid={`my-book-${s.id}`}>
                      {s.spaces ? t("my.book") : t("my.joinWaitlist")}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}

/** My points at this gym (M27-FR-59), on my membership page: balance, how to earn, the rewards to ask for at the desk. */
export function MyPointsCard({ memberId }: { memberId: string }) {
  const t = useTranslations("go");
  const f = useFmt();
  const q = useQuery({ queryKey: ["my-points", memberId], queryFn: () => gymOps2.myPoints(memberId) });
  if (!q.data?.on) return null;
  const p = q.data;
  return (
    <Card padded={false} className="flex flex-col gap-3 p-4" data-testid="me-points">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Gift size={20} aria-hidden /> {t("my.pointsTitle")}
        </h2>
        <span className="font-display text-3xl font-extrabold tabular-nums">{f.n(p.balance)}</span>
      </div>
      {p.earn ? <p className="text-sm text-muted">{t("my.howToEarn", { checkin: f.n(p.earn.perCheckin), days: f.n(p.earn.streakDays), bonus: f.n(p.earn.streakBonus), referral: f.n(p.earn.referral) })}</p> : null}
      {p.expiringIn30Days ? <p className="text-sm text-warning">{t("rewards.expiringSoon", { n: f.n(p.expiringIn30Days) })}</p> : null}
      {p.rewards.length ? (
        <ul className="divide-y divide-line text-sm">
          {p.rewards.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
              <span>{r.title}</span>
              <Badge tone={p.balance >= r.points ? "brand" : "neutral"}>{t("rewards.pts", { n: f.n(r.points) })}</Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-muted">{t("my.redeemAtDesk")}</p>
    </Card>
  );
}

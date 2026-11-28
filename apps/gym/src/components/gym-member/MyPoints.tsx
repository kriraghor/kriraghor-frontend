"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Gift } from "@phosphor-icons/react";
import { Badge, Card } from "@kriraghor/ui/kit";
import { gymOps2 } from "@/lib/gym-ops";
import { useFmt } from "@/components/gym-manage/common";

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

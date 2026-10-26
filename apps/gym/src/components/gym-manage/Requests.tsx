"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Tray } from "@phosphor-icons/react";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Badge, Button, EmptyState, FilterBar, Notice, SkeletonList, useToast } from "@kriraghor/ui/kit";
import { useUrlFilters } from "@kriraghor/ui/url-filters";
import { gymManage, type LinkRequest } from "@/lib/gym-manage";
import { GymPage, useFmt, useGymError, type GymCtx } from "./common";

const STATUSES = ["pending", "accepted", "declined", "expired", "cancelled"] as const;
const SPEC = { status: { default: "pending", allowed: STATUSES } };

/**
 * /manage/[gymId]/requests (M24-FR-14, FR-15): the gym's invites to link a member's Kriraghor
 * account, by state; a pending invite can be cancelled (members.edit). Join requests from the public
 * gym page arrive here in prompt 3.
 */
export function Requests({ gymId }: { gymId: string }) {
  const t = useTranslations("gm");
  return (
    <GymPage gymId={gymId} page="requests" title={t("requests.title")} description={t("requests.lead")} testId="gm-requests">
      {(ctx) => <List ctx={ctx} />}
    </GymPage>
  );
}

function List({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const { values, set } = useUrlFilters(SPEC);
  const status = values.status as LinkRequest["status"];
  const q = useQuery({ queryKey: ["gm-requests", ctx.gymId, status], queryFn: () => gymManage.requests(ctx.gymId, { status }) });
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const cancel = async (r: LinkRequest) => {
    setBusy(r.id);
    setProblem(null);
    try {
      await gymManage.cancelRequest(ctx.gymId, r.id);
      toast.show(t("requests.cancelled"));
      await qc.invalidateQueries({ queryKey: ["gm-requests", ctx.gymId] });
      await qc.invalidateQueries({ queryKey: ["gm-overview", ctx.gymId] });
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(null);
    }
  };
  const items = q.data?.items ?? [];
  return (
    <div className="flex flex-col gap-3">
      <FilterBar chips={{ value: status, onChange: (v) => set({ status: v }), label: t("requests.status"), options: STATUSES.map((s) => ({ value: s, label: t(`requestStatus.${s}`) })), testId: "requests-status" }} />
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      {q.isPending ? (
        <SkeletonList rows={4} />
      ) : q.isError ? (
        <Notice tone="error">{err(q.error)}</Notice>
      ) : !items.length ? (
        <EmptyState icon={<Tray size={32} aria-hidden />} title={t("requests.empty")} body={t("requests.emptyBody")} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface" data-testid="requests-list">
          {items.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5" data-testid="request-row">
              <div className="min-w-0 flex-1">
                {r.member ? (
                  <Link href={`/manage/${ctx.gymId}/members/${r.member.id}`} className="font-semibold hover:underline">
                    {r.member.displayName}
                  </Link>
                ) : (
                  <span className="font-semibold">{t("requests.someone")}</span>
                )}
                <p className="text-xs text-muted tabular-nums">
                  {r.member ? `${r.member.memberCode} · ••${r.member.phoneLast4} · ` : ""}
                  {t("requests.sent", { date: f.short(r.createdAt) })}
                  {r.status === "pending" ? ` · ${t("requests.expires", { date: f.short(r.expiresAt) })}` : r.decidedAt ? ` · ${f.short(r.decidedAt)}` : ""}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge>{t(`direction.${r.direction}`)}</Badge>
                  <Badge tone={r.status === "accepted" ? "brand" : r.status === "pending" ? "warning" : "neutral"}>{t(`requestStatus.${r.status}`)}</Badge>
                  {r.status === "pending" && !r.accountKnown ? <Badge tone="info">{t("requests.noAccountYet")}</Badge> : null}
                </div>
              </div>
              {r.status === "pending" && r.direction === "gym_invite" && ctx.can("members.edit") ? (
                <Button type="button" size="sm" variant="secondary" busy={busy === r.id} onClick={() => void cancel(r)} data-testid="request-cancel">
                  {t("requests.cancel")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

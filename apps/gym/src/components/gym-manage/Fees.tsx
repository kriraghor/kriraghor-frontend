"use client";

import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CashRegister, LinkSimple } from "@phosphor-icons/react";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Badge, Button, EmptyState, FilterBar, Notice, SkeletonList } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { useUrlFilters } from "@kriraghor/ui/url-filters";
import { dhakaToday, DUE_VIEWS, dueActions, duesQuery, featureLocked, gymManage, type DueRow } from "@/lib/gym-manage";
import { GymPage, useFmt, useGymError, type GymCtx } from "./common";
import { PayDialog, WaiveDialog } from "./money";
import { PaymentLinkDialog } from "./online";

const SPEC = { view: { default: "", allowed: DUE_VIEWS } };

/**
 * /manage/[gymId]/fees (fees.collect; M24-FR-32 to FR-36): dues to collect (unpaid and partial by
 * default; overdue, due today, partial, paid, waived), **Collect** a counter payment with its receipt,
 * **Payment link** (QR and link for paying online, M24-FR-40), **Waive** (fees.adjust), and the day's cash closing.
 */
export function Fees({ gymId }: { gymId: string }) {
  const t = useTranslations("gm");
  return (
    <GymPage
      gymId={gymId}
      page="fees"
      title={t("fees.title")}
      description={t("fees.lead")}
      testId="gm-fees"
    >
      {(ctx) => <List ctx={ctx} />}
    </GymPage>
  );
}

function List({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const { values, set } = useUrlFilters(SPEC);
  const [paying, setPaying] = useState<DueRow | null>(null);
  const [waiving, setWaiving] = useState<DueRow | null>(null);
  const [linking, setLinking] = useState<DueRow | null>(null);
  const today = dhakaToday();
  const q = useInfiniteQuery({
    queryKey: ["gm-dues", ctx.gymId, values.view],
    queryFn: ({ pageParam }) => gymManage.dues(ctx.gymId, { ...duesQuery(values.view, today, pageParam || undefined), limit: 25 }),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  const can = { collect: ctx.can("fees.collect"), adjust: ctx.can("fees.adjust") };
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["gm-dues", ctx.gymId] });
    void qc.invalidateQueries({ queryKey: ["gm-overview", ctx.gymId] });
    void qc.invalidateQueries({ queryKey: ["gm-closing", ctx.gymId] });
  };
  return (
    <div className="flex flex-col gap-3">
      <FilterBar chips={{ value: values.view, onChange: (v) => set({ view: v }), label: t("fees.views"), options: DUE_VIEWS.map((v) => ({ value: v, label: t(`fees.view.${v || "open"}`) })), testId: "fees-views" }} />
      {q.isPending ? (
        <SkeletonList rows={6} />
      ) : q.isError ? (
        <Notice tone="error">{err(q.error)}</Notice>
      ) : !rows.length ? (
        <EmptyState icon={<CashRegister size={32} aria-hidden />} title={t("fees.empty")} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface" data-testid="dues-list">
          {rows.map((d) => (
            <li key={d.id} className={cn("flex flex-wrap items-center gap-3 px-3 py-2.5", d.overdue && "bg-danger-soft/40")} data-testid="due-row">
              <div className="min-w-0 flex-1">
                <Link href={`/manage/${ctx.gymId}/members/${d.member.id}`} className="font-semibold hover:underline">
                  {d.member.displayName}
                </Link>{" "}
                <span className="text-xs text-muted tabular-nums">{d.member.memberCode}</span>
                <p className="truncate text-sm text-muted">
                  {d.membership ? `${d.membership.title} · ` : ""}
                  {t("profile.dueOn", { date: f.short(d.dueOn) })}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge tone={d.status === "paid" ? "brand" : d.status === "waived" || d.status === "void" ? "neutral" : "warning"}>{t(`dueStatus.${d.status}`)}</Badge>
                  {d.overdue ? <Badge tone="danger">{t("flag.overdue")}</Badge> : null}
                </div>
              </div>
              <div className="text-right">
                {d.outstandingPoisha !== undefined ? <p className="font-display text-lg font-bold tabular-nums">{f.taka(d.outstandingPoisha)}</p> : null}
                {d.amountPoisha !== undefined && d.outstandingPoisha !== d.amountPoisha ? <p className="text-xs text-muted">{t("fees.ofAmount", { amount: f.taka(d.amountPoisha) })}</p> : null}
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                {dueActions(d, can).map((a) => (
                  <Button key={a} type="button" size="sm" variant={a === "collect" ? "primary" : "secondary"} onClick={() => (a === "collect" ? setPaying(d) : setWaiving(d))} className="flex-1 sm:flex-none" data-testid={`due-${a}`}>
                    {t(`money.${a}`)}
                  </Button>
                ))}
                {dueActions(d, can).includes("collect") ? (
                  <Button type="button" size="sm" variant="secondary" icon={<LinkSimple size={16} aria-hidden />} onClick={() => setLinking(d)} className="flex-1 sm:flex-none" data-testid="due-link">
                    {t("online.link")}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {q.hasNextPage ? (
        <Button type="button" variant="secondary" onClick={() => void q.fetchNextPage()} busy={q.isFetchingNextPage} className="self-center">
          {t("loadMore")}
        </Button>
      ) : null}
      {paying ? <PayDialog gymId={ctx.gymId} due={paying} canAdjust={can.adjust} title={t("money.collectFrom", { name: paying.member.displayName })} open onOpenChange={(o) => !o && setPaying(null)} onDone={refresh} /> : null}
      {linking ? (
        <PaymentLinkDialog gymId={ctx.gymId} due={linking} owner={ctx.owner} tierLocked={featureLocked(ctx.gym.features, "online_fees")} title={t("online.linkFor", { name: linking.member.displayName })} open onOpenChange={(o) => !o && setLinking(null)} />
      ) : null}
      {waiving ? <WaiveDialog gymId={ctx.gymId} due={waiving} open onOpenChange={(o) => !o && setWaiving(null)} onDone={refresh} /> : null}
    </div>
  );
}

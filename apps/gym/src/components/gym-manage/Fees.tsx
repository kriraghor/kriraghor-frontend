"use client";

import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CashRegister, LinkSimple } from "@phosphor-icons/react";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Badge, Button, DataTable, FilterBar, Notice } from "@kriraghor/ui/kit";
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
      {q.isError && !rows.length ? (
        <Notice tone="error">{err(q.error)}</Notice>
      ) : (
        <DataTable
          label={t("fees.title")}
          testId="dues-list"
          rows={q.isPending ? undefined : rows}
          rowId={(d) => d.id}
          loading={q.isPending}
          rowTestId="due-row"
          hasMore={q.hasNextPage}
          onMore={() => void q.fetchNextPage()}
          busy={q.isFetchingNextPage}
          empty={{ title: t("fees.empty"), icon: <CashRegister size={32} aria-hidden /> }}
          rowProps={(d) => ({ tone: d.overdue ? "danger" : undefined, data: { status: d.status } })}
          columns={[
            {
              id: "member",
              header: t("fees.member"),
              primary: true,
              sort: (d) => d.member.displayName,
              cell: (d) => (
                <>
                  <Link href={`/manage/${ctx.gymId}/members/${d.member.id}`} className="font-semibold hover:underline">
                    {d.member.displayName}
                  </Link>{" "}
                  <span className="text-xs font-normal text-muted tabular-nums">{d.member.memberCode}</span>
                </>
              ),
            },
            { id: "package", header: t("fees.package"), hideBelow: "lg", sort: (d) => d.membership?.title ?? "", cell: (d) => d.membership?.title ?? "–" },
            { id: "due", header: t("fees.dueOn"), sort: (d) => d.dueOn, cell: (d) => <span className="tabular-nums">{f.short(d.dueOn)}</span> },
            {
              id: "status",
              header: t("fees.status"),
              sort: (d) => d.status,
              cell: (d) => (
                <span className="flex flex-wrap gap-1">
                  <Badge tone={d.status === "paid" ? "brand" : d.status === "waived" || d.status === "void" ? "neutral" : "warning"}>{t(`dueStatus.${d.status}`)}</Badge>
                  {d.overdue ? <Badge tone="danger">{t("flag.overdue")}</Badge> : null}
                </span>
              ),
            },
            {
              id: "outstanding",
              header: t("fees.outstanding"),
              align: "end",
              sort: (d) => d.outstandingPoisha ?? null,
              cell: (d) => (
                <>
                  {d.outstandingPoisha !== undefined ? <span className="font-semibold">{f.taka(d.outstandingPoisha)}</span> : "–"}
                  {d.amountPoisha !== undefined && d.outstandingPoisha !== d.amountPoisha ? <span className="block text-xs text-muted">{t("fees.ofAmount", { amount: f.taka(d.amountPoisha) })}</span> : null}
                </>
              ),
            },
            {
              id: "act",
              header: <span className="sr-only">{t("fees.actions")}</span>,
              label: t("fees.actions"),
              align: "end",
              cell: (d) => (
                <span className="flex flex-wrap justify-end gap-2">
                  {dueActions(d, can).map((a) => (
                    <Button key={a} type="button" size="sm" variant={a === "collect" ? "primary" : "secondary"} onClick={() => (a === "collect" ? setPaying(d) : setWaiving(d))} data-testid={`due-${a}`}>
                      {t(`money.${a}`)}
                    </Button>
                  ))}
                  {dueActions(d, can).includes("collect") ? (
                    <Button type="button" size="sm" variant="secondary" icon={<LinkSimple size={16} aria-hidden />} onClick={() => setLinking(d)} data-testid="due-link">
                      {t("online.link")}
                    </Button>
                  ) : null}
                </span>
              ),
            },
          ]}
        />
      )}
      {paying ? <PayDialog gymId={ctx.gymId} due={paying} canAdjust={can.adjust} title={t("money.collectFrom", { name: paying.member.displayName })} open onOpenChange={(o) => !o && setPaying(null)} onDone={refresh} /> : null}
      {linking ? (
        <PaymentLinkDialog gymId={ctx.gymId} due={linking} owner={ctx.owner} tierLocked={featureLocked(ctx.gym.features, "online_fees")} title={t("online.linkFor", { name: linking.member.displayName })} open onOpenChange={(o) => !o && setLinking(null)} />
      ) : null}
      {waiving ? <WaiveDialog gymId={ctx.gymId} due={waiving} open onOpenChange={(o) => !o && setWaiving(null)} onDone={refresh} /> : null}
    </div>
  );
}

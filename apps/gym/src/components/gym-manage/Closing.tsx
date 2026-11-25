"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CaretLeft, CaretRight, Printer } from "@phosphor-icons/react";
import { Badge, Button, Card, DataTable, IconButton, Notice, Skeleton } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { DatePicker } from "@kriraghor/ui/date";
import { addDays, dhakaToday, featureLocked, gymManage } from "@/lib/gym-manage";
import { canOpen } from "@/lib/manage-nav";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { GymPage, Row, useFmt, useGymError, type GymCtx } from "./common";
import { ReceiptLink } from "./money";

/**
 * /manage/[gymId]/fees/closing (M24-FR-38): the daily cash closing for a Dhaka date. Counter money by
 * method and by staff member, reversals, online payments apart; fees.collect sees their own, the owner
 * and reports.view everyone. **Print** uses the browser (print styles keep only the closing).
 */
export function Closing({ gymId }: { gymId: string }) {
  const t = useTranslations("gm");
  return (
    <GymPage gymId={gymId} page="closing" title={t("closing.title")} description={t("closing.lead")} back={{ href: `/manage/${gymId}/fees`, label: t("nav.fees") }} testId="gm-closing">
      {(ctx) => <Body ctx={ctx} />}
    </GymPage>
  );
}

function Body({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const err = useGymError();
  const today = dhakaToday();
  const [date, setDate] = useState(today);
  const q = useQuery({ queryKey: ["gm-closing", ctx.gymId, date], queryFn: () => gymManage.closing(ctx.gymId, date) });
  const c = q.data;
  return (
    <div className="flex flex-col gap-3">
      <div className="no-print flex flex-wrap items-end gap-2">
        <IconButton label={t("closing.prev")} variant="secondary" onClick={() => setDate(addDays(date, -1))}>
          <CaretLeft size={18} aria-hidden />
        </IconButton>
        <DatePicker id="closing-date" label={t("closing.date")} value={date} max={today} clearable={false} onChange={(v) => v && setDate(v)} className="w-56" />
        <IconButton label={t("closing.next")} variant="secondary" onClick={() => setDate(addDays(date, 1))} disabled={date >= today}>
          <CaretRight size={18} aria-hidden />
        </IconButton>
        <Button type="button" variant="secondary" icon={<Printer size={18} aria-hidden />} onClick={() => window.print()} data-testid="closing-print">
          {t("closing.print")}
        </Button>
        {canOpen("cash", ctx.perms) && !featureLocked(ctx.gym.features, "expenses") ? (
          <Link href={`/manage/${ctx.gymId}/cash`} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-text underline-offset-4 hover:underline" data-testid="closing-drawer">
            {t("closing.drawer")}
          </Link>
        ) : null}
      </div>
      {q.isPending ? (
        <Skeleton className="h-64 rounded-card" />
      ) : q.isError || !c ? (
        <Notice tone="error">{err(q.error)}</Notice>
      ) : (
        <div className="print-area flex flex-col gap-3" data-testid="closing">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold">
              {ctx.gym.name} · {f.date(c.date)}
            </h2>
            <Badge>{t(`closing.scope.${c.scope}`)}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Card padded={false} className="p-3">
              <p className="text-xs text-muted">{t("closing.counter")}</p>
              <p className="font-display text-2xl font-extrabold tabular-nums" data-testid="closing-counter">
                {f.taka(c.totals.counterPoisha)}
              </p>
            </Card>
            <Card padded={false} className="p-3">
              <p className="text-xs text-muted">{t("closing.received")}</p>
              <p className="font-display text-xl font-bold tabular-nums">{f.taka(c.totals.receivedPoisha)}</p>
            </Card>
            <Card padded={false} className="p-3">
              <p className="text-xs text-muted">{t("closing.reversed")}</p>
              <p className="font-display text-xl font-bold tabular-nums">{f.taka(c.totals.reversedPoisha)}</p>
            </Card>
            <Card padded={false} className="p-3">
              <p className="text-xs text-muted">{t("closing.online")}</p>
              <p className="font-display text-xl font-bold tabular-nums">{f.taka(c.totals.onlinePoisha)}</p>
            </Card>
          </div>
          <Card padded={false} className="p-3">
            <h3 className="font-semibold">{t("closing.byMethod")}</h3>
            <div className="divide-y divide-line">
              {Object.entries(c.totals.byMethod).length ? (
                Object.entries(c.totals.byMethod).map(([m, v]) => (
                  <Row key={m} label={t.has(`method.${m}`) ? t(`method.${m}`) : m}>
                    {f.taka(v)}
                  </Row>
                ))
              ) : (
                <p className="py-2 text-sm text-muted">{t("closing.nothing")}</p>
              )}
            </div>
          </Card>
          {c.byStaff.length ? (
            <Card padded={false} className="p-3">
              <h3 className="font-semibold">{t("closing.byStaff")}</h3>
              <ul className="divide-y divide-line">
                {c.byStaff.map((s) => (
                  <li key={s.userId} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5 text-sm" data-testid="closing-staff">
                    <span className="font-semibold">{s.displayName ?? t("profile.staff")}</span>
                    <span className="text-muted">{t("closing.payments", { n: s.count })}</span>
                    <span className="font-semibold tabular-nums">{f.taka(s.totalPoisha)}</span>
                    <span className="w-full text-xs text-muted">
                      {Object.entries(s.byMethod)
                        .map(([m, v]) => `${t.has(`method.${m}`) ? t(`method.${m}`) : m} ${f.taka(v)}`)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          <section>
            <h3 className="mb-2 font-semibold">{t("closing.items", { n: c.items.length })}</h3>
            <DataTable
              label={t("closing.items", { n: c.items.length })}
              testId="closing-items"
              rows={c.items}
              rowId={(p) => p.id}
              empty={{ title: t("closing.nothing") }}
              rowProps={(p) => ({ tone: p.amountPoisha < 0 ? "muted" : undefined })}
              columns={[
                { id: "time", header: t("closing.timeCol"), sort: (p) => p.createdAt, width: "6rem", cell: (p) => <span className="tabular-nums text-muted">{f.time(p.createdAt)}</span> },
                {
                  id: "amount",
                  header: t("closing.amountCol"),
                  align: "end",
                  primary: true,
                  sort: (p) => p.amountPoisha,
                  cell: (p) => <span className={cn("font-semibold", p.amountPoisha < 0 && "text-danger")}>{f.taka(p.amountPoisha)}</span>,
                  total: (rows) => f.taka(rows.reduce((n, p) => n + p.amountPoisha, 0)),
                },
                { id: "method", header: t("closing.methodCol"), sort: (p) => p.method, cell: (p) => (t.has(`method.${p.method}`) ? t(`method.${p.method}`) : p.method) },
                { id: "receipt", header: t("closing.receiptCol"), sort: (p) => p.receiptNo ?? "", cell: (p) => <span className="tabular-nums text-muted">{p.receiptNo ?? "–"}</span> },
                { id: "by", header: t("closing.byCol"), hideBelow: "lg", sort: (p) => p.receivedBy?.displayName ?? "", cell: (p) => <span className="text-muted">{p.receivedBy?.displayName ?? "–"}</span> },
                {
                  id: "open",
                  header: <span className="sr-only">{t("closing.receiptCol")}</span>,
                  label: t("closing.receiptCol"),
                  align: "end",
                  cell: (p) => (
                    <span className="no-print">
                      <ReceiptLink url={p.receiptUrl} />
                    </span>
                  ),
                },
              ]}
            />
          </section>
        </div>
      )}
    </div>
  );
}

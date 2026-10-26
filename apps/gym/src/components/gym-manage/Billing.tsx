"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowLeft, Check } from "@phosphor-icons/react";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Badge, Button, Card, Notice, Skeleton, useToast } from "@kriraghor/ui/kit";
import { DeskAccessNotice, deskAccessKey } from "@kriraghor/ui/desk";
import { problemOf } from "@kriraghor/api-client";
import { cn } from "@kriraghor/ui/cn";
import { FEATURES, gymManage, tiersInOrder, type Tier } from "@/lib/gym-manage";
import { useFmt, useGymError } from "./common";

/**
 * /manage/billing (owner; M24 §6.6, prompt 1 = the tier only): the plan chosen, today's active members
 * against its limit, what each tier includes and costs (prices from settings), and the tier picker.
 * Invoices start with prompt 2 (online payments), so nothing is billed from this page yet.
 */
export function Billing() {
  const t = useTranslations("gm");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["gm-billing"], queryFn: () => gymManage.billing(), retry: false });
  const [busy, setBusy] = useState<Tier | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const choose = async (tier: Tier) => {
    setBusy(tier);
    setProblem(null);
    try {
      await gymManage.setTier(tier);
      await qc.invalidateQueries({ queryKey: ["gm-billing"] });
      await qc.invalidateQueries({ queryKey: ["manage-gyms"] });
      await qc.invalidateQueries({ queryKey: ["gm-overview"] });
      toast.show(t("billing.changed", { tier: t(`tier.${tier}`) }));
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(null);
    }
  };
  const b = q.data;
  const pct = b?.activeMembers.limit ? Math.min(100, Math.round((b.activeMembers.today / b.activeMembers.limit) * 100)) : 0;
  return (
    <section className="mx-auto w-full max-w-[1100px] px-4 py-5 sm:px-6 md:py-8" data-testid="gm-billing">
      <Link href="/manage" className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-brand-text hover:underline">
        <ArrowLeft size={16} aria-hidden /> {t("myGyms")}
      </Link>
      <h1 className="mt-1 font-display text-2xl font-extrabold md:text-3xl">{t("billing.title")}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">{t("billing.lead")}</p>
      <div className="mt-4 flex flex-col gap-4">
        {q.isPending ? (
          <Skeleton className="h-64 rounded-card" />
        ) : q.isError || !b ? (
          deskAccessKey(problemOf(q.error)?.code) ? <DeskAccessNotice error={q.error} /> : <Notice tone="error">{err(q.error)}</Notice>
        ) : (
          <>
            <Card className="flex flex-col gap-3" data-testid="billing-current">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-lg font-bold">{t("billing.current", { tier: t(`tier.${b.subscription.chosenTier}`) })}</p>
                <Badge tone={b.subscription.status === "active" ? "brand" : "danger"}>{t(`subStatus.${b.subscription.status}`)}</Badge>
                {b.subscription.foundingPartner ? <Badge tone="prize">{t("billing.founding")}</Badge> : null}
              </div>
              <div>
                <p className="text-sm">
                  {b.activeMembers.limit ? t("billing.activeOf", { n: f.n(b.activeMembers.today), limit: f.n(b.activeMembers.limit) }) : t("billing.active", { n: f.n(b.activeMembers.today) })}
                </p>
                {b.activeMembers.limit ? (
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <div className={cn("h-full rounded-full", pct >= b.activeMembers.noticePct ? "bg-warning" : "bg-brand")} style={{ width: `${pct}%` }} />
                  </div>
                ) : null}
                <p className="mt-1 text-xs text-muted">{t("billing.window", { days: b.activeMembers.windowDays, tier: t(`tier.${b.activeMembers.fitTier}`) })}</p>
              </div>
              <Notice tone="info">{t("billing.noInvoices")}</Notice>
            </Card>
            {problem ? <Notice tone="error">{problem}</Notice> : null}
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="billing-tiers">
              {tiersInOrder(b.tiers).map((tier) => {
                const current = tier.key === b.subscription.chosenTier;
                return (
                  <li key={tier.key}>
                    <Card padded={false} className={cn("flex h-full flex-col gap-2 p-4", current && "border-brand ring-2 ring-brand/30")} data-testid={`tier-${tier.key}`}>
                      <p className="text-sm font-bold uppercase tracking-wide text-muted">{t(`tier.${tier.key}`)}</p>
                      <p className="font-display text-2xl font-extrabold tabular-nums">{tier.pricePoisha ? t("billing.perMonth", { price: f.taka(tier.pricePoisha) }) : t("billing.free")}</p>
                      <p className="text-sm">{tier.maxMembers ? t("billing.upTo", { n: f.n(tier.maxMembers) }) : t("billing.unlimited")}</p>
                      {tier.minGyms ? <p className="text-xs text-muted">{t("billing.minGyms", { n: tier.minGyms })}</p> : null}
                      <ul className="flex flex-col gap-1 text-sm">
                        <li className="flex items-start gap-1.5">
                          <Check size={16} className="mt-0.5 shrink-0 text-brand-text" aria-hidden /> {t("billing.base")}
                        </li>
                        {FEATURES.filter((x) => tier.features.includes(x)).map((x) => (
                          <li key={x} className="flex items-start gap-1.5">
                            <Check size={16} className="mt-0.5 shrink-0 text-brand-text" aria-hidden /> {t(`feature.${x}`)}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto pt-2">
                        {current ? (
                          <Badge tone="brand">{t("billing.yourPlan")}</Badge>
                        ) : (
                          <Button type="button" size="sm" block variant="secondary" busy={busy === tier.key} onClick={() => void choose(tier.key)} data-testid={`choose-${tier.key}`}>
                            {t("billing.choose", { tier: t(`tier.${tier.key}`) })}
                          </Button>
                        )}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
            {b.gyms.length ? (
              <Card padded={false} className="p-4">
                <h2 className="font-display text-lg font-bold">{t("billing.gyms")}</h2>
                <ul className="mt-2 divide-y divide-line">
                  {b.gyms.map((g) => (
                    <li key={g.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <Link href={`/manage/${g.id}`} className="font-semibold hover:underline">
                        {g.name}
                      </Link>
                      <Badge>{g.listingStatus === "draft" ? t("gyms.private") : t("gyms.listed")}</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

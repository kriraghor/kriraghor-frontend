"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowLeft, CaretRight, Check, Medal } from "@phosphor-icons/react";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Badge, Button, Card, EmptyState, Notice, Skeleton, useToast } from "@kriraghor/ui/kit";
import { DeskAccessNotice, deskAccessKey } from "@kriraghor/ui/desk";
import { problemOf } from "@kriraghor/api-client";
import { cn } from "@kriraghor/ui/cn";
import { FEATURES, gymManage, tiersInOrder, type Tier } from "@/lib/gym-manage";
import { billingBanner, feeKind, gymMoney, type BillingFull, type Invoice } from "@/lib/gym-money";
import { Row, useFmt, useGymError } from "./common";
import { InvoiceStatus, PayInvoiceButton } from "./billing-parts";
import { SmsAddonCard } from "./SmsAddon";

/**
 * /manage/billing (owner; M24 §6.6, FR-81 to FR-90): the plan chosen, active members today and this
 * month's peak against its limit, past-due and restricted banners, invoices with **Pay**, the fees that
 * apply (standard or a special rate until a date), founding partner status, the SMS add-on (prompt 3b),
 * what each tier includes and costs (prices from settings) and the tier picker.
 */
export function Billing() {
  const t = useTranslations("gm");
  const fm = useFmt();
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
  const b = q.data as BillingFull | undefined;
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
            <Banner b={b} />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
              <div className="flex flex-col gap-4">
                <Current b={b} />
                <Invoices />
              </div>
              <div className="flex flex-col gap-4">
                <Fees b={b} />
                <Founding b={b} />
                <SmsAddonCard addon={b.smsAddon} />
              </div>
            </div>
            {problem ? <Notice tone="error">{problem}</Notice> : null}
            <h2 className="font-display text-xl font-bold">{t("billing.plans")}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="billing-tiers">
              {tiersInOrder(b.tiers).map((tier) => {
                const current = tier.key === b.subscription.chosenTier;
                return (
                  <li key={tier.key}>
                    <Card padded={false} className={cn("flex h-full flex-col gap-2 p-4", current && "border-brand ring-2 ring-brand/30")} data-testid={`tier-${tier.key}`}>
                      <p className="text-sm font-bold uppercase tracking-wide text-muted">{t(`tier.${tier.key}`)}</p>
                      <p className="font-display text-2xl font-extrabold tabular-nums">{tier.pricePoisha ? t("billing.perMonth", { price: fm.taka(tier.pricePoisha) }) : t("billing.free")}</p>
                      <p className="text-sm">{tier.maxMembers ? t("billing.upTo", { n: fm.n(tier.maxMembers) }) : t("billing.unlimited")}</p>
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

/** Past due (pay by a date or lose the paid features) or restricted (pay to restore them). */
function Banner({ b }: { b: BillingFull }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const banner = billingBanner(b.subscription);
  if (!banner) return null;
  return banner.kind === "restricted" ? (
    <Notice tone="error" title={t("billing.restricted")}>
      <span data-testid="billing-restricted">{t("billing.restrictedBody")}</span>
    </Notice>
  ) : (
    <Notice tone="warning" title={t("billing.pastDue")}>
      <span data-testid="billing-past-due">{banner.restrictOn ? t("billing.pastDueBody", { date: f.date(banner.restrictOn) }) : t("billing.pastDueSoon")}</span>
    </Notice>
  );
}

function Current({ b }: { b: BillingFull }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const pct = b.activeMembers.limit ? Math.min(100, Math.round((b.activeMembers.today / b.activeMembers.limit) * 100)) : 0;
  return (
    <Card className="flex flex-col gap-3" data-testid="billing-current">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-display text-lg font-bold">{t("billing.current", { tier: t(`tier.${b.subscription.chosenTier}`) })}</p>
        <Badge tone={b.subscription.status === "active" ? "brand" : "danger"}>{t(`subStatus.${b.subscription.status}`)}</Badge>
        {b.subscription.foundingPartner ? <Badge tone="prize">{t("billing.founding")}</Badge> : null}
      </div>
      <div>
        <p className="text-sm">{b.activeMembers.limit ? t("billing.activeOf", { n: f.n(b.activeMembers.today), limit: f.n(b.activeMembers.limit) }) : t("billing.active", { n: f.n(b.activeMembers.today) })}</p>
        {b.activeMembers.limit ? (
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className={cn("h-full rounded-full", pct >= b.activeMembers.noticePct ? "bg-warning" : "bg-brand")} style={{ width: `${pct}%` }} />
          </div>
        ) : null}
        <p className="mt-2 text-sm" data-testid="billing-peak">
          {t("billing.peak", { n: f.n(b.activeMembers.monthPeak ?? b.activeMembers.today) })}
        </p>
        {b.subscription.monthMaxTier !== b.subscription.chosenTier ? <p className="text-xs text-muted">{t("billing.monthMax", { tier: t(`tier.${b.subscription.monthMaxTier}`) })}</p> : null}
        <p className="mt-1 text-xs text-muted">{t("billing.window", { days: b.activeMembers.windowDays, tier: t(`tier.${b.activeMembers.fitTier}`) })}</p>
      </div>
      <p className="text-xs text-muted">{t("billing.arrears")}</p>
    </Card>
  );
}

/** Invoices (GET /manage/billing/invoices), newest first: number, month, total, status, due date, **Pay**. */
function Invoices() {
  const t = useTranslations("gm");
  const f = useFmt();
  const err = useGymError();
  const q = useQuery({ queryKey: ["gm-invoices"], queryFn: () => gymMoney.invoices(), retry: false });
  return (
    <Card padded={false} className="p-4" data-testid="billing-invoices">
      <h2 className="font-display text-lg font-bold">{t("invoice.title")}</h2>
      {q.isPending ? (
        <Skeleton className="mt-2 h-24" />
      ) : q.isError ? (
        <Notice tone="error">{err(q.error)}</Notice>
      ) : !q.data.items.length ? (
        <EmptyState title={t("invoice.none")} body={t("invoice.noneBody")} />
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {q.data.items.map((i: Invoice) => (
            <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5" data-testid="invoice-row">
              <Link href={`/manage/billing/invoices/${i.id}`} className="min-w-0 flex-1 basis-full no-underline sm:basis-0">
                <span className="block font-semibold hover:underline">
                  {i.period ? f.month(i.period) : i.number}
                  <CaretRight size={14} className="ml-1 inline" aria-hidden />
                </span>
                <span className="block text-xs text-muted tabular-nums">
                  {i.number} · {i.status === "paid" && i.paidAt ? t("invoice.paidOn", { date: f.date(i.paidAt) }) : t("invoice.dueOn", { date: f.date(i.dueOn) })}
                </span>
              </Link>
              <span className="font-display text-lg font-bold tabular-nums">{f.taka(i.totalPoisha)}</span>
              <InvoiceStatus status={i.status} />
              <PayInvoiceButton invoice={i} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** The fees that apply to this owner (FR-90): the referral fee and the pass commission, standard or special. */
function Fees({ b }: { b: BillingFull }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const label = (x: { source: BillingFull["fees"]["referral"]["source"]; validTo: string | null }) => {
    const k = feeKind(x);
    return k === "standard" ? <Badge>{t("billing.standard")}</Badge> : <Badge tone="prize">{k === "specialUntil" ? t("billing.specialUntil", { date: f.date(x.validTo) }) : t("billing.special")}</Badge>;
  };
  return (
    <Card padded={false} className="p-4" data-testid="billing-fees">
      <h2 className="font-display text-lg font-bold">{t("billing.fees")}</h2>
      <div className="mt-1 divide-y divide-line">
        <div className="py-2">
          <Row label={t("billing.referral")}>{f.taka(b.fees.referral.valuePoisha)}</Row>
          <div className="flex justify-between gap-2 text-xs text-muted">
            <span>{t("billing.referralHint")}</span>
            {label(b.fees.referral)}
          </div>
        </div>
        <div className="py-2">
          <Row label={t("billing.passCommission")}>{`${f.n(b.fees.passCommission.pct)}%`}</Row>
          <div className="flex justify-between gap-2 text-xs text-muted">
            <span>{t("billing.passCommissionHint")}</span>
            {label(b.fees.passCommission)}
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">{t("billing.onlineFeesNoMargin")}</p>
    </Card>
  );
}

/** Founding partner (FR-88): my number and the free and discounted months, or the places still left. */
function Founding({ b }: { b: BillingFull }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const fd = b.founding;
  return (
    <Card padded={false} className="flex gap-3 p-4" data-testid="billing-founding">
      <Medal size={28} weight="fill" className={cn("shrink-0", fd.partner ? "text-prize" : "text-muted")} aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold">{fd.partner ? t("billing.foundingNo", { no: fd.no ?? "–" }) : t("billing.foundingTitle")}</p>
        {fd.partner ? (
          <div className="text-sm text-muted">
            {fd.freeUntil ? <p>{t("billing.freeUntil", { date: f.date(fd.freeUntil) })}</p> : <p>{t("billing.freeStarts")}</p>}
            {fd.discountUntil ? <p>{t("billing.discountUntil", { pct: fd.discountPct, date: f.date(fd.discountUntil) })}</p> : null}
          </div>
        ) : (
          <p className="text-sm text-muted">{fd.placesLeft > 0 ? t("billing.placesLeft", { n: fd.placesLeft, pct: fd.discountPct }) : t("billing.placesFull")}</p>
        )}
      </div>
    </Card>
  );
}

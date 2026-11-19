"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ChatText, Minus, Plus } from "@phosphor-icons/react";
import { Badge, Button, Card, Dialog, IconButton, Notice, useToast } from "@kriraghor/ui/kit";
import { clampBundles, gymSms, smsBalanceTone, smsCardState, type SmsAddon } from "@/lib/gym-sms";
import { useFmt, useGymError } from "./common";

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `sms-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const TONE = { empty: "danger", low: "warning", ok: "brand" } as const;

/**
 * The billing page's SMS add-on (M24 prompt 3b, M24-FR-96 to FR-98). Coming soon while the platform switch
 * is off or the plan is Free; otherwise the price and the monthly allowance with **Switch on**; once on, the
 * balance, the allowance left this month, bought bundles with their dates, **Buy SMS** (an invoice paid at
 * once, the units arrive with the payment), the latest entries and **Switch off**.
 */
export function SmsAddonCard({ addon }: { addon: SmsAddon }) {
  const t = useTranslations("gs");
  const state = smsCardState(addon);
  if (state === "soon")
    return (
      <Card padded={false} className="flex gap-3 border-dashed p-4" data-testid="billing-sms" data-state="soon">
        <ChatText size={24} className="shrink-0 text-muted" aria-hidden />
        <div>
          <p className="font-semibold">{t("title")}</p>
          <p className="text-sm text-muted">{addon.enabled ? t("needsPaid") : t("soon")}</p>
        </div>
      </Card>
    );
  return state === "off" ? <Off addon={addon} /> : <On addon={addon} />;
}

function useSwitch() {
  const qc = useQueryClient();
  const toast = useToast();
  const err = useGymError();
  const t = useTranslations("gs");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const run = async (enabled: boolean) => {
    setBusy(true);
    setProblem(null);
    try {
      await gymSms.setAddon(enabled);
      await qc.invalidateQueries({ queryKey: ["gm-billing"] });
      await qc.invalidateQueries({ queryKey: ["gm-reminders"] });
      toast.show(enabled ? t("switchedOn") : t("switchedOff"));
      return true;
    } catch (e) {
      setProblem(err(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, problem, run };
}

function Off({ addon }: { addon: SmsAddon }) {
  const t = useTranslations("gs");
  const f = useFmt();
  const s = useSwitch();
  return (
    <Card padded={false} className="flex flex-col gap-3 p-4" data-testid="billing-sms" data-state="off">
      <div className="flex gap-3">
        <ChatText size={24} className="shrink-0 text-brand-text" aria-hidden />
        <div>
          <p className="font-semibold">{t("title")}</p>
          <p className="text-sm text-muted">{t("lead")}</p>
        </div>
      </div>
      <p className="text-sm">
        <span className="font-display text-xl font-extrabold tabular-nums">{t("perMonth", { price: f.taka(addon.pricePoisha) })}</span>
        {addon.included ? <span className="text-muted"> · {t("included", { n: f.n(addon.included) })}</span> : null}
      </p>
      {s.problem ? <Notice tone="error">{s.problem}</Notice> : null}
      <Button type="button" className="self-start" busy={s.busy} onClick={() => void s.run(true)} confirm={{ kind: "save", title: t("onAsk"), body: t("billedNote"), confirmLabel: t("switchOn") }} data-testid="sms-on">
        {t("switchOn")}
      </Button>
      <p className="text-xs text-muted">{t("billedNote")}</p>
    </Card>
  );
}

function On({ addon }: { addon: SmsAddon }) {
  const t = useTranslations("gs");
  const f = useFmt();
  const err = useGymError();
  const s = useSwitch();
  const tone = smsBalanceTone(addon);
  const [bundles, setBundles] = useState(1);
  const [key, setKey] = useState(newKey);
  const [buying, setBuying] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [history, setHistory] = useState(false);
  const entries = useQuery({ queryKey: ["gm-sms-entries"], queryFn: () => gymSms.entries(), enabled: history });
  const canBuy = addon.available && addon.bundle.size > 0 && addon.bundle.pricePoisha > 0;
  const buy = async () => {
    setBuying(true);
    setProblem(null);
    try {
      const r = await gymSms.buyBundles(bundles, key);
      setKey(newKey());
      window.location.assign(r.payment.payUrl);
    } catch (e) {
      setProblem(err(e));
      setBuying(false);
    }
  };
  return (
    <Card padded={false} className="flex flex-col gap-3 p-4" data-testid="billing-sms" data-state="on">
      <div className="flex items-start gap-3">
        <ChatText size={24} className="shrink-0 text-brand-text" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t("title")}</p>
          <p className="text-sm text-muted">{t("onLead")}</p>
        </div>
        <Badge tone="brand">{t("active")}</Badge>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("balance")}</p>
          <p className="font-display text-3xl font-extrabold tabular-nums" data-testid="sms-balance">
            {f.n(addon.balance)}
          </p>
        </div>
        <Badge tone={TONE[tone]}>{t(`tone.${tone}`)}</Badge>
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        <li className="flex justify-between gap-2">
          <span className="text-muted">{t("allowanceLeft")}</span>
          <span className="font-semibold tabular-nums">{f.n(addon.allowanceLeft)}</span>
        </li>
        {addon.bundles.map((b, i) => (
          <li key={`${b.expiresOn}-${i}`} className="flex justify-between gap-2">
            <span className="text-muted">{t("bundleUntil", { date: f.date(b.expiresOn) })}</span>
            <span className="font-semibold tabular-nums">{f.n(b.units)}</span>
          </li>
        ))}
      </ul>
      {canBuy ? (
        <div className="flex flex-col gap-2 border-t border-line pt-3" data-testid="sms-buy">
          <p className="text-sm font-semibold">{t("buyTitle", { size: f.n(addon.bundle.size), price: f.taka(addon.bundle.pricePoisha) })}</p>
          <div className="flex flex-wrap items-center gap-2">
            <IconButton label={t("fewer")} variant="secondary" onClick={() => setBundles(clampBundles(bundles - 1))} disabled={bundles <= 1}>
              <Minus size={16} aria-hidden />
            </IconButton>
            <span className="min-w-8 text-center font-display text-lg font-extrabold tabular-nums" aria-live="polite" data-testid="sms-bundles">
              {f.n(bundles)}
            </span>
            <IconButton label={t("more")} variant="secondary" onClick={() => setBundles(clampBundles(bundles + 1))} disabled={bundles >= 20}>
              <Plus size={16} aria-hidden />
            </IconButton>
            <Button type="button" busy={buying} onClick={() => void buy()} confirm={{ kind: "money", title: t("buyAsk", { n: f.n(bundles * addon.bundle.size), price: f.taka(bundles * addon.bundle.pricePoisha) }), body: t("buyNote", { days: f.n(addon.bundle.validDays) }), confirmLabel: t("buyYes") }} data-testid="sms-buy-go">
              {t("buy", { n: f.n(bundles * addon.bundle.size), price: f.taka(bundles * addon.bundle.pricePoisha) })}
            </Button>
          </div>
          <p className="text-xs text-muted">{t("buyNote", { days: f.n(addon.bundle.validDays) })}</p>
        </div>
      ) : null}
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      {s.problem ? <Notice tone="error">{s.problem}</Notice> : null}
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <Button type="button" size="sm" variant="ghost" onClick={() => setHistory(!history)} aria-expanded={history} data-testid="sms-history">
          {history ? t("hideHistory") : t("showHistory")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAsking(true)} data-testid="sms-off">
          {t("switchOff")}
        </Button>
      </div>
      {history ? (
        <ul className="divide-y divide-line text-sm" data-testid="sms-entries">
          {(entries.data?.items ?? []).map((e) => (
            <li key={e.id} className="flex items-baseline justify-between gap-2 py-1.5">
              <span>
                {t(`kind.${e.kind}`)}
                <span className="text-xs text-muted"> · {f.short(e.createdAt)}</span>
                {e.note ? <span className="block text-xs text-muted">{e.note}</span> : null}
              </span>
              <span className={`font-semibold tabular-nums ${e.units < 0 ? "text-muted" : "text-brand-text"}`}>{e.units > 0 ? `+${f.n(e.units)}` : f.n(e.units)}</span>
            </li>
          ))}
          {entries.data && !entries.data.items.length ? <li className="py-1.5 text-muted">{t("noEntries")}</li> : null}
        </ul>
      ) : null}
      <Dialog
        open={asking}
        onOpenChange={setAsking}
        title={t("offTitle")}
        description={t("offBody")}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAsking(false)}>
              {t("keep")}
            </Button>
            <Button type="button" variant="danger" busy={s.busy} onClick={() => void s.run(false).then((ok) => ok && setAsking(false))} data-testid="sms-off-confirm">
              {t("switchOff")}
            </Button>
          </div>
        }
      />
    </Card>
  );
}

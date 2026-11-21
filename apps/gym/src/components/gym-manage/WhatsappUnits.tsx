"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Minus, Plus, WhatsappLogo } from "@phosphor-icons/react";
import { newKey } from "@kriraghor/ui/format";
import { Badge, Button, Card, IconButton, Notice, Skeleton, useConfirm, useToast } from "@kriraghor/ui/kit";
import { clampBundles } from "@/lib/gym-sms";
import { gymWhatsapp, type Units } from "@/lib/gym-whatsapp";
import { unitsCardState } from "@/lib/whatsapp";
import { useFmt } from "./common";
import { useWaError } from "./wa-parts";

/**
 * The billing page's WhatsApp messages card (M24-FR-167), beside the SMS add-on: coming soon while the
 * platform switch is off; the plan it needs; Switch on with the units per message and the monthly
 * allowance; once on, the balance, bought bundles, Buy units (an invoice paid at once), the history and
 * Switch off.
 */
export function WhatsappUnitsCard() {
  const waErr = useWaError();
  const q = useQuery({ queryKey: ["gm-wa-units"], queryFn: () => gymWhatsapp.units(), retry: false });
  if (q.isPending) return <Skeleton className="h-32 rounded-card" />;
  if (q.isError || !q.data) return <Notice tone="error">{waErr(q.error)}</Notice>;
  return <UnitsCard u={q.data} />;
}

function Head({ lead }: { lead: string }) {
  const t = useTranslations("gw");
  return (
    <div className="flex gap-3">
      <WhatsappLogo size={24} className="shrink-0 text-brand-text" aria-hidden />
      <div>
        <p className="font-semibold">{t("units.title")}</p>
        <p className="text-sm text-muted">{lead}</p>
      </div>
    </div>
  );
}

function UnitsCard({ u }: { u: Units }) {
  const t = useTranslations("gw");
  const f = useFmt();
  const qc = useQueryClient();
  const ask = useConfirm();
  const toast = useToast();
  const waErr = useWaError();
  const state = unitsCardState(u);
  const [busy, setBusy] = useState<"switch" | "buy" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [bundles, setBundles] = useState(1);
  const [key, setKey] = useState(newKey);
  const [history, setHistory] = useState(false);
  const entries = useQuery({ queryKey: ["gm-wa-entries"], queryFn: () => gymWhatsapp.entries(), enabled: history, retry: false });
  if (state === "soon" || state === "plan")
    return (
      <Card padded={false} className="flex gap-3 border-dashed p-4" data-testid="billing-whatsapp" data-state={state}>
        <WhatsappLogo size={24} className="shrink-0 text-muted" aria-hidden />
        <div>
          <p className="font-semibold">{t("units.title")}</p>
          <p className="text-sm text-muted">{state === "soon" ? t("units.soon") : t("units.needsPlan")}</p>
        </div>
      </Card>
    );
  const setOn = async (enabled: boolean) => {
    if (!(await ask(enabled ? { kind: "save", title: t("units.onAsk"), body: t("units.onBody"), confirmLabel: t("units.switchOn") } : { kind: "remove", title: t("units.offAsk"), body: t("units.offBody"), confirmLabel: t("units.switchOff") }))) return;
    setBusy("switch");
    setProblem(null);
    try {
      qc.setQueryData(["gm-wa-units"], await gymWhatsapp.setAddon(enabled));
      await qc.invalidateQueries({ queryKey: ["gm-wa"] });
      toast.show(enabled ? t("units.switchedOn") : t("units.switchedOff"));
    } catch (e) {
      setProblem(waErr(e));
    } finally {
      setBusy(null);
    }
  };
  const total = bundles * u.bundle.size;
  const price = f.taka(bundles * u.bundle.pricePoisha);
  const buy = async () => {
    if (!(await ask({ kind: "money", title: t("units.buyAsk", { n: f.n(total), price }), body: t("units.buyNote", { days: f.n(u.bundle.validDays) }), confirmLabel: t("units.buyYes") }))) return;
    setBusy("buy");
    setProblem(null);
    try {
      const r = await gymWhatsapp.buyBundles(bundles, key);
      setKey(newKey());
      window.location.assign(r.payment.payUrl);
    } catch (e) {
      setProblem(waErr(e));
      setBusy(null);
    }
  };
  const perMessage = t("units.perMessage", { utility: f.n(u.units.utility), marketing: f.n(u.units.marketing) });
  if (state === "off")
    return (
      <Card padded={false} className="flex flex-col gap-3 p-4" data-testid="billing-whatsapp" data-state="off">
        <Head lead={t("units.lead")} />
        <p className="text-sm text-muted">{perMessage}</p>
        {u.included ? <p className="text-sm">{t("units.included", { n: f.n(u.included) })}</p> : null}
        {problem ? <Notice tone="error">{problem}</Notice> : null}
        <Button type="button" className="self-start" busy={busy === "switch"} onClick={() => void setOn(true)} data-testid="wa-units-on">
          {t("units.switchOn")}
        </Button>
      </Card>
    );
  const low = u.balance < u.lowBalance;
  return (
    <Card padded={false} className="flex flex-col gap-3 p-4" data-testid="billing-whatsapp" data-state="on">
      <div className="flex items-start justify-between gap-3">
        <Head lead={perMessage} />
        <Badge tone="brand">{t(`units.status.${u.status ?? "active"}`)}</Badge>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("units.balance")}</p>
          <p className="font-display text-3xl font-extrabold tabular-nums" data-testid="wa-units-balance">
            {f.n(u.balance)}
          </p>
        </div>
        {low ? <Badge tone="warning">{t("units.low")}</Badge> : null}
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {u.included ? (
          <li className="text-muted">{t("units.included", { n: f.n(u.included) })}</li>
        ) : null}
        {u.bundles.map((b, i) => (
          <li key={`${b.expiresOn}-${i}`} className="flex justify-between gap-2">
            <span className="text-muted">{t("units.bundleUntil", { date: f.date(b.expiresOn) })}</span>
            <span className="font-semibold tabular-nums">{f.n(b.units)}</span>
          </li>
        ))}
      </ul>
      {u.bundle.size > 0 && u.bundle.pricePoisha > 0 ? (
        <div className="flex flex-col gap-2 border-t border-line pt-3" data-testid="wa-units-buy">
          <p className="text-sm font-semibold">{t("units.buyTitle", { size: f.n(u.bundle.size), price: f.taka(u.bundle.pricePoisha) })}</p>
          <div className="flex flex-wrap items-center gap-2">
            <IconButton label={t("units.fewer")} variant="secondary" onClick={() => setBundles(clampBundles(bundles - 1))} disabled={bundles <= 1}>
              <Minus size={16} aria-hidden />
            </IconButton>
            <span className="min-w-8 text-center font-display text-lg font-extrabold tabular-nums" aria-live="polite" data-testid="wa-units-bundles">
              {f.n(bundles)}
            </span>
            <IconButton label={t("units.more")} variant="secondary" onClick={() => setBundles(clampBundles(bundles + 1))} disabled={bundles >= 20}>
              <Plus size={16} aria-hidden />
            </IconButton>
            <Button type="button" busy={busy === "buy"} onClick={() => void buy()} data-testid="wa-units-buy-go">
              {t("units.buy", { n: f.n(total), price })}
            </Button>
          </div>
          <p className="text-xs text-muted">{t("units.buyNote", { days: f.n(u.bundle.validDays) })}</p>
        </div>
      ) : null}
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <Button type="button" size="sm" variant="ghost" onClick={() => setHistory(!history)} aria-expanded={history} data-testid="wa-units-history">
          {history ? t("units.hideHistory") : t("units.showHistory")}
        </Button>
        <Button type="button" size="sm" variant="ghost" busy={busy === "switch"} onClick={() => void setOn(false)} data-testid="wa-units-off">
          {t("units.switchOff")}
        </Button>
      </div>
      {history ? (
        <ul className="divide-y divide-line text-sm" data-testid="wa-units-entries">
          {(entries.data?.items ?? []).map((e) => (
            <li key={e.id} className="flex items-baseline justify-between gap-2 py-1.5">
              <span>
                {t(`units.kind.${e.kind}`)}
                <span className="text-xs text-muted"> · {f.short(e.createdAt)}</span>
              </span>
              <span className={`font-semibold tabular-nums ${e.units < 0 ? "text-muted" : "text-brand-text"}`}>{e.units > 0 ? `+${f.n(e.units)}` : f.n(e.units)}</span>
            </li>
          ))}
          {entries.data && !entries.data.items.length ? <li className="py-1.5 text-muted">{t("units.noEntries")}</li> : null}
        </ul>
      ) : null}
    </Card>
  );
}

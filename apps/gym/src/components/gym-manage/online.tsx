"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowSquareOut, Copy, Globe, LinkSimple } from "@phosphor-icons/react";
import QRCode from "qrcode";
import { problemOf } from "@kriraghor/api-client";
import { newKey } from "@kriraghor/ui/format";
import { Badge, Button, ButtonLink, Checkbox, Dialog, Field, Notice, Skeleton, Textarea, useToast } from "@kriraghor/ui/kit";
import { gymManage, poishaToTakaText, takaToPoisha, type FeePayment } from "@/lib/gym-manage";
import { gymMoney, linkChannels, onlineFeesFix, openLinkOf, refundState, type PaymentLink } from "@/lib/gym-money";
import { useFmt, useGymError } from "./common";

/** A payment link's QR (the link URL itself), drawn in the browser; black on white so any phone camera reads it. */
export function LinkQr({ value, label }: { value: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(value, { errorCorrectionLevel: "M", margin: 2, width: 480, color: { dark: "#111210", light: "#ffffff" } }).then((u) => live && setSrc(u));
    return () => {
      live = false;
    };
  }, [value]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={label} className="aspect-square w-full max-w-[240px] rounded-control bg-white" data-testid="link-qr" /> : <span className="block aspect-square w-full max-w-[240px] kg-shimmer rounded-control bg-white/80" />;
}

/** "Online" with the provider charge and what the gym gets (owner only: the API leaves providerCharge out for staff). */
export function OnlineCharge({ p }: { p: Pick<FeePayment, "method" | "providerCharge"> }) {
  const t = useTranslations("gm");
  const f = useFmt();
  if (p.method !== "online") return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs" data-testid="online-charge">
      <Badge tone="info" icon={<Globe size={12} aria-hidden />}>
        {t("online.badge")}
      </Badge>
      {p.providerCharge ? (
        <span className="text-muted">
          {t("online.charge", { charge: f.taka(p.providerCharge.poisha), net: f.taka(p.providerCharge.netPoisha) })}
        </span>
      ) : null}
    </span>
  );
}

/** The answer to "this gym can't take fees online": why, and the owner's way to fix it. */
export function OnlineFeesNotice({ reason, owner }: { reason: string | null | undefined; owner: boolean }) {
  const t = useTranslations("gm");
  const fix = onlineFeesFix(reason);
  return (
    <Notice
      tone="warning"
      title={t("online.unavailable")}
      action={
        owner ? (
          <ButtonLink href={fix.href} size="sm" variant="secondary" data-testid="online-fix">
            {t(`online.fix.${fix.key}`)}
          </ButtonLink>
        ) : undefined
      }
    >
      <span data-testid="online-unavailable" data-reason={fix.key}>
        {t(`online.why.${fix.key}`)} {owner ? null : t("upsell.askOwner")}
      </span>
    </Notice>
  );
}

/**
 * **Payment link** on one due (fees.collect, M24-FR-40): amount (default the outstanding), send in-app
 * and by email (both off = only the QR at the counter), then the QR, **Copy link** and the expiry. A due
 * with an open link shows that link with **Cancel link** instead (one open link per due).
 */
export function PaymentLinkDialog({ gymId, due, owner, tierLocked, title, open, onOpenChange, onDone }: { gymId: string; due: { id: string; outstandingPoisha?: number }; owner: boolean; tierLocked?: boolean; title?: string; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const err = useGymError();
  const toast = useToast();
  const qc = useQueryClient();
  const links = useQuery({ queryKey: ["gm-links", gymId, due.id], queryFn: () => gymMoney.links(gymId, { dueId: due.id }), enabled: open, retry: false });
  const [taka, setTaka] = useState(poishaToTakaText(due.outstandingPoisha ?? null));
  const [inApp, setInApp] = useState(true);
  const [email, setEmail] = useState(true);
  // Prompt 3b: by SMS too, when the owner's SMS add-on is on (only the owner reads the billing page).
  const billing = useQuery({ queryKey: ["gm-billing"], queryFn: () => gymManage.billing(), enabled: open && owner, retry: false, staleTime: 60_000 });
  const smsOn = billing.data?.smsAddon.status === "active";
  const [bySms, setBySms] = useState(false);
  const [key, setKey] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ text: string; reason?: string } | null>(tierLocked ? { text: "", reason: "tier" } : null);
  const [created, setCreated] = useState<PaymentLink | null>(null);
  const current = created ?? openLinkOf(links.data?.items ?? []);
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["gm-links", gymId, due.id] });
    onDone?.();
  };
  const create = async () => {
    const amountPoisha = takaToPoisha(taka);
    if (amountPoisha === null) return setProblem({ text: t("money.badAmount") });
    if (due.outstandingPoisha !== undefined && amountPoisha > due.outstandingPoisha) return setProblem({ text: t("err.GYM_PAYMENT_EXCEEDS_DUE") });
    setBusy(true);
    setProblem(null);
    try {
      const l = await gymMoney.createLink(gymId, due.id, { amountPoisha, channels: linkChannels(inApp, email, smsOn && bySms) }, key);
      setCreated(l);
      toast.show(t("online.created"));
      await refresh();
    } catch (e) {
      const p = problemOf(e) as (ReturnType<typeof problemOf> & { reason?: string }) | null;
      if (p?.code === "GYM_PAY_LINK_OPEN") await refresh();
      setProblem({ text: err(e), reason: p?.code === "GYM_ONLINE_FEES_UNAVAILABLE" ? (p.reason ?? "role") : undefined });
    } finally {
      setBusy(false);
    }
  };
  const cancel = async (l: PaymentLink) => {
    setBusy(true);
    setProblem(null);
    try {
      await gymMoney.cancelLink(gymId, l.id);
      setCreated(null);
      setKey(newKey());
      toast.show(t("online.cancelled"));
      await refresh();
    } catch (e) {
      setProblem({ text: err(e) });
    } finally {
      setBusy(false);
    }
  };
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.show(t("online.copied"));
    } catch {
      toast.show(url);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title ?? t("online.linkTitle")}
      footer={
        current ? (
          <>
            <Button type="button" variant="ghost" onClick={() => void cancel(current)} busy={busy} data-testid="link-cancel">
              {t("online.cancelLink")}
            </Button>
            <Button type="button" onClick={() => onOpenChange(false)}>
              {t("done")}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button type="button" onClick={() => void create()} busy={busy} disabled={links.isPending || Boolean(problem?.reason)} data-testid="link-create">
              {t("online.create")}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-3" data-testid="link-dialog">
        {links.isPending ? (
          <Skeleton className="h-40 rounded-control" />
        ) : current ? (
          <div className="flex flex-col items-center gap-3 text-center" data-testid="link-open">
            <LinkQr value={current.qr} label={t("online.qrAlt")} />
            <p className="font-display text-2xl font-extrabold tabular-nums">{f.taka(current.amountPoisha)}</p>
            <p className="text-sm text-muted">{t("online.expires", { date: f.date(current.expiresAt), time: f.time(current.expiresAt) })}</p>
            {current.channels.length ? <p className="text-xs text-muted">{t("online.sentBy", { channels: current.channels.map((c) => t(`online.channel.${c}`)).join(", ") })}</p> : <p className="text-xs text-muted">{t("online.qrOnly")}</p>}
            <div className="flex w-full flex-wrap justify-center gap-2">
              <Button type="button" variant="secondary" size="sm" icon={<Copy size={16} aria-hidden />} onClick={() => void copy(current.url)} data-testid="link-copy">
                {t("online.copy")}
              </Button>
              <a href={current.url} target="_blank" rel="noopener" className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-brand-text underline" data-testid="link-url">
                <ArrowSquareOut size={16} aria-hidden /> {t("online.openLink")}
              </a>
            </div>
            <p className="break-all text-xs text-muted">{current.url}</p>
          </div>
        ) : (
          <>
            <p className="flex items-start gap-2 text-sm text-muted">
              <LinkSimple size={18} className="mt-0.5 shrink-0" aria-hidden /> {t("online.lead")}
            </p>
            <Field
              id="link-amount"
              label={t("money.amount")}
              inputMode="decimal"
              value={taka}
              onChange={(e) => setTaka(e.target.value)}
              hint={due.outstandingPoisha !== undefined ? t("money.outstanding", { amount: f.taka(due.outstandingPoisha) }) : undefined}
              leading={<span className="text-muted">৳</span>}
              data-testid="link-amount"
            />
            <fieldset className="flex flex-col">
              <legend className="text-sm font-semibold">{t("online.send")}</legend>
              <Checkbox id="link-inapp" label={t("online.channel.in_app")} checked={inApp} onChange={(e) => setInApp(e.target.checked)} data-testid="link-inapp" />
              <Checkbox id="link-email" label={t("online.channel.email")} checked={email} onChange={(e) => setEmail(e.target.checked)} data-testid="link-email" />
              {smsOn ? <Checkbox id="link-sms" label={t("online.channel.sms")} checked={bySms} onChange={(e) => setBySms(e.target.checked)} data-testid="link-sms" /> : null}
              <p className="text-xs text-muted">{t("online.sendHint")}</p>
            </fieldset>
          </>
        )}
        {problem?.reason ? <OnlineFeesNotice reason={problem.reason} owner={owner} /> : problem ? <p role="alert" className="text-sm text-danger">{problem.text}</p> : null}
      </div>
    </Dialog>
  );
}

/**
 * **Refund** an online payment from the hold (owner, M24-FR-44): up to what is still refundable, with a
 * reason, before the release time; after it the owner returns the money directly and records a reversal.
 */
export function RefundDialog({ gymId, payment, open, onOpenChange, onDone }: { gymId: string; payment: FeePayment; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const err = useGymError();
  const toast = useToast();
  const links = useQuery({ queryKey: ["gm-links", gymId, payment.dueId], queryFn: () => gymMoney.links(gymId, { dueId: payment.dueId }), enabled: open, retry: false });
  const link = links.data?.items.find((l) => l.id === payment.linkId || (payment.paymentId && l.paymentId === payment.paymentId)) ?? null;
  const state = refundState(payment, link);
  const [taka, setTaka] = useState(poishaToTakaText(payment.amountPoisha));
  const [reason, setReason] = useState("");
  const [key] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const submit = async () => {
    if (!state.can) return;
    const amountPoisha = takaToPoisha(taka);
    if (amountPoisha === null) return setProblem(t("money.badAmount"));
    if (amountPoisha > state.refundable) return setProblem(t("online.refundMax", { amount: f.taka(state.refundable) }));
    if (reason.trim().length < 2) return setProblem(t("money.reasonNeeded"));
    setBusy(true);
    setProblem(null);
    try {
      await gymMoney.refund(gymId, payment.id, { amountPoisha, reason: reason.trim().slice(0, 300) }, key);
      toast.show(t("online.refunded"));
      onOpenChange(false);
      onDone();
    } catch (e) {
      const p = problemOf(e) as (ReturnType<typeof problemOf> & { refundable?: number }) | null;
      setProblem(p?.code === "GYM_REFUND_EXCEEDS_PAID" && p.refundable !== undefined ? t("online.refundMax", { amount: f.taka(p.refundable) }) : err(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("online.refundTitle")}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button type="button" variant="danger" onClick={() => void submit()} busy={busy} disabled={!state.can || links.isPending} data-testid="refund-submit">
            {t("online.refund")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-testid="refund-dialog">
        {links.isPending ? (
          <Skeleton className="h-24 rounded-control" />
        ) : state.can ? (
          <>
            <Notice tone="info">{state.until ? t("online.refundUntil", { date: f.date(state.until), time: f.time(state.until) }) : t("online.refundLead")}</Notice>
            <Field id="refund-amount" label={t("money.amount")} inputMode="decimal" value={taka} onChange={(e) => setTaka(e.target.value)} hint={t("online.refundable", { amount: f.taka(state.refundable) })} leading={<span className="text-muted">৳</span>} data-testid="refund-amount" />
            <Textarea id="refund-reason" label={t("money.reason")} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} data-testid="refund-reason" />
          </>
        ) : (
          <Notice tone="warning" title={t(`online.noRefund.${state.why}`)}>
            {state.why === "released" ? t("online.windowClosed") : null}
          </Notice>
        )}
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

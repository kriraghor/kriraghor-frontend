"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { WhatsappLogo } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { cn } from "@kriraghor/ui/cn";
import { Button, bdMobile, useConfirm, useToast } from "@kriraghor/ui/kit";
import { featureLocked } from "@/lib/gym-manage";
import { gymWhatsapp } from "@/lib/gym-whatsapp";
import { waProblemKey } from "@/lib/whatsapp";
import { useGymError, type GymCtx } from "./common";

/** An E.164 number (+8801…) in the local form people read and type (01…); empty for none. */
export const localNumber = (n: string | null | undefined) => (n ? bdMobile.local(n) : "");

/**
 * An on/off switch with its label and a one-line explanation: a button with role switch, 44px tall,
 * the label clickable too (the Reminders switch with words beside it).
 */
export function SwitchRow({ id, label, hint, on, onChange, disabled, testId }: { id: string; label: ReactNode; hint?: ReactNode; on: boolean; onChange: (on: boolean) => void; disabled?: boolean; testId?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-[15px] font-semibold">
          {label}
        </label>
        {hint ? (
          <p id={`${id}-hint`} className="text-xs text-muted">
            {hint}
          </p>
        ) : null}
      </div>
      <button type="button" role="switch" id={id} aria-checked={on} aria-describedby={hint ? `${id}-hint` : undefined} disabled={disabled} onClick={() => onChange(!on)} className="inline-flex h-11 w-14 shrink-0 items-center justify-center disabled:opacity-60" data-testid={testId} data-on={on}>
        <span className={cn("relative inline-flex h-7 w-12 items-center rounded-full border transition-colors", on ? "border-brand bg-brand" : "border-line-strong bg-surface-2")}>
          <span className={cn("absolute size-5 rounded-full bg-white shadow transition-transform", on ? "translate-x-6" : "translate-x-1")} />
        </span>
      </button>
    </div>
  );
}

/** A WhatsApp problem as friendly text (gw.err by code and reason), else the app's usual words. */
export function useWaError() {
  const t = useTranslations("gw");
  const err = useGymError();
  return (e: unknown) => {
    const key = waProblemKey(problemOf(e));
    return key ? t(`err.${key}`) : err(e);
  };
}

/** GET /manage/gyms/:gymId/whatsapp for the owner and staff with whatsapp.send. */
export function useWaGym(ctx: GymCtx, enabled = true) {
  return useQuery({ queryKey: ["gm-wa", ctx.gymId], queryFn: () => gymWhatsapp.gym(ctx.gymId), enabled: enabled && ctx.can("whatsapp.send"), retry: false, staleTime: 30_000 });
}

/** Whether this person may send on WhatsApp here now: whatsapp.send (the owner too), the plan, and the platform switch. */
export function useWaSending(ctx: GymCtx): boolean {
  const allowed = ctx.can("whatsapp.send") && !featureLocked(ctx.gym.features, "whatsapp");
  const q = useWaGym(ctx, allowed);
  return allowed && Boolean(q.data?.apiEnabled);
}

/** "Send on WhatsApp" beside a payment's receipt link (M24-FR-165): asks first, shows why when it can't go. */
export function WaReceiptButton({ gymId, feePaymentId }: { gymId: string; feePaymentId: string }) {
  const t = useTranslations("gw");
  const ask = useConfirm();
  const toast = useToast();
  const waErr = useWaError();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const send = async () => {
    if (!(await ask({ kind: "send", title: t("receipt.ask"), body: t("receipt.body") }))) return;
    setBusy(true);
    setProblem(null);
    try {
      await gymWhatsapp.sendReceipt(gymId, feePaymentId);
      toast.show(t("receipt.sent"));
    } catch (e) {
      setProblem(waErr(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex flex-col items-end">
      <Button type="button" size="sm" variant="ghost" icon={<WhatsappLogo size={14} aria-hidden />} busy={busy} onClick={() => void send()} data-testid="payment-whatsapp">
        {t("receipt.send")}
      </Button>
      {problem ? (
        <span role="alert" className="max-w-[28ch] text-right text-xs text-danger" data-testid="payment-whatsapp-problem">
          {problem}
        </span>
      ) : null}
    </span>
  );
}

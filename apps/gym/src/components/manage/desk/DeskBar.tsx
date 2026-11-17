"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { LockKey } from "@phosphor-icons/react";
import { Avatar, Button } from "@kriraghor/ui/kit";
import { desk, type OpenDesk } from "@/lib/desk";
import { isNetworkError } from "@/lib/desk-offline";
import { lockOffline } from "./deskLocal";
import { refreshAsNewPerson } from "./useDesk";

function useLock() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const lock = async () => {
    setBusy(true);
    try {
      refreshAsNewPerson(qc, await desk.lock());
    } catch (e) {
      // No connection (M24 §22): lock on this device; the server locks by itself when the idle time runs out.
      if (isNetworkError(e)) lockOffline();
      else void qc.invalidateQueries({ queryKey: ["desk-mode"] });
    } finally {
      setBusy(false);
    }
  };
  return { lock, busy };
}

/**
 * Who is at the desk, at the top of the sidebar and of the phone menu (in place of the gym switcher: a desk
 * device has one gym), with Lock (M24 §21). Collapsed: the lock button only.
 */
export function DeskBar({ state, collapsed }: { state: OpenDesk; collapsed: boolean }) {
  const t = useTranslations("gd.bar");
  const { lock, busy } = useLock();
  const who = state.unlocked;
  if (!who) return null;
  if (collapsed)
    return (
      <Button variant="accent" onClick={() => void lock()} disabled={busy} aria-label={t("lock")} className="w-full px-0" data-testid="desk-lock-now">
        <LockKey size={20} weight="fill" aria-hidden />
      </Button>
    );
  return (
    <div className="rounded-card border border-line bg-surface p-3" data-testid="desk-bar">
      <p className="truncate text-xs font-semibold text-muted">{state.gym.name}</p>
      <div className="mt-2 flex items-center gap-3">
        <Avatar name={who.displayName ?? "?"} size={36} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-muted">{t("at")}</p>
          <p className="truncate font-semibold" data-testid="desk-who">
            {who.displayName}
          </p>
        </div>
        <Button variant="accent" size="md" onClick={() => void lock()} disabled={busy} className="shrink-0 px-3" data-testid="desk-lock-now">
          <LockKey size={18} weight="fill" aria-hidden />
          {t("lock")}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted">{t("hint", { minutes: state.idleMinutes })}</p>
    </div>
  );
}

/** Phones: Lock is always one tap away, bottom right, without opening the menu. */
export function DeskPhoneLock({ state }: { state: OpenDesk }) {
  const t = useTranslations("gd.bar");
  const { lock, busy } = useLock();
  if (!state.unlocked) return null;
  return (
    <div className="fixed bottom-[calc(16px+env(safe-area-inset-bottom))] right-4 z-40 md:hidden">
      <Button variant="accent" onClick={() => void lock()} disabled={busy} className="rounded-pill px-5 shadow-lg" data-testid="desk-lock-phone">
        <LockKey size={20} weight="fill" aria-hidden />
        {t("lock")}
      </Button>
    </div>
  );
}

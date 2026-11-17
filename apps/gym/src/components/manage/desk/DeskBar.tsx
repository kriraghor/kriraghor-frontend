"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { LockKey } from "@phosphor-icons/react";
import { Avatar, Button } from "@kriraghor/ui/kit";
import { desk, type OpenDesk } from "@/lib/desk";
import { refreshAsNewPerson } from "./useDesk";

/** Who is at the desk, in the sidebar's foot, with Lock (M24 §21). Collapsed: the lock button only. */
export function DeskBar({ state, collapsed }: { state: OpenDesk; collapsed: boolean }) {
  const t = useTranslations("gd.bar");
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const who = state.unlocked;
  const lock = async () => {
    setBusy(true);
    try {
      refreshAsNewPerson(qc, await desk.lock());
    } catch {
      void qc.invalidateQueries({ queryKey: ["desk-mode"] });
    } finally {
      setBusy(false);
    }
  };
  if (!who) return null;
  if (collapsed)
    return (
      <Button variant="secondary" onClick={() => void lock()} disabled={busy} aria-label={t("lock")} className="w-full px-0" data-testid="desk-lock-now">
        <LockKey size={20} weight="fill" aria-hidden />
      </Button>
    );
  return (
    <div className="rounded-card border border-line bg-surface p-3" data-testid="desk-bar">
      <div className="flex items-center gap-3">
        <Avatar name={who.displayName ?? "?"} size={36} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-muted">{t("at")}</p>
          <p className="truncate font-semibold" data-testid="desk-who">
            {who.displayName}
          </p>
        </div>
      </div>
      <Button variant="accent" size="md" onClick={() => void lock()} disabled={busy} className="mt-3 w-full" data-testid="desk-lock-now">
        <LockKey size={18} weight="fill" aria-hidden />
        {t("lock")}
      </Button>
      <p className="mt-2 text-xs text-muted">{t("hint", { minutes: state.idleMinutes })}</p>
    </div>
  );
}

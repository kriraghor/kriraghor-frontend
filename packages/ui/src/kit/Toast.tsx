"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle, Info, WarningCircle, X } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { cn } from "../cn";

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; tone: ToastTone; message: ReactNode };
type ToastApi = { show: (message: ReactNode, tone?: ToastTone) => void };

const ToastContext = createContext<ToastApi>({ show: () => undefined });

/** Brief confirmations ("Saved", "Copied"). Polite live region, never steals focus, gone after 4 s. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("kit");
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((all) => all.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (message: ReactNode, tone: ToastTone = "success") => {
      const id = ++seq.current;
      setItems((all) => [...all.slice(-2), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6">
        {items.map((it) => {
          const Icon = it.tone === "success" ? CheckCircle : it.tone === "error" ? WarningCircle : Info;
          return (
            <div key={it.id} role={it.tone === "error" ? "alert" : "status"} className="pointer-events-auto flex w-full max-w-sm animate-[kg-slide-in-up_220ms_var(--ease-kg)] items-center gap-3 rounded-[14px] bg-band px-4 py-3 text-sm font-medium text-band-text shadow-lg">
              <Icon size={20} weight="fill" aria-hidden className={cn("shrink-0", it.tone === "success" && "text-green-400", it.tone === "error" && "text-band-danger", it.tone === "info" && "text-band-info")} />
              <span className="min-w-0 flex-1">{it.message}</span>
              <button type="button" onClick={() => dismiss(it.id)} aria-label={t("close")} className="-mr-1 inline-flex size-8 items-center justify-center rounded-[8px] text-band-muted hover:text-band-text">
                <X size={16} aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

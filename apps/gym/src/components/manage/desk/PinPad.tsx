"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Backspace } from "@phosphor-icons/react";
import { cn } from "@kriraghor/ui/cn";

/**
 * Four dots and a keypad for a desk PIN (M24 §21). Works with the screen and with a keyboard (digits,
 * Backspace). Sends the PIN when the fourth digit is typed, then clears itself; `shake` replays the
 * wrong-PIN shake. The digits are never shown.
 */
export function PinPad({ onPin, busy = false, shake = 0, disabled = false, label }: { onPin: (pin: string) => void; busy?: boolean; shake?: number; disabled?: boolean; label: string }) {
  const t = useTranslations("gd.lock");
  const [pin, setPin] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const off = busy || disabled;

  // The keyboard listener is re-added each render, so `pin` here is always the current one.
  const press = (d: string) => {
    if (off || pin.length >= 4) return;
    const next = pin + d;
    if (next.length < 4) return setPin(next);
    // Sent: the pad clears at once for the next try; the dots stay full while the PIN is checked.
    setPin("");
    onPin(next);
  };
  const back = () => !off && setPin((p) => p.slice(0, -1));
  const shown = busy ? 4 : pin.length;

  // The keyboard works while the pad is on screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        press(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Replay the shake when a wrong PIN comes back.
  useEffect(() => {
    const el = box.current;
    if (!el || !shake || typeof el.animate !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate([{ transform: "translateX(0)" }, { transform: "translateX(-10px)" }, { transform: "translateX(10px)" }, { transform: "translateX(-6px)" }, { transform: "translateX(0)" }], { duration: 320, easing: "ease-out" });
  }, [shake]);

  const key = "flex h-16 items-center justify-center rounded-card bg-surface-2 font-display text-2xl font-bold text-ink transition-[transform,background-color] duration-150 hover:bg-line active:scale-95 disabled:opacity-40";
  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-center font-semibold" id="pin-label">
        {label}
      </p>
      <div ref={box} className="flex gap-4" role="status" aria-live="polite" aria-label={t("digits", { count: shown })} data-testid="pin-dots">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} aria-hidden className={cn("size-4 rounded-pill border-2 transition-colors duration-150", i < shown ? "border-brand bg-brand" : "border-line-strong")} />
        ))}
      </div>
      <div className="grid w-full max-w-[280px] grid-cols-3 gap-3" role="group" aria-label={t("keypad")} aria-describedby="pin-label">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" className={key} onClick={() => press(d)} disabled={off} data-testid={`pin-${d}`}>
            {d}
          </button>
        ))}
        <span aria-hidden />
        <button type="button" className={key} onClick={() => press("0")} disabled={off} data-testid="pin-0">
          0
        </button>
        <button type="button" className={cn(key, "bg-transparent hover:bg-surface-2")} onClick={back} disabled={off || !pin} aria-label={t("clear")} data-testid="pin-back">
          <Backspace size={24} aria-hidden />
        </button>
      </div>
    </div>
  );
}

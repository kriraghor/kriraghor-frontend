"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { cn } from "../cn";
import { playChime, readSoundSetting, subscribeSoundSetting, unlockAudio, writeSoundSetting } from "./sound";

/** The per-browser chime setting (on by default; on during server render). */
export function useSoundSetting(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribeSoundSetting, () => readSoundSetting(), () => true);
  return [on, (next: boolean) => writeSoundSetting(next)];
}

/**
 * "Play a sound for new notifications": a switch shown in the bell's footer (`compact`) and on the
 * notification settings page. Turning it on is a gesture, so it unlocks audio and plays a sample.
 */
export function SoundToggle({ compact = false, help }: { compact?: boolean; help?: string }) {
  const t = useTranslations("notifications");
  const [on, setOn] = useSoundSetting();
  const label = t("sound.label");

  const flip = () => {
    const next = !on;
    setOn(next);
    if (next) {
      unlockAudio();
      playChime();
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={flip}
      className={cn("flex w-full items-center gap-3 rounded-[9px] text-left", compact ? "min-h-9 px-2 text-sm font-semibold hover:bg-surface-2" : "min-h-11 py-1")}
      data-testid="notification-sound-toggle"
    >
      {compact ? on ? <SpeakerHigh size={18} aria-hidden /> : <SpeakerSlash size={18} aria-hidden /> : null}
      <span className="min-w-0 flex-1">
        <span className={cn("block", compact ? "" : "font-semibold")}>{label}</span>
        {help ? <span className="block text-sm font-normal text-muted">{help}</span> : null}
      </span>
      <span aria-hidden className={cn("relative inline-flex h-6 w-10 shrink-0 items-center rounded-pill transition-colors", on ? "bg-brand" : "bg-line")}>
        <span className={cn("absolute left-0.5 size-5 rounded-full bg-white shadow transition-transform", on ? "translate-x-4" : "translate-x-0")} />
      </span>
    </button>
  );
}

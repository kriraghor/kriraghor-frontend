"use client";

import type { ReactNode } from "react";
import { Badge, controlClass } from "@kriraghor/ui/kit";
import { KIT_TONE, type StatusTone } from "@/lib/status-tones";

/**
 * What is left of the old desk helpers, for the consoles and editors the page sweep (phase 5) has
 * not rebuilt yet. They render with the kit look; new code uses StatusBadge, the kit Field and
 * controlClass instead. Lists use the kit DataTable.
 */

/** Status chip with text (never colour alone): a kit Badge. */
export function Chip({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <Badge tone={KIT_TONE[tone]}>{children}</Badge>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
      {label}
      {children}
    </label>
  );
}

/** The kit control look without its full width, since callers add their own width. */
export const inputCls = controlClass.replace("w-full ", "");

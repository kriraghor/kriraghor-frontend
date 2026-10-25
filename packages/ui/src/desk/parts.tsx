import type { ReactNode } from "react";
import { Badge, controlClass } from "../kit";
import { KIT_TONE, type StatusTone } from "./access";

/**
 * The older desk helpers still used by the business editors (venues, gyms) on the business panel and
 * gym.kriraghor.com/manage. They render with the kit look; new code uses the kit Field and
 * controlClass directly.
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

/* eslint-disable @next/next/no-img-element -- small static layers that must stack exactly */
import { cn } from "../cn";

export type LogoMotion = "none" | "join" | "loop" | "live";

/**
 * The Kriraghor logo (the "K" of 23 Nov 2026) as its three pieces (the stem, the orange strokes, the lower
 * arm), stacked so they line up exactly (apps' public/brand, made by scripts/split-logo.mjs).
 *
 * Motion: `join` builds it once and pulses (splash); `loop` opens and closes the strokes (route loading);
 * `live` builds it quickly on load and opens the strokes when its link is hovered (header and footer).
 * Styles: @kriraghor/ui/styles/motion.css, all of it off for reduced motion.
 *
 * `size` is the mark's width; the box is 0.56 of that tall (the mark's shape).
 *
 * The black parts turn white with the dark theme. `onBand` keeps them white in either theme, for the
 * always-dark footer band.
 */
export function LogoMark({ size = 112, motion = "none", label, className, onBand }: { size?: number; motion?: LogoMotion; label?: string; className?: string; onBand?: boolean }) {
  const img = (cls: string, src: string) => <img className={cls} src={src} alt="" width={size} height={size} decoding="async" />;
  return (
    <span
      className={cn("kg-mark", motion === "join" && "kg-join", motion === "loop" && "kg-loop", motion === "live" && "kg-live", onBand && "kg-on-band", className)}
      style={{ ["--kg-mark" as string]: `${size}px` }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {img("kg-b kg-ink", "/brand/logo-stem.png")}
      {img("kg-b kg-ink-dark", "/brand/logo-stem-dark.png")}
      {img("kg-d kg-ink", "/brand/logo-lower.png")}
      {img("kg-d kg-ink-dark", "/brand/logo-lower-dark.png")}
      {img("kg-u", "/brand/logo-upper.png")}
    </span>
  );
}

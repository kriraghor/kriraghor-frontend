/* eslint-disable @next/next/no-img-element -- small static layers that must stack exactly */
import { cn } from "../cn";

export type LogoMotion = "none" | "join" | "loop" | "live";

/**
 * The Kriraghor logo as its three pieces (bottle with its ring, upper arm, lower arm), stacked so they
 * line up exactly (apps' public/brand, made by scripts/split-logo.mjs).
 *
 * Motion: `join` unfolds it once with a ripple from the ring (splash); `loop` opens and closes the arms
 * (route loading); `live` unfolds it quickly on load and opens the arms when its link is hovered (header
 * and footer). Styles: @kriraghor/ui/styles/motion.css, all of it off for reduced motion.
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
      {img("kg-b kg-ink", "/brand/logo-bottle.png")}
      {img("kg-b kg-ink-dark", "/brand/logo-bottle-dark.png")}
      {img("kg-d kg-ink", "/brand/logo-lower.png")}
      {img("kg-d kg-ink-dark", "/brand/logo-lower-dark.png")}
      {img("kg-u", "/brand/logo-upper.png")}
      {motion === "join" ? <span className="kg-ring" /> : null}
    </span>
  );
}

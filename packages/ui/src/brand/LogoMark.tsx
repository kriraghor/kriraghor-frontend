/* eslint-disable @next/next/no-img-element -- three small static layers that must stack exactly */
import { cn } from "../cn";

export type LogoMotion = "none" | "join" | "loop";

/**
 * The Kriraghor logo as its three pieces (cricket ball, shuttlecock, football), stacked so they
 * line up exactly (apps' public/brand, made by scripts/split-logo.mjs). `join` flies them in from
 * three sides once; `loop` drifts them apart and back (route loading). Styles: @kriraghor/ui/styles/motion.css.
 */
export function LogoMark({ size = 112, motion = "none", label, className }: { size?: number; motion?: LogoMotion; label?: string; className?: string }) {
  return (
    <span
      className={cn("kg-mark", motion === "join" && "kg-join", motion === "loop" && "kg-loop", className)}
      style={{ ["--kg-mark" as string]: `${size}px` }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <img className="kg-c" src="/brand/logo-cricket.png" alt="" width={size} height={size} decoding="async" />
      <img className="kg-s" src="/brand/logo-shuttle.png" alt="" width={size} height={size} decoding="async" />
      <img className="kg-f" src="/brand/logo-football.png" alt="" width={size} height={size} decoding="async" />
      {motion === "join" ? <span className="kg-ring" /> : null}
    </span>
  );
}

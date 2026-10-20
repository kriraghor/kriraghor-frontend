import { LogoMark } from "./LogoMark";

/** Route loading (loading.tsx): the logo's pieces drift apart and back, with a status for screen readers. */
export function LogoSpinner({ label, size = 56, className }: { label: string; size?: number; className?: string }) {
  return (
    <div role="status" aria-label={label} className={className ?? "flex min-h-[50vh] items-center justify-center"}>
      <LogoMark size={size} motion="loop" />
    </div>
  );
}

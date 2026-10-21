import type { ReactNode } from "react";
import { Badge } from "@kriraghor/ui/kit";
import { badgeTone, type StatusDomain } from "@/lib/status-tones";

/** A desk status as a kit Badge: the colour from status-tones, the text from the caller. */
export function StatusBadge({ status, domain, children, className }: { status: string | null | undefined; domain?: StatusDomain; children: ReactNode; className?: string }) {
  return (
    <Badge tone={badgeTone(status, domain)} className={className}>
      {children}
    </Badge>
  );
}

"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { isExternal } from "@kriraghor/session/links";
import { Link } from "../i18n/navigation";
import { cn } from "../cn";

/** "← My bookings" above a detail page (UI v2): the Phosphor arrow rather than a typed glyph, a full-size tap target. */
export function BackLink({ href, children, className, testId }: { href: string; children: ReactNode; className?: string; testId?: string }) {
  const cls = cn("group inline-flex min-h-11 items-center gap-1.5 rounded-control pr-2 text-sm font-semibold text-brand-text no-underline hover:underline", className);
  const inner = (
    <>
      <ArrowLeft size={16} weight="bold" aria-hidden className="shrink-0 transition-transform duration-150 group-hover:-translate-x-0.5" />
      {children}
    </>
  );
  if (isExternal(href))
    return (
      <a href={href} className={cls} data-testid={testId}>
        {inner}
      </a>
    );
  return (
    <Link href={href} className={cls} data-testid={testId}>
      {inner}
    </Link>
  );
}

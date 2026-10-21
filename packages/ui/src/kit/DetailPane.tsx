"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { X } from "@phosphor-icons/react";
import { cn } from "../cn";
import { Sheet } from "./Overlay";
import { XL, useMinWidth } from "./media";

/**
 * A list with a detail beside it (09 §8): at xl and up the detail is a sticky pane to the right of
 * the list; below xl it is a drawer from the right, so the list keeps the whole width. Closed, the
 * list takes the full width.
 */
export function DetailLayout({
  open,
  onClose,
  title,
  pane,
  children,
  width = 480,
  testId,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  pane: ReactNode;
  children: ReactNode;
  /** The pane's width at xl, in px. */
  width?: number;
  testId?: string;
  className?: string;
}) {
  const t = useTranslations("kit");
  const wide = useMinWidth(XL);
  if (!wide)
    return (
      <div className={className}>
        {children}
        <Sheet open={open} onOpenChange={(o) => (o ? undefined : onClose())} title={title} side="right" testId={testId}>
          <div className="px-5 pb-8">{pane}</div>
        </Sheet>
      </div>
    );
  return (
    <div className={cn("grid items-start gap-6", className)} style={{ gridTemplateColumns: open ? `minmax(0,1fr) ${width}px` : "minmax(0,1fr)" }}>
      <div className="min-w-0">{children}</div>
      {open ? (
        <aside className="sticky top-[84px] flex max-h-[calc(100dvh-100px)] flex-col overflow-hidden rounded-card border border-line bg-surface shadow-md" aria-label={typeof title === "string" ? title : undefined} data-testid={testId}>
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
            <h2 className="min-w-0 truncate font-display text-lg font-bold">{title}</h2>
            <button type="button" onClick={onClose} aria-label={t("close")} className="inline-flex size-10 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-ink" data-testid="pane-close">
              <X size={20} aria-hidden />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{pane}</div>
        </aside>
      ) : null}
    </div>
  );
}

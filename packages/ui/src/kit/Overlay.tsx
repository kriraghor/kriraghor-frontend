"use client";

import * as RDialog from "@radix-ui/react-dialog";
import * as RMenu from "@radix-ui/react-dropdown-menu";
import * as RTooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { cn } from "../cn";
import { useConfirm, type ConfirmSpec } from "./Confirm";

const scrim = "fixed inset-0 z-50 bg-scrim backdrop-blur-[2px] data-[state=open]:animate-[kg-fade-in_200ms_var(--ease-kg)] data-[state=closed]:animate-[kg-fade-out_140ms_ease-in]";

type DialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The element that opens it (a Button); left out when `open` is controlled. */
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/** A modal dialog (Radix): focus trapped and restored, Escape and the scrim close it. */
export function Dialog({ open, onOpenChange, trigger, title, description, children, footer, className }: DialogProps) {
  const t = useTranslations("kit");
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RDialog.Trigger asChild>{trigger}</RDialog.Trigger> : null}
      <RDialog.Portal>
        <RDialog.Overlay className={scrim} />
        <RDialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[min(88dvh,760px)] w-[calc(100vw-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-card border border-line bg-surface shadow-lg focus:outline-none",
            "data-[state=open]:animate-[kg-pop-in_220ms_var(--ease-kg)] data-[state=closed]:animate-[kg-fade-out_140ms_ease-in]",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
            <div>
              <RDialog.Title className="font-display text-xl font-bold">{title}</RDialog.Title>
              {description ? <RDialog.Description className="mt-1 text-sm text-muted">{description}</RDialog.Description> : <RDialog.Description className="sr-only">{title}</RDialog.Description>}
            </div>
            <RDialog.Close className="-mr-2 inline-flex size-10 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-ink" aria-label={t("close")}>
              <X size={20} aria-hidden />
            </RDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2">{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">{footer}</div> : null}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/** A panel that slides in from the left (navigation) or the bottom (actions on phones). */
export function Sheet({ open, onOpenChange, trigger, title, description, children, side = "left", className, testId }: DialogProps & { side?: "left" | "right" | "bottom"; testId?: string }) {
  const t = useTranslations("kit");
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RDialog.Trigger asChild>{trigger}</RDialog.Trigger> : null}
      <RDialog.Portal>
        <RDialog.Overlay className={scrim} />
        <RDialog.Content
          className={cn(
            "fixed z-50 flex flex-col bg-surface shadow-lg focus:outline-none",
            side === "left" && "inset-y-0 left-0 w-[min(320px,86vw)] rounded-r-card border-r border-line data-[state=open]:animate-[kg-slide-in-left_260ms_var(--ease-kg)] data-[state=closed]:animate-[kg-slide-out-left_180ms_ease-in]",
            side === "right" && "inset-y-0 right-0 w-[min(560px,100vw)] rounded-l-card border-l border-line data-[state=open]:animate-[kg-slide-in-right_260ms_var(--ease-kg)] data-[state=closed]:animate-[kg-slide-out-right_180ms_ease-in]",
            side === "bottom" && "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-card border-t border-line pb-[env(safe-area-inset-bottom)] data-[state=open]:animate-[kg-slide-in-up_260ms_var(--ease-kg)] data-[state=closed]:animate-[kg-slide-out-down_180ms_ease-in]",
            className,
          )}
          data-testid={testId}
        >
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <RDialog.Title className="font-display text-lg font-bold">{title}</RDialog.Title>
            <RDialog.Close className="inline-flex size-10 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-ink" aria-label={t("close")}>
              <X size={20} aria-hidden />
            </RDialog.Close>
          </div>
          {description ? <RDialog.Description className="px-5 text-sm text-muted">{description}</RDialog.Description> : <RDialog.Description className="sr-only">{title}</RDialog.Description>}
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/** Closes the surrounding Dialog or Sheet (wrap a Button or a link). */
export const DialogClose = RDialog.Close;

/** Tooltips need one provider near the root (Providers has it). */
export const TooltipProvider = RTooltip.Provider;

/** A short label on hover and keyboard focus; never the only place important text lives. */
export function Tooltip({ content, side = "top", children, disabled }: { content: ReactNode; side?: "top" | "right" | "bottom" | "left"; children: ReactNode; disabled?: boolean }) {
  if (disabled) return <>{children}</>;
  return (
    <RTooltip.Root delayDuration={250}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content side={side} sideOffset={8} className="z-50 rounded-[8px] bg-band px-2.5 py-1.5 text-xs font-semibold text-band-text shadow-md data-[state=delayed-open]:animate-[kg-fade-in_150ms_ease-out]">
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

/** A menu of actions from a button (Radix: arrow keys, type-ahead, Escape). */
export function Menu({ trigger, items, align = "end" }: { trigger: ReactNode; items: ({ label: ReactNode; icon?: ReactNode; onSelect: () => void; danger?: boolean; confirm?: ConfirmSpec } | "separator")[]; align?: "start" | "end" }) {
  const ask = useConfirm();
  return (
    <RMenu.Root>
      <RMenu.Trigger asChild>{trigger}</RMenu.Trigger>
      <RMenu.Portal>
        <RMenu.Content align={align} sideOffset={6} className="z-50 min-w-48 rounded-[14px] border border-line bg-surface p-1.5 shadow-lg data-[state=open]:animate-[kg-pop-in_160ms_var(--ease-kg)]">
          {items.map((it, i) =>
            it === "separator" ? (
              <RMenu.Separator key={i} className="my-1 h-px bg-line" />
            ) : (
              <RMenu.Item
                key={i}
                onSelect={it.confirm ? () => void ask(it.confirm!).then((ok) => ok && it.onSelect()) : it.onSelect}
                className={cn("flex min-h-10 cursor-pointer select-none items-center gap-2.5 rounded-[9px] px-3 text-sm font-medium outline-none data-[highlighted]:bg-surface-2", it.danger && "text-danger")}
              >
                {it.icon ? <span className="[&>svg]:size-[18px]">{it.icon}</span> : null}
                {it.label}
              </RMenu.Item>
            ),
          )}
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  );
}

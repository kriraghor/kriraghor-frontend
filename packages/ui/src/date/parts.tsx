"use client";

import * as RPopover from "@radix-ui/react-popover";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode, type RefObject } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { cn } from "../cn";
import { controlClass } from "../kit/Form";
import { Sheet } from "../kit/Overlay";
import { useMinWidth } from "../kit/media";

/** Below this width the calendar opens as a bottom sheet, so it never runs off a phone screen. */
export const SHEET_BELOW = 640;

/** What every picker shares with the kit's text fields: label above, hint or error below. */
export type PickerChrome = {
  id: string;
  label: ReactNode;
  /** Keeps the label for screen readers only (a compact row that names the field elsewhere). */
  labelHidden?: boolean;
  hint?: ReactNode;
  error?: string;
  /** The "Optional" note next to the label. */
  optional?: string;
  className?: string;
  /** data-testid, put on the trigger (the element tests click). */
  testId?: string;
  /** Posts the value under this name when the picker sits in a native form that reads FormData. */
  name?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
};

export const describedBy = (id: string, hint?: ReactNode, error?: string) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

/** The kit's FieldShell with a label id, so the trigger can be named "label + value". */
export function PickerShell({ id, label, labelHidden, hint, error, optional, className, children }: Pick<PickerChrome, "id" | "label" | "labelHidden" | "hint" | "error" | "optional" | "className"> & { children: ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label id={`${id}-label`} htmlFor={id} className={cn("flex items-baseline justify-between gap-2 text-sm font-semibold text-ink", labelHidden && "sr-only")}>
        <span>{label}</span>
        {optional ? <span className="text-xs font-normal text-muted">{optional}</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1.5 text-sm text-danger">
          <WarningCircle size={16} weight="fill" aria-hidden className="shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type TriggerProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  id: string;
  testId?: string;
  open: boolean;
  invalid?: boolean;
  display: string;
  placeholder: string;
  icon: ReactNode;
};

/**
 * The field-looking button that opens a picker: same height, border, radius and focus ring as the
 * kit's text inputs. Its name is the label plus the shown value ("Date, Mon 2 Nov 2026").
 */
export const PickerTrigger = forwardRef<HTMLButtonElement, TriggerProps>(function PickerTrigger({ id, testId, open, invalid, display, placeholder, icon, className, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      id={id}
      data-testid={testId}
      aria-haspopup="dialog"
      aria-expanded={open}
      data-invalid={invalid || undefined}
      aria-labelledby={`${id}-label ${id}-value`}
      data-state={open ? "open" : "closed"}
      className={cn(controlClass, "flex items-center justify-between gap-2 text-left data-[invalid=true]:border-danger data-[state=open]:border-brand data-[state=open]:ring-4 data-[state=open]:ring-brand/15", className)}
      {...rest}
    >
      <span id={`${id}-value`} className={cn("min-w-0 truncate", display ? "text-ink" : "text-muted")}>
        {display || placeholder}
      </span>
      <span className="shrink-0 text-muted [&>svg]:size-5" aria-hidden>
        {icon}
      </span>
    </button>
  );
});

/**
 * A hidden copy of the value for native forms (FormData, `required`). It is a real text input, not
 * type=hidden, so the browser's required check still runs; when it fails, focus goes to the trigger.
 */
export function FormValue({ name, value, required, trigger }: { name?: string; value: string; required?: boolean; trigger: RefObject<HTMLButtonElement | null> }) {
  if (!name && !required) return null;
  return (
    <input
      tabIndex={-1}
      aria-hidden
      name={name}
      value={value}
      required={required}
      onChange={() => undefined}
      onFocus={() => trigger.current?.focus()}
      className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0"
    />
  );
}

/**
 * Where a picker's panel opens: a popover under the trigger on wider screens, the kit's bottom
 * Sheet on phones (< 640 px). Focus goes into the panel and back to the trigger on close.
 */
export function PickerSurface({
  open,
  onOpenChange,
  trigger,
  title,
  children,
  testId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  title: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  const wide = useMinWidth(SHEET_BELOW, true);
  if (!wide)
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={onOpenChange} side="bottom" title={title} testId={testId}>
          <div className="flex justify-center px-4 pb-5">{children}</div>
        </Sheet>
      </>
    );
  return (
    <RPopover.Root open={open} onOpenChange={onOpenChange}>
      <RPopover.Trigger asChild>{trigger}</RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content
          align="start"
          sideOffset={6}
          collisionPadding={16}
          // The calendar focuses the chosen day (or today) itself.
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="z-50 max-w-[calc(100vw-32px)] rounded-card border border-line bg-surface p-3 text-ink shadow-lg outline-none data-[state=open]:animate-[kg-pop-in_160ms_var(--ease-kg)] data-[state=closed]:animate-[kg-fade-out_120ms_ease-in]"
          data-testid={testId}
        >
          {children}
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}

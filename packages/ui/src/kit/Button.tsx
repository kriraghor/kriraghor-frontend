"use client";

import { forwardRef, type AnchorHTMLAttributes, type MouseEvent, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { isExternal } from "@kriraghor/session/links";
import { Link } from "../i18n/navigation";
import { cn } from "../cn";
import { useConfirm, type ConfirmSpec } from "./Confirm";

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "prize" | "link";
export type ButtonSize = "sm" | "md" | "lg";

/** The one button look (09 §7): 12px corners, 44px+ targets (sm is for dense tables only), press feedback. */
export function buttonClass({ variant = "primary", size = "md", block = false }: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean } = {}) {
  if (variant === "link") return "inline-flex items-center gap-1.5 font-semibold text-brand-text underline-offset-4 hover:underline disabled:opacity-50";
  return cn(
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-semibold no-underline",
    "transition-[background-color,border-color,box-shadow,transform] duration-150 ease-[var(--ease-kg)] active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    size === "sm" && "min-h-9 px-3 text-sm",
    size === "md" && "min-h-11 px-4 text-[15px]",
    size === "lg" && "min-h-12 px-5 text-base",
    block && "w-full",
    variant === "primary" && "bg-brand text-on-brand shadow-[0_6px_18px_-10px_rgb(11_122_75/0.7)] hover:bg-brand-hover",
    variant === "secondary" && "border border-line-strong/60 bg-surface text-ink hover:border-line-strong hover:bg-surface-2",
    variant === "ghost" && "text-ink hover:bg-surface-2",
    variant === "danger" && "bg-danger text-white hover:opacity-90",
    variant === "prize" && "bg-prize text-prize-ink hover:brightness-105",
    // UI v2: the one call to start a task that matters (the logo's orange, dark text; amber outside v2).
    variant === "accent" && "bg-accent text-on-accent shadow-[0_6px_18px_-10px_var(--kg-accent)] hover:bg-accent-hover",
  );
}

type Common = { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; icon?: ReactNode; iconEnd?: ReactNode };

/**
 * `confirm` asks first (tester feedback, 19 Nov 2026): the click opens the confirm dialog, and only a
 * yes runs onClick or submits the form (Enter in a field clicks the submit button, so it asks too).
 */
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & Common & { busy?: boolean; confirm?: ConfirmSpec };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant, size, block, icon, iconEnd, busy, className, children, type = "submit", disabled, confirm, onClick, ...rest }, ref) {
  const ask = useConfirm();
  const click = confirm
    ? async (e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        const btn = e.currentTarget;
        if (!(await ask(confirm))) return;
        onClick?.(e);
        if (type === "submit" && btn.form) btn.form.requestSubmit(btn);
      }
    : onClick;
  return (
    <button ref={ref} type={type} disabled={busy || disabled} aria-busy={busy || undefined} className={cn(buttonClass({ variant, size, block }), className)} onClick={click} {...rest}>
      {busy ? <CircleNotch size={18} className="animate-spin" aria-hidden /> : icon}
      {children}
      {iconEnd}
    </button>
  );
});

/** A link that looks like a button: app routes go through next-intl, other sites stay plain links. */
export function ButtonLink({ href, variant, size, block, icon, iconEnd, className, children, ...rest }: Common & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; children: ReactNode }) {
  const cls = cn(buttonClass({ variant, size, block }), className);
  if (isExternal(href)) {
    return (
      <a href={href} className={cls} {...rest}>
        {icon}
        {children}
        {iconEnd}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...(rest as Omit<ComponentProps<typeof Link>, "href">)}>
      {icon}
      {children}
      {iconEnd}
    </Link>
  );
}

/** A square icon-only button; `label` is its accessible name (and tooltip text when wrapped in Tooltip). */
export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; variant?: "ghost" | "secondary"; children: ReactNode }>(function IconButton(
  { label, variant = "ghost", className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-control text-ink transition-colors duration-150",
        variant === "ghost" ? "hover:bg-surface-2" : "border border-line bg-surface hover:bg-surface-2",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

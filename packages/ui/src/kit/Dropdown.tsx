"use client";

import * as RSelect from "@radix-ui/react-select";
import type { ReactNode } from "react";
import { CaretDown, Check } from "@phosphor-icons/react";
import { cn } from "../cn";

export type DropdownOption = { value: string; label: string; icon?: ReactNode; hint?: string };

/** Radix Select needs a non-empty value; "Any …" is this sentinel and becomes "" for callers. */
const ANY = "__any__";

/**
 * A good-looking single choice (Radix Select): a rounded control with a caret, and a menu card
 * with a tick on the chosen option, icons, keyboard and type-ahead, opening with a short scale.
 * `anyLabel` adds a first "Any …" option that means "" (no filter). For long forms, Select stays.
 */
export function Dropdown({
  id,
  label,
  value,
  onChange,
  options,
  anyLabel,
  placeholder,
  className,
  testId,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  anyLabel?: string;
  placeholder?: string;
  className?: string;
  testId?: string;
}) {
  const all: DropdownOption[] = anyLabel ? [{ value: ANY, label: anyLabel }, ...options] : options;
  const current = value || (anyLabel ? ANY : "");
  const chosen = all.find((o) => o.value === current);
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-muted">
        {label}
      </label>
      <RSelect.Root value={current || undefined} onValueChange={(v) => onChange(v === ANY ? "" : v)}>
        <RSelect.Trigger
          id={id}
          data-testid={testId}
          className="group flex min-h-12 w-full items-center justify-between gap-2 rounded-control border border-line-strong/70 bg-surface px-3.5 text-left text-base text-ink transition-[border-color,box-shadow] duration-150 hover:border-line-strong focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 data-[state=open]:border-brand data-[state=open]:ring-4 data-[state=open]:ring-brand/15"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            {chosen?.icon ? <span className="shrink-0 text-brand-text [&>svg]:size-5">{chosen.icon}</span> : null}
            <span className="truncate">
              <RSelect.Value placeholder={placeholder} />
            </span>
          </span>
          <RSelect.Icon>
            <CaretDown size={18} aria-hidden className="text-muted transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </RSelect.Icon>
        </RSelect.Trigger>
        <RSelect.Portal>
          <RSelect.Content
            position="popper"
            sideOffset={6}
            className="z-50 max-h-[min(360px,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] min-w-48 overflow-hidden rounded-[14px] border border-line bg-surface p-1.5 shadow-lg data-[state=open]:animate-[kg-pop-in_160ms_var(--ease-kg)]"
          >
            <RSelect.Viewport>
              {all.map((o) => (
                <RSelect.Item
                  key={o.value}
                  value={o.value}
                  className="relative flex min-h-11 cursor-pointer select-none items-center gap-2.5 rounded-[9px] py-2 pl-3 pr-9 text-[15px] text-ink outline-none data-[highlighted]:bg-surface-2 data-[state=checked]:bg-brand-soft data-[state=checked]:font-semibold data-[state=checked]:text-brand-text"
                >
                  {o.icon ? <span className="shrink-0 [&>svg]:size-5">{o.icon}</span> : null}
                  <span className="min-w-0">
                    <RSelect.ItemText>{o.label}</RSelect.ItemText>
                    {o.hint ? <span className="block text-xs font-normal text-muted">{o.hint}</span> : null}
                  </span>
                  <RSelect.ItemIndicator className="absolute right-3">
                    <Check size={18} weight="bold" aria-hidden />
                  </RSelect.ItemIndicator>
                </RSelect.Item>
              ))}
            </RSelect.Viewport>
          </RSelect.Content>
        </RSelect.Portal>
      </RSelect.Root>
    </div>
  );
}

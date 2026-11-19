"use client";

import { useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Faders, MagnifyingGlass, X } from "@phosphor-icons/react";
import { cn } from "../cn";
import { Button } from "./Button";
import { Chip } from "./Display";
import { Dropdown, type DropdownOption } from "./Dropdown";
import { controlClass } from "./Form";
import { Sheet } from "./Overlay";
import { MD, useMinWidth } from "./media";

export type FilterSelect = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
  /** The "no filter" option's label (defaults to "Any"). */
  anyLabel?: string;
};

export type FilterBarProps = {
  /** Debounced free text (300 ms); `value` is what the list filters on. */
  search?: { value: string; onChange: (v: string) => void; label: string; placeholder?: string; testId?: string };
  /**
   * One-of chips with counts, e.g. statuses. "" is "all". More than CHIPS_MAX options show as a dropdown
   * in the filter row instead of a scrolling row of chips (tester feedback, 19 Nov 2026).
   */
  chips?: { value: string; onChange: (v: string) => void; label: string; options: { value: string; label: string; count?: number }[]; testId?: string };
  selects?: FilterSelect[];
  /** Extra controls (a checkbox, a date range) placed with the selects. */
  extra?: ReactNode;
  /** Clears every filter; shown when something is set. */
  onClear?: () => void;
  /** Buttons on the right (export, create). */
  actions?: ReactNode;
  className?: string;
};

export const SEARCH_DEBOUNCE_MS = 300;

/**
 * The desk filter bar (09 §8): status chips with counts, a debounced search, dropdown filters, the
 * active filters as removable chips and "Clear filters". Values live with the caller (the URL).
 * On phones the dropdowns and extra fields fold into a "Filters (n)" sheet, so the rows come first.
 */
const CHIPS_MAX = 4;

export function FilterBar({ search, chips, selects = [], extra, onClear, actions, className }: FilterBarProps) {
  const t = useTranslations("kit.filters");
  const active = selects.filter((s) => s.value);
  const anything = Boolean(search?.value) || active.length > 0 || Boolean(chips?.value);
  const wide = useMinWidth(MD);
  const [sheet, setSheet] = useState(false);
  const fold = !wide && (selects.length > 0 || Boolean(extra));
  const chipDropdown = chips && chips.options.length > CHIPS_MAX ? chips : null;
  const allOption = chipDropdown?.options.find((o) => o.value === "");
  const chipField = chipDropdown ? (
    <div className="w-full min-w-44 sm:w-56" data-testid={chipDropdown.testId}>
      <Dropdown
        id="filter-view"
        label={chipDropdown.label}
        value={chipDropdown.value}
        onChange={chipDropdown.onChange}
        options={chipDropdown.options.filter((o) => o.value !== "").map((o) => ({ value: o.value, label: o.count != null ? `${o.label} (${o.count})` : o.label }))}
        anyLabel={allOption ? (allOption.count != null ? `${allOption.label} (${allOption.count})` : allOption.label) : t("any")}
        testId="filter-view"
      />
    </div>
  ) : null;
  const fields = (
    <>
      {selects.map((s) => (
        <div key={s.id} className="w-full min-w-40 sm:w-48">
          <Dropdown id={`filter-${s.id}`} label={s.label} value={s.value} onChange={s.onChange} options={s.options} anyLabel={s.anyLabel ?? t("any")} testId={`filter-${s.id}`} />
        </div>
      ))}
      {extra}
    </>
  );
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {chips && !chipDropdown ? (
        <div role="group" aria-label={chips.label} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" data-testid={chips.testId}>
          {chips.options.map((o) => (
            <Chip key={o.value || "all"} active={chips.value === o.value} count={o.count} onClick={() => chips.onChange(o.value)} className="min-h-10 shrink-0" data-testid={`chip-${o.value || "all"}`}>
              {o.label}
            </Chip>
          ))}
        </div>
      ) : null}
      {search || selects.length || extra || actions || chipField ? (
        <div className="flex flex-wrap items-end gap-2">
          {chipField}
          {search ? <SearchBox {...search} /> : null}
          {fold ? (
            <Button type="button" variant="secondary" icon={<Faders size={18} aria-hidden />} onClick={() => setSheet(true)} data-testid="filters-open">
              {active.length ? t("moreCount", { n: active.length }) : t("more")}
            </Button>
          ) : (
            fields
          )}
          {actions ? <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {anything && onClear ? (
        <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="active-filters">
          {search?.value ? <ActiveChip label={`${search.label}: “${search.value}”`} onRemove={() => search.onChange("")} /> : null}
          {active.map((s) => (
            <ActiveChip key={s.id} label={`${s.label}: ${optionLabel(s)}`} onRemove={() => s.onChange("")} />
          ))}
          <button type="button" onClick={onClear} className="min-h-9 rounded-control px-2 font-semibold text-brand-text hover:underline" data-testid="clear-filters">
            {t("clear")}
          </button>
        </div>
      ) : null}
      {fold ? (
        <Sheet open={sheet} onOpenChange={setSheet} side="bottom" title={t("more")} testId="filters-sheet">
          <div className="flex flex-col gap-4 px-5 pb-4">{fields}</div>
          <div className="sticky bottom-0 border-t border-line bg-surface px-5 py-3">
            <Button type="button" block onClick={() => setSheet(false)} data-testid="filters-done">
              {t("done")}
            </Button>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

const optionLabel = (s: FilterSelect) => {
  const o = s.options.find((x) => x.value === s.value);
  return typeof o?.label === "string" ? o.label : s.value;
};

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const t = useTranslations("kit.filters");
  return (
    <span className="inline-flex min-h-9 items-center gap-1 rounded-pill border border-line bg-surface pl-3 pr-1 font-medium">
      {label}
      <button type="button" onClick={onRemove} aria-label={t("remove", { label })} className="inline-flex size-7 items-center justify-center rounded-pill text-muted hover:bg-surface-2 hover:text-ink">
        <X size={14} weight="bold" aria-hidden />
      </button>
    </span>
  );
}

/** The search field: typing is local, the caller hears about it 300 ms after the last key. */
function SearchBox({ value, onChange, label, placeholder, testId }: NonNullable<FilterBarProps["search"]>) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A change from outside (Clear filters, the back button) replaces what is typed.
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  const type = (v: string) => {
    setDraft(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(v.trim()), SEARCH_DEBOUNCE_MS);
  };
  return (
    <label className="flex w-full flex-col gap-1.5 text-sm font-semibold sm:w-72">
      {label}
      <span className="relative">
        <MagnifyingGlass size={18} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={draft}
          onChange={(e) => type(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (timer.current) clearTimeout(timer.current);
            onChange(draft.trim());
          }}
          placeholder={placeholder}
          className={cn(controlClass, "pl-10 font-normal")}
          data-testid={testId}
        />
      </span>
    </label>
  );
}

"use client";

import { Fragment, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowsInLineVertical, CaretDown, CaretUp, CaretUpDown, DotsThree, Tray } from "@phosphor-icons/react";
import { cn } from "../cn";
import { usePref } from "../prefs";
import type { ConfirmSpec } from "./Confirm";
import { Button } from "./Button";
import { EmptyState, ErrorState, Skeleton } from "./Display";
import { Menu, Tooltip } from "./Overlay";
import { MD, useMinWidth } from "./media";

export type MenuItem = { label: ReactNode; icon?: ReactNode; onSelect: () => void; danger?: boolean; confirm?: ConfirmSpec } | "separator";

export type Column<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** The label on phone cards when `header` is not plain text. */
  label?: string;
  align?: "start" | "end" | "center";
  /** A CSS width for the column (e.g. "9rem"); the rest share the space. */
  width?: string;
  /** Makes the column sortable on this value (client side, see `complete`). */
  sort?: (row: T) => string | number | null | undefined;
  /** Hidden in the table below this width (still shown on phone cards). */
  hideBelow?: "lg" | "xl";
  /** The card title on phones (the first column when none is marked). */
  primary?: boolean;
  /** This column's figure in the totals row, from every row (shown only when the list is complete). */
  total?: (rows: T[]) => ReactNode;
};

/** A row's tone (with a badge in a cell saying why: never colour alone) and its data-* attributes. */
export type RowProps = { tone?: "danger" | "warning" | "muted"; data?: Record<string, string> };

type Sort = { id: string; dir: "asc" | "desc" } | null;

export type DataTableProps<T> = {
  /** The table's accessible name. */
  label: string;
  columns: Column<T>[];
  rows: T[] | undefined;
  rowId: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: { title: ReactNode; body?: ReactNode; action?: ReactNode; icon?: ReactNode };
  /** Opens a row (detail pane, drawer or page); rows become focusable and Enter or Space opens them. */
  onRowClick?: (row: T) => void;
  selectedId?: string | null;
  rowActions?: (row: T) => MenuItem[];
  rowTestId?: string | ((row: T) => string);
  /** A row's tone and data-* attributes (dashboards round 4). */
  rowProps?: (row: T) => RowProps;
  /** Content shown under a row across all columns (expanding rows), or null. */
  expanded?: (row: T) => ReactNode | null;
  /** Cursor paging: more rows on the server. */
  hasMore?: boolean;
  onMore?: () => void;
  busy?: boolean;
  /** The server's total, when it gives one ("Showing 50 of 312"). */
  total?: number | null;
  /**
   * Every row is loaded, so sorting is honest. Defaults to !hasMore. Desk endpoints don't sort, so
   * a partly loaded list is never shown as sorted.
   */
  complete?: boolean;
  /** Caps the table's height (e.g. "60vh") so it scrolls inside with the header and totals in view. */
  maxHeight?: string;
  /** Replaces the footer's "Load more" button (screens that keep their own button and test id). */
  more?: ReactNode;
  testId?: string;
  className?: string;
};

export type Density = "comfortable" | "compact";
export const DENSITY_KEY = "kg.table.density";
const DENSITIES = ["comfortable", "compact"] as const;

const ALIGN = { start: "text-left", end: "text-right", center: "text-center" } as const;
const HIDE = { lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" } as const;
const TONE = { danger: "bg-danger-soft/50", warning: "bg-warning-soft/60", muted: "text-muted" } as const;
const PAD = {
  comfortable: { th: "px-4 py-2.5", td: "px-4 py-3", card: "px-4 py-3", text: "text-sm" },
  compact: { th: "px-3 py-1.5", td: "px-3 py-1.5", card: "px-4 py-2", text: "text-[13px]" },
} as const;
const INTERACTIVE = "a,button,input,select,textarea,label,[role=menuitem],[role=checkbox],[data-row-ignore]";

/** Clicks on links, buttons and fields inside a row do their own thing, not open the row. */
const fromControl = (e: MouseEvent | KeyboardEvent) => e.target instanceof Element && e.target !== e.currentTarget && Boolean(e.target.closest(INTERACTIVE));

const dataAttrs = (data?: Record<string, string>) => Object.fromEntries(Object.entries(data ?? {}).map(([k, v]) => [`data-${k}`, v]));

function compare(a: string | number | null | undefined, b: string | number | null | undefined) {
  if (a === b) return 0;
  if (a === null || a === undefined || a === "") return 1; // blanks last either way
  if (b === null || b === undefined || b === "") return -1;
  return typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

/** Sorts a copy of the rows by a column (blanks last), keeping the server order for ties. */
export function sortRows<T>(rows: T[], columns: Column<T>[], sort: Sort): T[] {
  const col = sort ? columns.find((c) => c.id === sort.id && c.sort) : undefined;
  if (!sort || !col?.sort) return rows;
  const by = col.sort;
  return rows
    .map((row, i) => ({ row, i, v: by(row) }))
    .sort((x, y) => {
      const blank = (v: unknown) => v === null || v === undefined || v === "";
      if (blank(x.v) !== blank(y.v)) return blank(x.v) ? 1 : -1;
      const c = compare(x.v, y.v);
      return (sort.dir === "asc" ? c : -c) || x.i - y.i;
    })
    .map((x) => x.row);
}

/** The saved table density, shared by every table in the browser. */
export const useDensity = () => usePref<Density>(DENSITY_KEY, "comfortable", DENSITIES);

/**
 * The desk table (kriraghor-docs 09 §8, dashboards round 4): columns, loading rows in the table's
 * shape, empty and error states, rows that open a detail, a per-row actions menu, expanding rows,
 * row tones, a totals row, honest client sorting, Load more for cursor lists, a remembered density,
 * and cards instead of sideways scrolling on phones.
 */
export function DataTable<T>(props: DataTableProps<T>) {
  const { label, columns, rows, rowId, loading, error, onRetry, empty, onRowClick, selectedId, rowActions, expanded, hasMore, onMore, busy, total, maxHeight, testId, className } = props;
  const t = useTranslations("kit.table");
  const wide = useMinWidth(MD);
  const [sort, setSort] = useState<Sort>(null);
  const [density, setDensity] = useDensity();
  const pad = PAD[density];
  const complete = props.complete ?? !hasMore;
  const shown = complete ? sortRows(rows ?? [], columns, sort) : (rows ?? []);
  const tid = (row: T) => (typeof props.rowTestId === "function" ? props.rowTestId(row) : props.rowTestId);
  const totals = columns.some((c) => c.total);
  const span = columns.length + (rowActions ? 1 : 0);

  const open = (row: T) => (e: MouseEvent) => {
    if (onRowClick && !fromControl(e)) onRowClick(row);
  };
  const openKey = (row: T) => (e: KeyboardEvent) => {
    if (!onRowClick || fromControl(e) || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    onRowClick(row);
  };
  const cycle = (id: string) => setSort((s) => (s?.id !== id ? { id, dir: "asc" } : s.dir === "asc" ? { id, dir: "desc" } : null));
  const actions = (row: T) => {
    const items = rowActions?.(row) ?? [];
    if (!items.length) return null;
    return (
      <Menu
        trigger={
          <button type="button" className="inline-flex size-9 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-ink" aria-label={t("actions")} data-testid="row-actions">
            <DotsThree size={22} weight="bold" aria-hidden />
          </button>
        }
        items={items}
      />
    );
  };

  if (error && !rows?.length) return <ErrorState className={className} onRetry={onRetry} />;

  const compact = density === "compact";
  const densitySwitch = (
    <Tooltip content={t("compact")}>
      <button
        type="button"
        onClick={() => setDensity(compact ? "comfortable" : "compact")}
        aria-pressed={compact}
        aria-label={t("compact")}
        className={cn("inline-flex size-8 items-center justify-center rounded-control hover:bg-surface-2 hover:text-ink", compact ? "bg-surface-2 text-ink" : "text-muted")}
        data-testid="table-density"
      >
        <ArrowsInLineVertical size={16} aria-hidden />
      </button>
    </Tooltip>
  );

  const footer = (rows?.length ?? 0) > 0 ? (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-sm text-muted print:hidden">
      <span role="status">{total != null ? t("showing", { n: rows!.length, total }) : hasMore ? t("loaded", { n: rows!.length }) : t("showingAll", { n: rows!.length })}</span>
      <span className="flex items-center gap-2">
        {props.more ??
          (hasMore && onMore ? (
            <Button type="button" variant="secondary" size="sm" busy={busy} onClick={onMore} data-testid="load-more">
              {t("loadMore")}
            </Button>
          ) : null)}
        {densitySwitch}
      </span>
    </div>
  ) : null;

  const headCells = (sortable: boolean) =>
    columns.map((c) => {
      const on = sort?.id === c.id ? sort.dir : null;
      return (
        <th
          key={c.id}
          scope="col"
          style={c.width ? { width: c.width } : undefined}
          aria-sort={!sortable ? undefined : on ? (on === "asc" ? "ascending" : "descending") : c.sort && complete ? "none" : undefined}
          className={cn("whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-muted", pad.th, ALIGN[c.align ?? "start"], c.hideBelow && HIDE[c.hideBelow])}
        >
          {c.sort && sortable ? (
            <Tooltip content={t("sortHint")} disabled={complete}>
              <button
                type="button"
                onClick={() => complete && cycle(c.id)}
                aria-disabled={!complete || undefined}
                className={cn("inline-flex items-center gap-1 uppercase", complete ? "hover:text-ink" : "cursor-not-allowed", c.align === "end" && "flex-row-reverse")}
                data-testid={`sort-${c.id}`}
              >
                {c.header}
                {on === "asc" ? <CaretUp size={14} weight="bold" aria-hidden /> : on === "desc" ? <CaretDown size={14} weight="bold" aria-hidden /> : <CaretUpDown size={14} aria-hidden className="opacity-50" />}
              </button>
            </Tooltip>
          ) : (
            c.header
          )}
        </th>
      );
    });
  const head = (sortable: boolean) => (
    <thead className="sticky top-0 z-[1] bg-surface-2/95 backdrop-blur">
      <tr>
        {headCells(sortable)}
        {rowActions ? (
          <th scope="col" className="w-12 px-2">
            <span className="sr-only">{t("actions")}</span>
          </th>
        ) : null}
      </tr>
    </thead>
  );
  const scrollBox = cn(maxHeight ? "overflow-auto" : "overflow-x-auto");
  const boxStyle = maxHeight ? { maxHeight } : undefined;

  // Loading: rows in the table's own shape (cards on phones); static under reduced motion (.kg-shimmer).
  const skeleton = wide ? (
    <div role="status" aria-label={t("loading")} className={scrollBox} style={boxStyle}>
      <table className={cn("w-full border-collapse", pad.text)} aria-hidden>
        {head(false)}
        <tbody>
          {[0, 1, 2, 3, 4, 5].map((r) => (
            <tr key={r} className="border-t border-line" data-testid="skeleton-row">
              {columns.map((c, i) => (
                <td key={c.id} className={cn(pad.td, c.hideBelow && HIDE[c.hideBelow])}>
                  <Skeleton className={cn("h-4", c.align === "end" ? "ml-auto w-16" : c.align === "center" ? "mx-auto w-12" : i === 0 ? "w-3/4" : "w-1/2")} />
                </td>
              ))}
              {rowActions ? <td className="px-2" /> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <ul role="status" aria-label={t("loading")} className="flex flex-col divide-y divide-line">
      {[0, 1, 2, 3].map((r) => (
        <li key={r} className={cn("flex flex-col gap-2", pad.card)} data-testid="skeleton-row">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </li>
      ))}
    </ul>
  );

  const totalsFoot = totals ? (
    <tfoot className={cn("bg-surface-2/95 backdrop-blur", maxHeight && "sticky bottom-0")} data-testid="table-totals">
      <tr className="border-t-2 border-line font-semibold">
        {complete ? (
          <>
            {columns.map((c, i) => (
              <td key={c.id} className={cn(pad.td, ALIGN[c.align ?? "start"], c.hideBelow && HIDE[c.hideBelow], c.align === "end" && "tabular")}>
                {c.total ? c.total(rows ?? []) : i === 0 ? t("total") : null}
              </td>
            ))}
            {rowActions ? <td /> : null}
          </>
        ) : (
          <td colSpan={span} className={cn(pad.td, "font-normal text-muted")}>
            {t("totalsWhenComplete")}
          </td>
        )}
      </tr>
    </tfoot>
  ) : null;

  const body = loading && !rows?.length ? (
    skeleton
  ) : !rows?.length ? (
    <EmptyState className="m-4 border-0" icon={empty?.icon ?? <Tray weight="duotone" aria-hidden />} title={empty?.title ?? t("empty")} body={empty?.body} action={empty?.action} />
  ) : wide ? (
    <div className={scrollBox} style={boxStyle}>
      <table className={cn("w-full border-collapse", pad.text)} aria-label={label}>
        {head(true)}
        <tbody>
          {shown.map((row) => {
            const id = rowId(row);
            const sel = selectedId != null && selectedId === id;
            const more = expanded?.(row) ?? null;
            const rp = props.rowProps?.(row);
            return (
              <Fragment key={id}>
                <tr
                  onClick={onRowClick ? open(row) : undefined}
                  onKeyDown={onRowClick ? openKey(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-selected={onRowClick ? sel : undefined}
                  className={cn(
                    "border-t border-line align-middle transition-colors hover:bg-surface-2/50",
                    rp?.tone && TONE[rp.tone],
                    onRowClick && "cursor-pointer hover:bg-surface-2/80 focus-visible:bg-surface-2 focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--kg-brand)]",
                    sel && "bg-brand-soft hover:bg-brand-soft",
                  )}
                  data-testid={tid(row)}
                  data-tone={rp?.tone}
                  {...dataAttrs(rp?.data)}
                >
                  {columns.map((c, i) => (
                    <td key={c.id} className={cn(pad.td, ALIGN[c.align ?? "start"], c.hideBelow && HIDE[c.hideBelow], c.align === "end" && "tabular", i === 0 && sel && "shadow-[inset_3px_0_0_var(--kg-brand)]")}>
                      {c.cell(row)}
                    </td>
                  ))}
                  {rowActions ? <td className="px-2 py-1 text-right">{actions(row)}</td> : null}
                </tr>
                {more ? (
                  <tr className="bg-surface-2/40">
                    <td colSpan={span} className="px-4 pb-4 pt-1">
                      {more}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
        {totalsFoot}
      </table>
    </div>
  ) : (
    <ul className={cn("flex flex-col divide-y divide-line", pad.text)} aria-label={label}>
      {shown.map((row) => {
        const id = rowId(row);
        const sel = selectedId != null && selectedId === id;
        const primary = columns.find((c) => c.primary) ?? columns[0];
        const rest = columns.filter((c) => c !== primary);
        const more = expanded?.(row) ?? null;
        const rp = props.rowProps?.(row);
        return (
          <li key={id} data-testid={tid(row)} data-tone={rp?.tone} {...dataAttrs(rp?.data)} className={cn(rp?.tone && TONE[rp.tone], sel && "bg-brand-soft")}>
            <div
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              aria-pressed={onRowClick ? sel : undefined}
              onClick={onRowClick ? open(row) : undefined}
              onKeyDown={onRowClick ? openKey(row) : undefined}
              className={cn("flex items-start gap-3", pad.card, onRowClick && "cursor-pointer active:bg-surface-2")}
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{primary.cell(row)}</div>
                <dl className={cn("grid grid-cols-[auto_minmax(0,1fr)] gap-x-3", compact ? "mt-1 gap-y-0.5" : "mt-1.5 gap-y-1")}>
                  {rest.map((c) => (
                    <Fragment key={c.id}>
                      <dt className="text-muted">{cardLabel(c)}</dt>
                      <dd className={cn("min-w-0 break-words", c.align === "end" && "tabular")}>{c.cell(row)}</dd>
                    </Fragment>
                  ))}
                </dl>
              </div>
              {rowActions ? actions(row) : null}
            </div>
            {more ? <div className="px-4 pb-4">{more}</div> : null}
          </li>
        );
      })}
      {totals ? (
        <li className={cn("bg-surface-2/60", pad.card)} data-testid="table-totals">
          <p className="font-semibold">{t("total")}</p>
          {complete ? (
            <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
              {columns
                .filter((c) => c.total)
                .map((c) => (
                  <Fragment key={c.id}>
                    <dt className="text-muted">{cardLabel(c)}</dt>
                    <dd className="tabular font-semibold">{c.total!(rows)}</dd>
                  </Fragment>
                ))}
            </dl>
          ) : (
            <p className="mt-1 text-muted">{t("totalsWhenComplete")}</p>
          )}
        </li>
      ) : null}
    </ul>
  );

  return (
    <div className={cn("overflow-hidden rounded-card border border-line bg-surface", className)} data-testid={testId} data-density={density}>
      {error && rows?.length ? (
        <p role="alert" className="border-b border-line bg-danger-soft/40 px-4 py-2 text-sm text-danger">
          {t("refreshFailed")}
        </p>
      ) : null}
      {body}
      {footer}
    </div>
  );
}

const cardLabel = <T,>(c: Column<T>) => c.label ?? (typeof c.header === "string" ? c.header : "");

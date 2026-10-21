"use client";

import { Fragment, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CaretDown, CaretUp, CaretUpDown, DotsThree } from "@phosphor-icons/react";
import { cn } from "../cn";
import { Button } from "./Button";
import { EmptyState, ErrorState, Skeleton } from "./Display";
import { Menu, Tooltip } from "./Overlay";
import { MD, useMinWidth } from "./media";

export type MenuItem = { label: ReactNode; icon?: ReactNode; onSelect: () => void; danger?: boolean } | "separator";

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
};

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
  testId?: string;
  className?: string;
};

const ALIGN = { start: "text-left", end: "text-right", center: "text-center" } as const;
const HIDE = { lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" } as const;
const INTERACTIVE = "a,button,input,select,textarea,label,[role=menuitem],[role=checkbox],[data-row-ignore]";

/** Clicks on links, buttons and fields inside a row do their own thing, not open the row. */
const fromControl = (e: MouseEvent | KeyboardEvent) => e.target instanceof Element && e.target !== e.currentTarget && Boolean(e.target.closest(INTERACTIVE));

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

/**
 * The desk table (kriraghor-docs 09 §8): columns, loading skeleton, empty and error states, rows that
 * open a detail, a per-row actions menu, expanding rows, honest client sorting, Load more for cursor
 * lists, and cards instead of sideways scrolling on phones.
 */
export function DataTable<T>(props: DataTableProps<T>) {
  const { label, columns, rows, rowId, loading, error, onRetry, empty, onRowClick, selectedId, rowActions, expanded, hasMore, onMore, busy, total, testId, className } = props;
  const t = useTranslations("kit.table");
  const wide = useMinWidth(MD);
  const [sort, setSort] = useState<Sort>(null);
  const complete = props.complete ?? !hasMore;
  const shown = complete ? sortRows(rows ?? [], columns, sort) : (rows ?? []);
  const tid = (row: T) => (typeof props.rowTestId === "function" ? props.rowTestId(row) : props.rowTestId);

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

  const footer = (rows?.length ?? 0) > 0 && (hasMore || total != null || complete) ? (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted">
      <span role="status">{total != null ? t("showing", { n: rows!.length, total }) : hasMore ? t("loaded", { n: rows!.length }) : t("showingAll", { n: rows!.length })}</span>
      {hasMore && onMore ? (
        <Button type="button" variant="secondary" size="sm" busy={busy} onClick={onMore} data-testid="load-more">
          {t("loadMore")}
        </Button>
      ) : null}
    </div>
  ) : null;

  const body = loading && !rows?.length ? (
    <div role="status" aria-label={t("loading")} className="flex flex-col gap-2 p-4">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-10" />
      ))}
    </div>
  ) : !rows?.length ? (
    <EmptyState className="m-4 border-0" icon={empty?.icon} title={empty?.title ?? t("empty")} body={empty?.body} action={empty?.action} />
  ) : wide ? (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" aria-label={label}>
        <thead className="sticky top-0 z-[1] bg-surface-2/95 backdrop-blur">
          <tr>
            {columns.map((c) => {
              const on = sort?.id === c.id ? sort.dir : null;
              return (
                <th
                  key={c.id}
                  scope="col"
                  style={c.width ? { width: c.width } : undefined}
                  aria-sort={on ? (on === "asc" ? "ascending" : "descending") : c.sort && complete ? "none" : undefined}
                  className={cn("whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted", ALIGN[c.align ?? "start"], c.hideBelow && HIDE[c.hideBelow])}
                >
                  {c.sort ? (
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
            })}
            {rowActions ? (
              <th scope="col" className="w-12 px-2">
                <span className="sr-only">{t("actions")}</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => {
            const id = rowId(row);
            const sel = selectedId != null && selectedId === id;
            const more = expanded?.(row) ?? null;
            return (
              <Fragment key={id}>
                <tr
                  onClick={onRowClick ? open(row) : undefined}
                  onKeyDown={onRowClick ? openKey(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-selected={onRowClick ? sel : undefined}
                  className={cn(
                    "border-t border-line align-middle transition-colors",
                    onRowClick && "cursor-pointer hover:bg-surface-2/70 focus-visible:bg-surface-2 focus-visible:outline-none",
                    sel && "bg-brand-soft hover:bg-brand-soft",
                  )}
                  data-testid={tid(row)}
                >
                  {columns.map((c, i) => (
                    <td key={c.id} className={cn("px-4 py-3", ALIGN[c.align ?? "start"], c.hideBelow && HIDE[c.hideBelow], c.align === "end" && "tabular", i === 0 && sel && "shadow-[inset_3px_0_0_var(--kg-brand)]")}>
                      {c.cell(row)}
                    </td>
                  ))}
                  {rowActions ? <td className="px-2 py-1 text-right">{actions(row)}</td> : null}
                </tr>
                {more ? (
                  <tr className="bg-surface-2/40">
                    <td colSpan={columns.length + (rowActions ? 1 : 0)} className="px-4 pb-4 pt-1">
                      {more}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  ) : (
    <ul className="flex flex-col divide-y divide-line" aria-label={label}>
      {shown.map((row) => {
        const id = rowId(row);
        const sel = selectedId != null && selectedId === id;
        const primary = columns.find((c) => c.primary) ?? columns[0];
        const rest = columns.filter((c) => c !== primary);
        const more = expanded?.(row) ?? null;
        return (
          <li key={id} data-testid={tid(row)} className={cn(sel && "bg-brand-soft")}>
            <div
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              aria-pressed={onRowClick ? sel : undefined}
              onClick={onRowClick ? open(row) : undefined}
              onKeyDown={onRowClick ? openKey(row) : undefined}
              className={cn("flex items-start gap-3 px-4 py-3", onRowClick && "cursor-pointer active:bg-surface-2")}
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{primary.cell(row)}</div>
                <dl className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                  {rest.map((c) => (
                    <Fragment key={c.id}>
                      <dt className="text-muted">{c.label ?? (typeof c.header === "string" ? c.header : "")}</dt>
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
    </ul>
  );

  return (
    <div className={cn("overflow-hidden rounded-card border border-line bg-surface", className)} data-testid={testId}>
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

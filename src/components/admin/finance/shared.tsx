"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

/** Status chip with text (never colour alone). */
export function Chip({ tone, children }: { tone: "ok" | "warn" | "bad" | "muted"; children: ReactNode }) {
  const cls = {
    ok: "border-brand text-brand",
    warn: "border-amber-500 text-ink",
    bad: "border-danger text-danger",
    muted: "border-line text-muted",
  }[tone];
  return <span className={`inline-flex items-center border-2 px-2 py-0.5 text-xs font-bold ${cls}`}>{children}</span>;
}

export const TONE: Record<string, "ok" | "warn" | "bad" | "muted"> = {
  succeeded: "ok",
  released: "ok",
  completed: "ok",
  matched: "ok",
  approved: "ok",
  holding: "warn",
  partially_released: "warn",
  pending: "warn",
  pending_master: "warn",
  processing: "warn",
  initiated: "muted",
  partially_refunded: "warn",
  refunded: "muted",
  closed: "muted",
  expired: "muted",
  cancelled: "muted",
  rejected: "muted",
  failed: "bad",
  frozen: "bad",
  manual_required: "bad",
  running: "warn",
};

/** A table shell with loading, error and empty states. */
export function DataTable({ head, loading, error, empty, children, testId }: { head: string[]; loading: boolean; error: boolean; empty: boolean; children: ReactNode; testId?: string }) {
  const t = useTranslations("finance");
  return (
    <div className="mt-4 overflow-x-auto border-2 border-line bg-surface">
      {loading ? (
        <div className="space-y-2 p-4" role="status" aria-label={t("loading")}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 animate-pulse bg-surface-2" />
          ))}
        </div>
      ) : error ? (
        <p className="p-5 text-danger" role="alert">
          {t("loadFailed")}
        </p>
      ) : empty ? (
        <p className="p-5 text-muted">{t("empty")}</p>
      ) : (
        <table className="w-full min-w-[720px] text-left text-sm" data-testid={testId}>
          <thead className="border-b-2 border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              {head.map((h) => (
                <th key={h} scope="col" className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">{children}</tbody>
        </table>
      )}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
      {label}
      {children}
    </label>
  );
}

export const inputCls = "min-h-11 border-2 border-line bg-surface px-3 text-base text-ink focus:border-brand";

export function MoreButton({ show, busy, onClick }: { show: boolean; busy: boolean; onClick: () => void }) {
  const t = useTranslations("finance");
  if (!show) return null;
  return (
    <button type="button" onClick={onClick} disabled={busy} className="mt-4 min-h-11 font-semibold underline disabled:opacity-50">
      {t("more")}
    </button>
  );
}

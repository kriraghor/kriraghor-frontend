import type { components } from "@/lib/api/schema";

/** Audit log screen helpers (M04 §4). */
export type AuditEntry = components["schemas"]["AuditEntry"];
export type AuditEntryDetail = components["schemas"]["AuditEntryDetail"];
export type AuditExport = components["schemas"]["AuditExport"];

export type AuditFilters = {
  from?: string; // YYYY-MM-DD, a Dhaka calendar day
  to?: string;
  action?: string;
  module?: string;
  severity?: "info" | "notice" | "critical";
  entityType?: string;
  entityId?: string;
  actorId?: string;
  stepUp?: boolean;
};

/** Dhaka calendar days → the API's ISO range (start of `from` to end of `to`, UTC+06:00). */
export function toApiFilters(f: AuditFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.from) out.from = `${f.from}T00:00:00.000+06:00`;
  if (f.to) out.to = `${f.to}T23:59:59.999+06:00`;
  for (const k of ["action", "module", "severity", "entityType", "entityId", "actorId"] as const) {
    const v = f[k]?.trim();
    if (v) out[k] = v;
  }
  if (f.stepUp) out.stepUp = "true";
  return out;
}

/** Today in Dhaka as YYYY-MM-DD, and n days before it. */
export function dhakaDay(date = new Date(), minusDays = 0): string {
  const d = new Date(date.getTime() - minusDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export type DiffRow = { field: string; before: string; after: string; changed: boolean };

const show = (v: unknown): string => (v === undefined ? "" : v === null ? "null" : typeof v === "object" ? JSON.stringify(v) : String(v));

/** One row per field present in before or after, changed fields first. Non-object values become a "value" row. */
export function diffRows(before: unknown, after: unknown): DiffRow[] {
  const asObj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : v === null || v === undefined ? {} : { value: v });
  const b = asObj(before);
  const a = asObj(after);
  const fields = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return fields
    .map((field) => ({ field, before: show(b[field]), after: show(a[field]), changed: show(b[field]) !== show(a[field]) }))
    .sort((x, y) => Number(y.changed) - Number(x.changed));
}

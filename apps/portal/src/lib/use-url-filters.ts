"use client";

import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@kriraghor/ui/i18n/navigation";

/**
 * Desk filters kept in the URL, so the back button, a reload and a shared link keep them. Each
 * filter is a string with a default; a value equal to its default is left out of the URL. Other
 * parameters (?id=, ?code=, ?tab=) are kept unless the patch sets them. `allowed` lists the values
 * a filter may take; anything else in the URL reads as the default.
 */
export type FilterSpec<K extends string> = Record<K, { default: string; allowed?: readonly string[] }>;

export function readFilters<K extends string>(params: URLSearchParams, spec: FilterSpec<K>): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const k of Object.keys(spec) as K[]) {
    const raw = params.get(k);
    const { default: d, allowed } = spec[k];
    out[k] = raw === null ? d : allowed && !allowed.includes(raw) ? d : raw;
  }
  return out;
}

/** The query string after a patch: defaults dropped, other parameters kept, "" removes a non-filter. */
export function writeFilters<K extends string>(params: URLSearchParams, spec: FilterSpec<K>, patch: Partial<Record<string, string | null>>): string {
  const next = new URLSearchParams(params.toString());
  for (const [k, v] of Object.entries(patch)) {
    const d = (spec as Record<string, { default: string } | undefined>)[k]?.default;
    if (v === null || v === undefined || v === (d ?? "")) next.delete(k);
    else next.set(k, v);
  }
  const s = next.toString();
  return s ? `?${s}` : "";
}

export function useUrlFilters<K extends string>(spec: FilterSpec<K>) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const current = new URLSearchParams(params.toString());
  const values = readFilters(current, spec);
  /** Sets filters (and any other parameter, e.g. id: null to close a pane). */
  const set = (patch: Partial<Record<string, string | null>>) => router.replace(`${pathname}${writeFilters(current, spec, patch)}`, { scroll: false });
  const clear = () => set(Object.fromEntries(Object.keys(spec).map((k) => [k, null])));
  return { values, set, clear, params: current };
}

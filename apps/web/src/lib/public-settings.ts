import { useQuery } from "@tanstack/react-query";
import { api } from "@kriraghor/api-client";

/**
 * Public platform settings on kriraghor.com (M03-FR-18, GET /settings/public): the public keys nested
 * by prefix with camelCase names, for example `users.avatarMaxBytes`. Cacheable (ETag), one query for
 * every page that reads it. Limits are never hard-coded on the page: unknown means the server decides.
 */
export type PublicSettings = Record<string, unknown> & { version?: number };

export async function fetchPublicSettings(): Promise<PublicSettings> {
  const { data, error } = await api().GET("/settings/public");
  if (error || !data) throw error ?? new Error("settings unavailable");
  return data as PublicSettings;
}

/** One public setting by its dotted key ("users.avatarMaxBytes"), or `fallback`. */
export function publicSetting<T>(settings: PublicSettings | undefined, key: string, fallback: T): T {
  let at: unknown = settings;
  for (const part of key.split(".")) {
    if (!at || typeof at !== "object") return fallback;
    at = (at as Record<string, unknown>)[part];
  }
  return at === undefined || at === null ? fallback : (at as T);
}

/** A positive whole number setting, or null when it is missing or not a number. */
export function publicLimit(settings: PublicSettings | undefined, key: string): number | null {
  const v = publicSetting<unknown>(settings, key, null);
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

export function usePublicSettings() {
  return useQuery({ queryKey: ["public-settings", "api"], queryFn: fetchPublicSettings, staleTime: 5 * 60_000 });
}

import { useQuery } from "@tanstack/react-query";
import { api } from "@kriraghor/api-client";
import type { Audience } from "@kriraghor/session/auth";

/**
 * Public platform settings (M03-FR-18, GET /settings/public): public keys nested by prefix with
 * camelCase names, for example `esports.externalOrganisersEnabled`. Cacheable (ETag), so one query
 * per audience is enough for every desk that reads it.
 */
export type PublicSettings = Record<string, unknown> & { version?: number };

export async function fetchPublicSettings(audience: Audience = "api"): Promise<PublicSettings> {
  const { data, error } = await api(audience).GET("/settings/public");
  if (error || !data) throw error ?? new Error("settings unavailable");
  return data as PublicSettings;
}

/** One public setting by its dotted key ("esports.externalOrganisersEnabled"), or `fallback`. */
export function publicSetting<T>(settings: PublicSettings | undefined, key: string, fallback: T): T {
  let at: unknown = settings;
  for (const part of key.split(".")) {
    if (!at || typeof at !== "object") return fallback;
    at = (at as Record<string, unknown>)[part];
  }
  return at === undefined || at === null ? fallback : (at as T);
}

/**
 * 21 Oct 2026: esports is organised by Kriraghor only. Outside esports organisers stay off until
 * `esports.external_organisers_enabled` is switched on (default false; unknown means off).
 */
export const externalOrganisersEnabled = (settings: PublicSettings | undefined) => publicSetting<unknown>(settings, "esports.externalOrganisersEnabled", false) === true;

export function usePublicSettings(audience: Audience = "api") {
  return useQuery({ queryKey: ["public-settings", audience], queryFn: () => fetchPublicSettings(audience), staleTime: 5 * 60_000 });
}

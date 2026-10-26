import { api } from "@kriraghor/api-client";
import type { Audience } from "@kriraghor/session/auth";

/**
 * CSV downloads through the API, shared by the portal, gym.kriraghor.com and kriraghor.com: the API
 * needs the session's bearer token, so a CSV is fetched as a blob and saved, never a plain link.
 * Import from "@kriraghor/ui/csv" (moved from the portal's lib/dashboard, 26 Oct 2026).
 */
export type CsvAnswer = { data?: Blob; error?: unknown; response: Response };

/** Fetch a CSV from `path` (with the session of `audience`) and save it under the server's file name; throws the problem on an error. */
export async function downloadCsv(audience: Audience, path: string, query: Record<string, string>, fallback = "kriraghor.csv") {
  const client = api(audience) as unknown as { GET: (p: string, o: unknown) => Promise<CsvAnswer> };
  saveCsv(await client.GET(path, { params: { query }, parseAs: "blob" }), fallback);
}

/** Save a CSV answer (fetched with `parseAs: "blob"`) under the server's file name; throws the problem on an error. */
export function saveCsv({ data, error, response }: CsvAnswer, fallback = "kriraghor.csv") {
  if (error || !data) throw error ?? new Error("export failed");
  const url = URL.createObjectURL(data);
  const a = Object.assign(document.createElement("a"), { href: url, download: csvFilename(response.headers.get("Content-Disposition"), fallback) });
  a.click();
  URL.revokeObjectURL(url);
}

/** The file name a Content-Disposition header gives (attachment; filename="x.csv"), else the fallback. */
export function csvFilename(contentDisposition: string | null | undefined, fallback = "kriraghor.csv"): string {
  const cd = contentDisposition ?? "";
  const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? /filename=([^;\s"]+)/.exec(cd)?.[1];
  // A plain file name only: never a folder path.
  const clean = name?.split(/[\\/]/).pop()?.trim();
  return clean || fallback;
}

/** The message key for a failed export: this hour's limit, too many rows, or a plain failure (each app's "csv" namespace or sub-namespace). */
export function csvErrorKey(code: string | null | undefined): "csv.limit" | "csv.tooLarge" | "csv.failed" {
  return code === "EXPORT_LIMIT" ? "csv.limit" : code === "EXPORT_TOO_LARGE" ? "csv.tooLarge" : "csv.failed";
}

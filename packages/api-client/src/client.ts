import createClient from "openapi-fetch";
import type { paths } from "./schema";
import { publicEnv } from "@kriraghor/session/env";
import { createAuthFetch, type Audience } from "@kriraghor/session/auth";

/**
 * Typed API client generated from kriraghor-backend/openapi.json (ADR-002).
 * Regenerate the types with `npm run api:sync` after the backend contract changes.
 */
const clients: Partial<Record<Audience, ReturnType<typeof createClient<paths>>>> = {};

export function api(audience: Audience = "api") {
  if (!clients[audience]) {
    clients[audience] = createClient<paths>({
      baseUrl: publicEnv().API_URL,
      credentials: "include",
      fetch: createAuthFetch(audience),
    });
  }
  return clients[audience]!;
}

/** RFC 7807 problem body returned by the API on errors. */
export type Problem = { code: string; title: string; status: number; detail?: string; errors?: { field: string; message: string }[] };

export function problemOf(error: unknown): Problem | null {
  if (error && typeof error === "object" && "code" in error && "status" in error) return error as Problem;
  return null;
}

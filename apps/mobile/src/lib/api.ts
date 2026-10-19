import createClient from 'openapi-fetch';
import type { paths } from './api/schema';
import { config } from './config';
import { createAuthFetch } from './session';

/**
 * Typed API client generated from kriraghor-backend/openapi.json (ADR-002), shared contract with
 * the web apps. Regenerate types with `npm run api:sync`.
 */
export const api = createClient<paths>({ baseUrl: config.apiUrl, fetch: createAuthFetch() });

export type Problem = { code: string; title: string; status: number; detail?: string };

export function problemMessage(error: unknown, fallback = 'Something went wrong. Try again.') {
  const p = error as Partial<Problem> | undefined;
  return p?.detail ?? p?.title ?? fallback;
}

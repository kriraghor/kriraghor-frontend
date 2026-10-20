import { connection } from "next/server";
import { serverPublicEnv } from "./env";

/**
 * GET /env.js sets window.__ENV from the pod's environment (ADR-003 runtime config).
 * connection() keeps it out of the build-time prerender, so values come from the running pod.
 * Each app re-exports it from src/app/env.js/route.ts.
 */
export async function GET() {
  await connection();
  const body = `window.__ENV=${JSON.stringify(serverPublicEnv())};`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

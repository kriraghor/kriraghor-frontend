import { connection } from "next/server";

/** Liveness and readiness probe (Kubernetes). Answers from the running server, never a prerender. */
export async function GET() {
  await connection();
  return Response.json({ status: "ok", app: process.env.APP_NAME ?? "kriraghor", env: process.env.APP_ENV ?? "local" }, { headers: { "Cache-Control": "no-store" } });
}

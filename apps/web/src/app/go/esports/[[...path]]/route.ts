import { connection } from "next/server";
import { esportsRedirect } from "@/lib/links";
import { serverPublicEnv } from "@kriraghor/session/env";

/**
 * GET /go/esports/… sends the visitor on to esports.kriraghor.com/… (with the query string).
 * Server-rendered links (footer, nav, home copy) point here, so they never bake a build-time
 * ESPORTS_URL into the HTML (ADR-003: the same image runs in every environment).
 */
export async function GET(request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  await connection();
  const { path } = await params;
  const target = esportsRedirect(serverPublicEnv().ESPORTS_URL, path ?? [], new URL(request.url).search);
  return Response.redirect(target, 307);
}

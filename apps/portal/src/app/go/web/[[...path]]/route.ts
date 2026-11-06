import { connection } from "next/server";
import { crossSiteRedirect } from "@kriraghor/session/links";
import { serverPublicEnv } from "@kriraghor/session/env";

/**
 * GET /go/web/… sends the visitor on to kriraghor.com/…: the header's Home link. Served on both portal
 * hosts; the proxy leaves /go/ alone, and the HTML never carries a build-time WEB_URL (ADR-003).
 */
export async function GET(request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  await connection();
  const { path } = await params;
  return Response.redirect(crossSiteRedirect(serverPublicEnv().WEB_URL, path ?? [], new URL(request.url).search), 307);
}

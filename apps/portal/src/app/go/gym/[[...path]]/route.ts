import { connection } from "next/server";
import { gymRedirect } from "@/lib/links";
import { serverPublicEnv } from "@kriraghor/session/env";

/**
 * GET /go/gym/… sends the visitor on to gym.kriraghor.com/… (with the query string): the gym desks
 * (/manage) moved there. The sidebar and the vendor home link here, so no build-time GYM_URL is baked
 * into the HTML (ADR-003). Served on both portal hosts; the proxy leaves /go/ alone.
 */
export async function GET(request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  await connection();
  const { path } = await params;
  return Response.redirect(gymRedirect(serverPublicEnv().GYM_URL, path ?? [], new URL(request.url).search), 307);
}

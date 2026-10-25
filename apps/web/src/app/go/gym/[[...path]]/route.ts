import { connection } from "next/server";
import { crossSiteRedirect } from "@kriraghor/session/links";
import { serverPublicEnv } from "@kriraghor/session/env";

/**
 * GET /go/gym/… sends the visitor on to gym.kriraghor.com/… (with the query string). Server-rendered
 * links (nav, footer, home, the account sidebar) point here, so they never bake a build-time GYM_URL
 * into the HTML (ADR-003: the same image runs in every environment).
 */
export async function GET(request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  await connection();
  const { path } = await params;
  return Response.redirect(crossSiteRedirect(serverPublicEnv().GYM_URL, path ?? [], new URL(request.url).search), 307);
}

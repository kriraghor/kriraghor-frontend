import { connection } from "next/server";
import { webRedirect } from "@/lib/links";
import { serverPublicEnv } from "@kriraghor/session/env";

/**
 * GET /go/web/… sends the visitor on to kriraghor.com/… (help, terms, privacy, the account, the shop).
 * Server-rendered links point here, so the HTML never carries a build-time WEB_URL (ADR-003).
 */
export async function GET(request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  await connection();
  const { path } = await params;
  return Response.redirect(webRedirect(serverPublicEnv().WEB_URL, path ?? [], new URL(request.url).search), 307);
}

import { connection } from "next/server";
import { webRedirect } from "@/lib/links";
import { serverPublicEnv } from "@kriraghor/session/env";

/**
 * GET /go/gym/… sends the visitor on to gym.kriraghor.com/… (with the query string), so server-rendered
 * links never carry a build-time GYM_URL (ADR-003).
 */
export async function GET(request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  await connection();
  const { path } = await params;
  return Response.redirect(webRedirect(serverPublicEnv().GYM_URL, path ?? [], new URL(request.url).search), 307);
}

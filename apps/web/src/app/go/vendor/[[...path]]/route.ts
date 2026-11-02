import { connection } from "next/server";
import { esportsRedirect } from "@/lib/links";
import { serverPublicEnv } from "@kriraghor/session/env";

/** GET /go/vendor/… sends the visitor on to vendor.kriraghor.com/… (as /go/esports does, ADR-003). */
export async function GET(request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  await connection();
  const { path } = await params;
  const target = esportsRedirect(serverPublicEnv().VENDOR_URL, path ?? [], new URL(request.url).search);
  return Response.redirect(target, 307);
}

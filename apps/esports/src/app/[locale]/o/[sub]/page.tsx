import { notFound } from "next/navigation";

export const metadata = { title: "Not found" };

/**
 * M22 organiser pages are switched off while esports is organised by Kriraghor only (21 Oct 2026):
 * /o/{sub} answers 404, and the proxy no longer rewrites {sub}.esports.* here (lib/host.ts).
 */
export default function OrganiserRoute(): never {
  notFound();
}

import { redirect } from "next/navigation";

/**
 * 21 Oct 2026: esports is organised by Kriraghor only, and since 3 Nov 2026 nobody organises on the
 * business panel (ADR-008). Old links and bookmarks land on the business home.
 */
export default function Page(): never {
  redirect("/vendor");
}

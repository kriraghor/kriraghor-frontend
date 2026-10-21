import { redirect } from "next/navigation";

/**
 * 21 Oct 2026: esports is organised by Kriraghor only, so the business panel has no esports console
 * (outside organisers stay off while esports.external_organisers_enabled is false). Old links and
 * bookmarks land on the sports events console.
 */
export default function Page(): never {
  redirect("/vendor/events");
}

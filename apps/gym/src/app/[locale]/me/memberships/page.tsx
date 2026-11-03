import { redirect } from "@kriraghor/ui/i18n/navigation";

/** /me/memberships was the same list as /me (3 Nov 2026); old links and bookmarks land there. A membership's own page stays. */
export default async function Route({ params }: PageProps<"/[locale]/me/memberships">) {
  const { locale } = await params;
  redirect({ href: "/me", locale });
}

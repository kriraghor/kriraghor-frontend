import { redirect } from "@/i18n/navigation";

/** Older notification and gate links point here; the account area lives at /me. */
export default async function AccountRolesPage({ params }: PageProps<"/[locale]/account/roles">) {
  const { locale } = await params;
  redirect({ href: "/me", locale });
}

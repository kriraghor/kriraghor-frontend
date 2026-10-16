import { redirect } from "@/i18n/navigation";

/** The KYC desk moved onto the M05 Moderation desk; old links (and bookmarks) land on its documents. */
export default async function KycPage({ params }: PageProps<"/[locale]/admin/kyc">) {
  const { locale } = await params;
  redirect({ href: "/admin/moderation?kind=document", locale });
}

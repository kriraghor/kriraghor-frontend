import { setRequestLocale } from "next-intl/server";
import { VendorHome } from "@/components/vendor/VendorHome";

export const metadata = { title: "Business desk" };

/** Vendor home (M09): where a ground owner stands, and the way into the grounds desk. */
export default async function VendorPage({ params }: PageProps<"/[locale]/vendor">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <VendorHome />;
}

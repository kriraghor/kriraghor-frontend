import { setRequestLocale } from "next-intl/server";
import { OwnerReviews } from "@/components/vendor/OwnerTrust";

export const metadata = { title: "Reviews" };

export default async function OwnerReviewsPage({ params }: PageProps<"/[locale]/vendor/reviews">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OwnerReviews />;
}

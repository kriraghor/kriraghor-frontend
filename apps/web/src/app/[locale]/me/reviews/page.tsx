import { setRequestLocale } from "next-intl/server";
import { MyReviews } from "@/components/trust/MyReportsReviews";

export const metadata = { title: "My reviews" };

export default async function MyReviewsPage({ params }: PageProps<"/[locale]/me/reviews">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MyReviews />;
}

import { setRequestLocale } from "next-intl/server";
import { ReviewsDesk } from "@/components/admin/trust/ReportsDesk";

export const metadata = { title: "Reviews" };

export default async function ReviewsPage({ params }: PageProps<"/[locale]/admin/reviews">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ReviewsDesk />;
}

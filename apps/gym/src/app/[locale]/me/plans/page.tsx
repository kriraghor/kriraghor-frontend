import { setRequestLocale } from "next-intl/server";
import { MyPlans } from "@/components/gym-member/MyPlans";

export const metadata = { title: "My plans" };

export default async function Route({ params }: PageProps<"/[locale]/me/plans">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MyPlans />;
}

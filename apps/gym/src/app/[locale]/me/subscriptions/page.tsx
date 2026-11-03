import { setRequestLocale } from "next-intl/server";
import { MySubscriptions } from "@/components/gym/MySubscriptions";

export const metadata = { title: "Trainer plans" };

export default async function MySubscriptionsPage({ params }: PageProps<"/[locale]/me/subscriptions">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MySubscriptions />;
}

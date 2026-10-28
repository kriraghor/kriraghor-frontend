import { setRequestLocale } from "next-intl/server";
import { TrainerList } from "@/components/gym/TrainerList";

export const metadata = { title: "Fitness trainers", description: "Verified fitness trainers with monthly plans in Bangladesh." };

export default async function TrainersPage({ params }: PageProps<"/[locale]/trainers">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TrainerList />;
}

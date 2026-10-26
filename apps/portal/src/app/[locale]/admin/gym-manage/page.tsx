import { setRequestLocale } from "next-intl/server";
import { GymManageDesk } from "@/components/admin/gym/GymManageDesk";

export const metadata = { title: "Gym system" };

export default async function Page({ params }: PageProps<"/[locale]/admin/gym-manage">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GymManageDesk />;
}

import { setRequestLocale } from "next-intl/server";
import { TournamentPostsDesk } from "@/components/admin/tournament-posts/TournamentPostsDesk";

export const metadata = { title: "Tournament posts" };

export default async function TournamentPostsPage({ params }: PageProps<"/[locale]/admin/tournament-posts">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TournamentPostsDesk />;
}

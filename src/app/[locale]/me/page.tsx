import { setRequestLocale } from "next-intl/server";
import { MePanel } from "@/components/MePanel";
import { LiveStatus } from "@/components/LiveStatus";

export const metadata = { title: "My account" };

/** Account page plus the realtime connection that M21 uses for room reveals and live results. */
export default async function MePage({ params }: PageProps<"/[locale]/me">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <MePanel>
      <LiveStatus />
    </MePanel>
  );
}

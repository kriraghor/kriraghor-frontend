import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { RoomView } from "@/components/esports/RoomView";
import { SignedIn } from "@/components/esports/SignedIn";

export const metadata = { title: "Room" };

async function Content({ params }: { params: PageProps<"/[locale]/me/matches/[matchId]/room">["params"] }) {
  const { locale, matchId } = await params;
  setRequestLocale(locale);
  return <SignedIn><RoomView matchId={matchId} /></SignedIn>;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function RoomRoute({ params }: PageProps<"/[locale]/me/matches/[matchId]/room">) {
  return (
    <Suspense fallback={<div className="rounded-control mx-auto mt-10 h-64 max-w-[1320px] kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}

import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { ResultView } from "@/components/esports/ResultView";
import { SignedIn } from "@/components/esports/SignedIn";

export const metadata = { title: "Result" };

async function Content({ params }: { params: PageProps<"/[locale]/me/matches/[matchId]/result">["params"] }) {
  const { locale, matchId } = await params;
  setRequestLocale(locale);
  return <SignedIn><ResultView matchId={matchId} /></SignedIn>;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function ResultRoute({ params }: PageProps<"/[locale]/me/matches/[matchId]/result">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}

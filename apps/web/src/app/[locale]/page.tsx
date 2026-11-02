import { setRequestLocale } from "next-intl/server";
import { EsportsHero } from "@/components/home/HeroShell";
import { Finder } from "@/components/home/Finder";
import { HomeInfo } from "@/components/home/HomeInfo";
import { HomeNetwork } from "@/components/home/HomeNetwork";
import { HomeRails } from "@/components/home/HomeRails";
import { Reveal } from "@/components/home/Reveal";

/**
 * kriraghor.com home: the photo hero and the Finder (product owner, 2 Nov 2026), the network, then Esports,
 * Gym, Venues, Shop, Hire and Sports events with live listings, then About and Help. Everything else lives
 * on its own page (/business, /how-it-works, /about, /help). The live parts are client islands with
 * skeletons of their final shape, so a sleeping API never holds the page up.
 */
export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Reveal>
      <EsportsHero />
      <div className="mx-auto max-w-[1320px] px-5">
        <Finder />
      </div>
      <HomeNetwork />
      <HomeRails />
      <HomeInfo />
    </Reveal>
  );
}

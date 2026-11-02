import { setRequestLocale } from "next-intl/server";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeInfo } from "@/components/home/HomeInfo";
import { HomeNetwork } from "@/components/home/HomeNetwork";
import { HomeRails } from "@/components/home/HomeRails";
import { Reveal } from "@/components/home/Reveal";

/**
 * kriraghor.com home (the 2 Nov 2026 design): the hero, the network, then Esports, Gym, Venues, Shop,
 * Hire and Sports events, each with its search bar and a rail of live listings, then About and Help.
 * Everything else lives on its own page (/business, /how-it-works, /about, /help). The live parts are
 * client islands with skeletons of their final shape, so a sleeping API never holds the page up.
 */
export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Reveal>
      <HomeHero />
      <HomeNetwork />
      <HomeRails />
      <HomeInfo />
    </Reveal>
  );
}

import { setRequestLocale } from "next-intl/server";
import { SOCIAL_PROFILES } from "@kriraghor/ui/brand/social-links";
import { JsonLd } from "@/components/JsonLd";
import { siteUrl } from "@/lib/seo";
import { EsportsHero } from "@/components/home/HeroShell";
import { Finder } from "@/components/home/Finder";
import { HomeInfo } from "@/components/home/HomeInfo";
import { HomeRails } from "@/components/home/HomeRails";
import { Reveal } from "@/components/home/Reveal";

/**
 * kriraghor.com home: the photo hero and the Finder (product owner, 2 Nov 2026), then Esports,
 * Gym, Venues, Shop, Hire and Sports events with live listings, then About and Help. The network map that
 * linked to the sections just below it was dropped on 19 Nov 2026 (tester feedback: less scrolling). Everything
 * else lives on its own page (/business, which the header calls "Partner with us", /how-it-works, /about, /help). The live parts are client islands with
 * skeletons of their final shape, so a sleeping API never holds the page up.
 */
export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Reveal>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Organization", name: "Kriraghor", url: siteUrl(), logo: `${siteUrl()}/icon-512.png`, sameAs: SOCIAL_PROFILES.map((p) => p.href) }} />
      <EsportsHero />
      <div className="mx-auto max-w-[1320px] px-5">
        <Finder />
      </div>
      <HomeRails />
      <HomeInfo />
    </Reveal>
  );
}

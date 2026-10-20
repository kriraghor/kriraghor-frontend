import { getTranslations } from "next-intl/server";
import { PHOTOS } from "@/lib/photos";
import { esportsHref } from "@/lib/links";
import { NextUp, OpenCount } from "./EsportsHero";
import { HeroCarousel, type HeroSlide } from "./HeroCarousel";

/**
 * The home hero (Claude Design hero, kriraghor-docs 09 §8): photo slides in product priority
 * (business rules v3): esports first, with the live open count and the next event, then venues,
 * hire, shop and gym. The words render on the server; HeroCarousel moves them.
 */
export async function EsportsHero() {
  const t = await getTranslations("home");
  const s = (k: string) => `carousel.slides.${k}`;
  const slides: HeroSlide[] = [
    {
      key: "esports",
      tab: t(`${s("esports")}.tab`),
      kicker: <OpenCount fallback={t(`${s("esports")}.kicker`)} />,
      title: (
        <>
          {t("hero.title")} <em className="not-italic text-prize">{t("hero.titleEm")}</em>
        </>
      ),
      sub: t("hero.sub"),
      cta: t(`${s("esports")}.cta`),
      href: esportsHref("/events"),
      photo: PHOTOS.esports,
      aside: <NextUp />,
    },
    ...(["venues", "hire", "shop", "gym"] as const).map((k) => ({
      key: k,
      tab: t(`${s(k)}.tab`),
      kicker: t(`${s(k)}.kicker`),
      title: t(`${s(k)}.title`),
      sub: t(`${s(k)}.sub`),
      cta: t(`${s(k)}.cta`),
      href: { venues: "/venues", hire: "/hiring", shop: "/shop", gym: "/gym" }[k],
      photo: { venues: PHOTOS.groundsFloodlit, hire: PHOTOS.hire, shop: PHOTOS.shopGear, gym: PHOTOS.gym }[k],
    })),
  ];
  return <HeroCarousel slides={slides} />;
}

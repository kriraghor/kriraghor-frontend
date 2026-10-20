import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { PHOTOS } from "@/lib/photos";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { FeaturedEvent, NextUp, OpenCount } from "./EsportsHero";

/**
 * The esports hero (home-v3 §1, priority 1). Static on purpose: the old auto-rotating carousel is
 * gone (WCAG 2.2.2). The headline renders on the server; the count and the next-up card are live.
 */
export async function EsportsHero() {
  const t = await getTranslations("home.hero");
  return (
    <section className="relative overflow-hidden bg-band pb-28 pt-12 text-band-text md:pt-16" id="esports" aria-labelledby="hero-title" data-testid="hero">
      <Image src={PHOTOS.esports} alt="" fill priority sizes="100vw" className="object-cover object-[60%_30%] opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-band via-band/80 to-band/30" aria-hidden />
      {/* Two soft glows, green and amber, as in the prototype; decorative only. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_15%_10%,rgb(25_153_95/0.28),transparent),radial-gradient(40%_40%_at_90%_80%,rgb(242_163_58/0.18),transparent)]" aria-hidden />
      <div className="relative mx-auto grid max-w-[1320px] gap-10 px-5 md:grid-cols-[7fr_5fr] md:items-center">
        {/* The Claude Design hero entrance: each line rises in, 100 ms apart (motion.css). */}
        <div className="kg-hero">
          <div className="kg-hero-item">
            <OpenCount />
          </div>
          <h1 id="hero-title" className="kg-hero-item mt-5 text-[clamp(38px,5.4vw,68px)] font-extrabold leading-[1.02] tracking-[-0.045em]" data-testid="home-title">
            {t("title")} <em className="not-italic text-prize">{t("titleEm")}</em>
          </h1>
          <p className="kg-hero-item mt-5 max-w-[52ch] text-lg text-band-muted">{t("sub")}</p>
          <div className="kg-hero-item mt-8 flex flex-wrap gap-3">
            <a href="#open" className="inline-flex min-h-12 items-center gap-2 bg-prize px-5 font-bold text-prize-ink hover:brightness-95">
              {t("join")} <ArrowRight size={18} aria-hidden />
            </a>
            <a href="#how" className="inline-flex min-h-12 items-center border-2 border-band-line px-5 font-bold hover:border-band-text">
              {t("how")}
            </a>
          </div>
        </div>
        <NextUp />
      </div>
      {/* A live or upcoming featured big event (M23), when there is one. */}
      <div className="relative px-5">
        <FeaturedEvent />
      </div>
    </section>
  );
}


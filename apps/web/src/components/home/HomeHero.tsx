import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { ButtonLink } from "@kriraghor/ui/kit";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { PHOTOS } from "@/lib/photos";
import { HomeLive } from "./HomeLive";

/** The hero card: what Kriraghor is, the way into Business and How it works, and the live numbers. */
export async function HomeHero() {
  const t = await getTranslations("home.hero");
  return (
    <section className="mx-auto max-w-wide px-3 pt-4 sm:px-5 sm:pt-6">
      <div className="relative grid gap-8 overflow-hidden rounded-[28px] bg-band p-6 text-white sm:p-10 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-center">
        <Image src={PHOTOS.esports} alt="" fill priority sizes="(min-width: 1320px) 1320px, 100vw" className="object-cover opacity-45" />
        <span className="absolute inset-0 bg-gradient-to-r from-band via-band/85 to-band/40" aria-hidden />
        <div className="relative">
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-prize">{t("kicker")}</p>
          <h1 className="mt-3 max-w-[18ch] text-[clamp(32px,4.4vw,56px)] font-extrabold leading-[1.08]" data-testid="home-title">
            {t("title")}
          </h1>
          <p className="mt-4 max-w-[52ch] text-lg text-white/85">{t("sub")}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <ButtonLink href="/business" size="lg" iconEnd={<ArrowRight size={18} aria-hidden />} data-testid="hero-business">
              {t("business")}
            </ButtonLink>
            <Link href="/how-it-works" className="inline-flex min-h-12 items-center rounded-control border border-white/40 px-5 font-bold text-white no-underline transition-colors hover:bg-white/10">
              {t("how")}
            </Link>
          </div>
        </div>
        <div className="relative">
          <HomeLive />
        </div>
      </div>
    </section>
  );
}

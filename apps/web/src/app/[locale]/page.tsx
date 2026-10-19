import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, ArrowsClockwise, ArrowUUpLeft, Barbell, HandCoins, IdentificationBadge, Key, Pill, SealCheck, ShieldCheck, SoccerBall, Wallet } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { PHOTOS } from "@/lib/photos";
import { esportsHref } from "@/lib/links";
import { EsportsHero } from "@/components/home/HeroShell";
import { Finder } from "@/components/home/Finder";
import { OpenTournaments, TopPlayers } from "@/components/home/EsportsSections";
import { HomeGrounds } from "@/components/home/HomeGrounds";
import { HomeGym, HomeHire } from "@/components/home/HireAndGym";
import { Reveal } from "@/components/home/Reveal";
import { TournamentsStrip } from "@/components/tournaments/TournamentsStrip";

/**
 * kriraghor.com home (kriraghor-docs/design/home-v3). The copy and structure render on the server;
 * live sections (next tournament, open tournaments, top players, grounds, hire, gyms) are client
 * islands with skeletons of their final shape, so a sleeping API never holds the page up.
 * Order follows the v3 priorities: esports, grounds, shop, hire, gym.
 */
export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  const steps: { icon: ReactNode; key: string }[] = [
    { icon: <IdentificationBadge size={24} aria-hidden />, key: "uid" },
    { icon: <Wallet size={24} aria-hidden />, key: "pay" },
    { icon: <Key size={24} aria-hidden />, key: "room" },
    { icon: <HandCoins size={24} aria-hidden />, key: "win" },
  ];
  const business = [
    { key: "grounds", href: "/account/business" },
    { key: "shops", href: "/account/business?as=shop" },
    { key: "pros", href: "/account/business?as=pro" },
    { key: "organisers", href: "/account/business?as=organiser" },
  ];
  const trust = [
    { key: "money", icon: <ShieldCheck size={22} aria-hidden /> },
    { key: "verified", icon: <SealCheck size={22} aria-hidden /> },
    { key: "refunds", icon: <ArrowUUpLeft size={22} aria-hidden /> },
  ];

  return (
    <Reveal>
      <EsportsHero />
      <div className="mx-auto max-w-[1320px] px-5">
        <Finder />
      </div>

      <OpenTournaments />

      <section className="mx-auto grid max-w-[1320px] gap-10 px-5 pt-[72px] md:grid-cols-[7fr_5fr]" aria-labelledby="players-title">
        <TopPlayers />
        <div id="how">
          <h2 className="text-[clamp(28px,3.4vw,40px)] font-extrabold">{t("how.title")}</h2>
          <ol className="mt-6 flex flex-col gap-5">
            {steps.map((s) => (
              <li key={s.key} className="rv flex gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-text">{s.icon}</span>
                <span>
                  <h3 className="text-lg font-extrabold">{t(`how.${s.key}.title`)}</h3>
                  <p className="text-muted">{t(`how.${s.key}.body`)}</p>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <HomeGrounds />

      <section className="mx-auto max-w-[1320px] px-5 pt-[72px]" id="shop" aria-labelledby="shop-title" data-testid="home-shop">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="shop-title" className="text-[clamp(28px,3.4vw,40px)] font-extrabold">
              {t("shop.title")}
            </h2>
            <p className="mt-2 max-w-[60ch] text-muted">{t("shop.sub")}</p>
          </div>
          <Link href="/shop" className="inline-flex min-h-11 items-center gap-1 font-bold text-brand-text underline">
            {t("shop.all")} <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-[2fr_1fr_1fr] md:grid-rows-2">
          <Link href="/shop" className="rv group relative flex min-h-72 flex-col justify-end overflow-hidden rounded-[24px] bg-band p-6 text-white sm:col-span-2 md:col-span-1 md:row-span-2">
            <Image src={PHOTOS.shopGear} alt="" fill sizes="(min-width: 900px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
            <span className="absolute inset-0 bg-gradient-to-t from-band via-band/40 to-transparent" aria-hidden />
            <span className="glass-band relative self-start rounded-2xl p-4">
              <SoccerBall size={36} aria-hidden />
              <h3 className="mt-3 text-2xl font-extrabold">{t("shop.gear.title")}</h3>
              <p className="mt-1 text-white/85">{t("shop.gear.body")}</p>
            </span>
          </Link>
          <Link href="/shop?category=supplements" className="rv group grid min-h-44 overflow-hidden glass-card hover:border-ink sm:grid-cols-[1fr_40%] md:col-span-2">
            <span className="flex flex-col p-5">
              <Pill size={32} className="text-brand-text" aria-hidden />
              <h3 className="mt-auto pt-6 text-xl font-extrabold">{t("shop.supplements.title")}</h3>
              <p className="mt-1 text-muted">{t("shop.supplements.body")}</p>
            </span>
            <span className="relative hidden sm:block">
              <Image src={PHOTOS.shopSupplements} alt="" fill sizes="20vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
            </span>
          </Link>
          <Link href="/shop?category=gym" className="rv group relative flex min-h-44 flex-col overflow-hidden rounded-[24px] bg-band p-5 text-white">
            <Image src={PHOTOS.shopGymGear} alt="" fill sizes="(min-width: 900px) 25vw, 50vw" className="object-cover opacity-70 transition-transform duration-500 group-hover:scale-105" />
            <span className="absolute inset-0 bg-gradient-to-t from-band/90 to-transparent" aria-hidden />
            <Barbell size={32} className="relative" aria-hidden />
            <h3 className="relative mt-auto pt-6 text-xl font-extrabold">{t("shop.gym.title")}</h3>
            <p className="relative mt-1 text-white/85">{t("shop.gym.body")}</p>
          </Link>
          {/* Used gear is M13 step 2: shown honestly as coming, not as a link to nowhere. */}
          <div className="rv flex min-h-44 flex-col rounded-[24px] bg-band p-5 text-band-text">
            <span className="flex items-start justify-between gap-2">
              <ArrowsClockwise size={32} className="text-prize" aria-hidden />
              <span className="rounded-pill border border-band-line px-3 py-1 text-xs font-bold uppercase">{t("soon")}</span>
            </span>
            <h3 className="mt-auto pt-6 text-xl font-extrabold">{t("shop.used.title")}</h3>
            <p className="mt-1 text-band-muted">{t("shop.used.body")}</p>
          </div>
        </div>
      </section>

      <HomeHire />

      <section className="mx-auto mt-[72px] max-w-[1320px] overflow-hidden bg-gym text-white md:rounded-[32px]" id="gym" aria-labelledby="gym-title" data-testid="home-gym-band">
        <div className="grid md:grid-cols-[2fr_3fr]">
          <div className="relative min-h-64">
            <Image src={PHOTOS.gym} alt="" fill sizes="(min-width: 900px) 40vw, 100vw" className="object-cover" />
          </div>
        <div className="flex flex-col justify-center gap-8 px-5 py-14 md:px-10">
          <div>
            <h2 id="gym-title" className="font-gym text-6xl font-black uppercase leading-none tracking-tight">
              <span className="font-bangla normal-case" lang="bn">
                ক্রীড়াঘর
              </span>{" "}
              <em className="not-italic text-gym-accent">Gym</em>
            </h2>
            <p className="mt-4 max-w-[46ch] text-lg text-white/80">{t("gym.body")}</p>
            <Link href="/gym" className="mt-6 inline-flex min-h-12 items-center gap-2 bg-gym-accent px-5 font-bold text-gym">
              {t("gym.cta")} <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
          <HomeGym />
        </div>
        </div>
      </section>

      <TournamentsStrip />

      <section className="mx-auto max-w-[1320px] px-5 py-[72px]" aria-labelledby="biz-title">
        <h2 id="biz-title" className="text-[clamp(28px,3.4vw,40px)] font-extrabold">
          {t("business.title")}
        </h2>
        <p className="mt-2 max-w-[60ch] text-muted">{t("business.sub")}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {business.map((b) => (
            <Link key={b.key} href={b.href} className="rv glass-card flex flex-col gap-2 p-5 hover:text-brand-text">
              <b className="text-lg">{t(`business.${b.key}.title`)}</b>
              <span className="text-muted">{t(`business.${b.key}.body`)}</span>
              <em className="mt-auto inline-flex items-center gap-1 pt-2 font-bold not-italic text-brand-text">
                {t(`business.${b.key}.cta`)} <ArrowRight size={16} aria-hidden />
              </em>
            </Link>
          ))}
        </div>
        <dl className="mt-12 grid gap-6 md:grid-cols-3">
          {trust.map((x) => (
            <div key={x.key} className="rv glass-card p-5">
              <dt className="flex items-center gap-2 text-lg font-extrabold">
                <span className="text-brand-text">{x.icon}</span>
                {t(`trust.${x.key}.title`)}
              </dt>
              <dd className="mt-1 text-muted">{t(`trust.${x.key}.body`)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-10 text-sm text-muted">
          {t("trust.more")}{" "}
          <Link href="/buyer-protection" className="font-semibold underline">
            {t("trust.protection")}
          </Link>{" "}
          ·{" "}
          <Link href="/refund-policy" className="font-semibold underline">
            {t("trust.refundPolicy")}
          </Link>
          {" · "}
          <a href={esportsHref("/events")} className="font-semibold underline">
            {t("trust.esports")}
          </a>
        </p>
      </section>
    </Reveal>
  );
}

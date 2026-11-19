import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Barbell, MapPin, QrCode, Storefront } from "@phosphor-icons/react/dist/ssr";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { isExternal, webHref } from "@/lib/links";

/**
 * gym.kriraghor.com home, for members (tester feedback, 19 Nov 2026): find a gym or a trainer, what a
 * member gets, and gear in the shop. What the system does for owners moved to /partner ("Partner with us"
 * in the header), so nothing here is aimed at businesses.
 */
export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("gymHome");
  const perks = [
    { key: "near", icon: MapPin, href: "/gyms" },
    { key: "checkIn", icon: QrCode, href: "/gyms" },
    { key: "plans", icon: Barbell, href: "/trainers" },
    { key: "gear", icon: Storefront, href: webHref("/shop?category=gym") },
  ] as const;

  return (
    <>
      <section className="mx-auto grid max-w-[1320px] gap-8 px-5 pb-8 pt-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-center md:pt-14">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">{t("kicker")}</p>
          <h1 className="mt-3 max-w-3xl font-gym text-5xl font-black uppercase leading-[1.02] tracking-tight md:text-7xl" data-testid="home-title">
            {t.rich("title", { em: (chunks) => <span className="text-brand">{chunks}</span> })}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">{t("lead")}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/gyms" className="inline-flex min-h-12 items-center gap-2 bg-brand px-6 font-bold text-on-brand no-underline hover:bg-brand-hover" data-testid="find-gym">
              {t("findGym")} <ArrowRight size={18} aria-hidden />
            </Link>
            <Link href="/trainers" className="rounded-control inline-flex min-h-12 items-center border border-line-strong/60 px-6 font-bold no-underline hover:border-brand" data-testid="find-trainer">
              {t("findTrainer")}
            </Link>
          </div>
        </div>
        <div className="relative order-first h-56 overflow-hidden rounded-card bg-surface-2 shadow-lg md:order-last md:h-auto md:aspect-[4/3]">
          <Image src="/images/gym-training.jpg" alt="" fill sizes="(min-width: 900px) 45vw, 100vw" className="object-cover" priority />
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 pb-10" aria-labelledby="perks-title">
        <h2 id="perks-title" className="sr-only">
          {t("perksTitle")}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="member-perks">
          {perks.map(({ key, icon: Icon, href }) => {
            const body = (
              <>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-brand-soft text-brand-text">
                  <Icon size={24} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-lg font-extrabold">{t(`perks.${key}.title`)}</span>
                  <span className="block text-sm text-muted">{t(`perks.${key}.body`)}</span>
                </span>
              </>
            );
            const cls = "surface-card flex h-full items-start gap-3 p-4 no-underline transition-colors hover:border-brand";
            return (
              <li key={key}>
                {isExternal(href) ? (
                  <a href={href} className={cls} data-testid={`perk-${key}`}>
                    {body}
                  </a>
                ) : (
                  <Link href={href} className={cls} data-testid={`perk-${key}`}>
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

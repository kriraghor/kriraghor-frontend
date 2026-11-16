import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { ButtonLink } from "@kriraghor/ui/kit";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { gymHref, isExternal, vendorHref } from "@/lib/links";
import { PHOTOS } from "@/lib/photos";

export const metadata = { title: "Business", description: "Run your gym, venue or sports shop on Kriraghor.", alternates: { canonical: "/business" } };

const CARDS = [
  { key: "gym", photo: PHOTOS.gym, start: gymHref("/start"), overview: "/how-it-works#gym" },
  { key: "venue", photo: PHOTOS.groundsFloodlit, start: "/account/business", overview: "/how-it-works#venues" },
  { key: "shop", photo: PHOTOS.shopGear, start: "/account/business?as=shop", overview: "/how-it-works#shop" },
  { key: "academy", photo: PHOTOS.hire, start: null, overview: null },
];
const FEATURES = ["a", "b", "c"];
const OTHERS = [
  { key: "pros", href: "/account/business?as=pro" },
  { key: "organisers", href: "/account/business?as=organiser" },
];

/**
 * Business home (the 2 Nov 2026 design): what Kriraghor offers each kind of business. Getting started
 * uses today's flows: the gym site's own start page and the existing business application. One account
 * works everywhere, so owner sign-in is the vendor site's own.
 */
export default async function BusinessPage({ params }: PageProps<"/[locale]/business">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("bizHome");
  return (
    <div className="mx-auto max-w-wide px-3 pb-16 pt-4 sm:px-5 sm:pt-6" data-testid="business-page">
      <section className="relative overflow-hidden rounded-card bg-band p-6 text-white sm:p-10">
        <Image src={PHOTOS.gym} alt="" fill priority sizes="(min-width: 1320px) 1320px, 100vw" className="object-cover opacity-40" />
        <span className="absolute inset-0 bg-gradient-to-r from-band via-band/85 to-band/40" aria-hidden />
        <div className="relative">
          <h1 className="max-w-[20ch] text-[clamp(32px,4.4vw,52px)] font-extrabold leading-[1.08]">{t("title")}</h1>
          <p className="mt-4 max-w-[56ch] text-lg text-white/85">{t("sub")}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/account/business" size="lg" iconEnd={<ArrowRight size={18} aria-hidden />} data-testid="biz-register">
              {t("register")}
            </ButtonLink>
            <a href={vendorHref("/sign-in")} className="inline-flex min-h-12 items-center rounded-control border border-white/40 px-5 font-bold text-white no-underline transition-colors hover:bg-white/10" data-testid="biz-owner-sign-in">
              {t("ownerSignIn")}
            </a>
          </div>
        </div>
      </section>

      <ul className="mt-6 grid gap-4 px-2 sm:grid-cols-2 sm:px-0 lg:grid-cols-4">
        {CARDS.map((c) => (
          <li key={c.key} className="surface-card flex flex-col overflow-hidden" data-testid={`biz-${c.key}`}>
            <span className="relative block h-36 shrink-0 bg-surface-2">
              <Image src={c.photo} alt="" fill sizes="(min-width: 1180px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
            </span>
            <div className="flex flex-1 flex-col gap-2 p-5">
              <h2 className="font-display text-xl font-bold leading-snug">{t(`${c.key}.title`)}</h2>
              <p className="text-sm text-muted">{t(`${c.key}.body`)}</p>
              <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
                {FEATURES.map((f) => (
                  <li key={f}>{t(`${c.key}.${f}`)}</li>
                ))}
              </ul>
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
                {c.start && c.overview ? (
                  <>
                    <Link href={c.overview} className="inline-flex min-h-11 items-center font-bold underline-offset-4 hover:underline">
                      {t("overview")}
                    </Link>
                    {isExternal(c.start) ? (
                      <a href={c.start} className="inline-flex min-h-11 items-center rounded-control bg-brand px-4 font-bold text-on-brand no-underline transition-colors hover:bg-brand-hover">
                        {t("start")}
                      </a>
                    ) : (
                      <Link href={c.start} className="inline-flex min-h-11 items-center rounded-control bg-brand px-4 font-bold text-on-brand no-underline transition-colors hover:bg-brand-hover">
                        {t("start")}
                      </Link>
                    )}
                  </>
                ) : (
                  <span className="inline-flex min-h-11 items-center rounded-pill border border-line-strong/50 px-4 text-sm font-bold text-muted">{t("soon")}</span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <section className="mt-10 px-2 sm:px-0" aria-labelledby="biz-others">
        <h2 id="biz-others" className="text-2xl font-extrabold">
          {t("othersTitle")}
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {OTHERS.map((o) => (
            <Link key={o.key} href={o.href} className="surface-card flex flex-col gap-1 p-5 no-underline transition-colors hover:border-brand">
              <b className="text-lg">{t(`${o.key}.title`)}</b>
              <span className="text-muted">{t(`${o.key}.body`)}</span>
              <span className="mt-2 inline-flex items-center gap-1 font-bold text-brand-text">
                {t(`${o.key}.cta`)} <ArrowRight size={16} aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

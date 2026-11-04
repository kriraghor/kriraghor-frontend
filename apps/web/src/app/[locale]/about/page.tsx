import Image from "next/image";
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@kriraghor/ui/page-header";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { isExternal } from "@/lib/links";
import { SECTIONS, sectionUrl, type SectionKey } from "@/lib/home";
import { PHOTOS } from "@/lib/photos";

export const metadata = { title: "About Kriraghor", description: "Kriraghor is a sports and esports platform for Bangladesh, with one account for everything.", alternates: { canonical: "/about" } };

const PHOTO: Record<SectionKey, string> = { esports: PHOTOS.esports, gym: PHOTOS.gym, venues: PHOTOS.groundsFloodlit, shop: PHOTOS.shopGear, hire: PHOTOS.hire, events: PHOTOS.tournaments };

/** About Kriraghor: what it is, its six parts, and why people can trust it. */
export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");
  const links = [
    { href: "/how-it-works", label: t("links.how") },
    { href: "/help", label: t("links.help") },
    { href: "/terms", label: t("links.terms") },
    { href: "/privacy", label: t("links.privacy") },
    { href: "/refund-policy", label: t("links.refunds") },
  ];
  return (
    <div className="mx-auto max-w-wide px-5 py-10" data-testid="about-page">
      <PageHeader photo={PHOTOS.groundsFloodlit}>
        <h1 className="text-[clamp(32px,4vw,48px)] font-extrabold leading-tight">{t("title")}</h1>
        <p className="mt-3 max-w-[56ch] text-lg text-muted">{t("sub")}</p>
      </PageHeader>

      <section className="mt-12" aria-labelledby="about-parts">
        <h2 id="about-parts" className="text-3xl font-extrabold">
          {t("partsTitle")}
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((k) => {
            const href = sectionUrl(k);
            const body: ReactNode = (
              <>
                <Image src={PHOTO[k]} alt="" fill sizes="(min-width: 1180px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                <span className="absolute inset-0 bg-gradient-to-t from-band via-band/70 to-band/10" aria-hidden />
                <span className="relative mt-auto">
                  <b className="flex items-center justify-between gap-2 text-xl">
                    {t(`parts.${k}.title`)} <ArrowRight size={18} aria-hidden />
                  </b>
                  <span className="mt-1 block text-sm text-white/85">{t(`parts.${k}.body`)}</span>
                </span>
              </>
            );
            const className = "group relative flex h-full min-h-52 flex-col overflow-hidden rounded-[20px] bg-band p-5 text-white no-underline";
            return (
              <li key={k}>
                {isExternal(href) ? (
                  <a href={href} className={className}>
                    {body}
                  </a>
                ) : (
                  <Link href={href} className={className}>
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="about-trust">
        <h2 id="about-trust" className="text-3xl font-extrabold">
          {t("trustTitle")}
        </h2>
        <ul className="mt-4 flex max-w-[70ch] list-disc flex-col gap-2 pl-6 text-muted">
          {(["a", "b", "c"] as const).map((k) => (
            <li key={k}>{t(`trust.${k}`)}</li>
          ))}
        </ul>
      </section>

      <nav aria-label={t("links.label")} className="mt-10 flex flex-wrap gap-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="glass inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-bold no-underline">
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

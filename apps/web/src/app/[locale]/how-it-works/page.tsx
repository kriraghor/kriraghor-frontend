import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, ArrowUUpLeft, SealCheck, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@kriraghor/ui/page-header";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { isExternal } from "@/lib/links";
import { sectionUrl } from "@/lib/home";
import { PHOTOS } from "@/lib/photos";

export const metadata = { title: "How it works", description: "How esports tournaments, gyms, venues, the shop, hiring and sports tournaments work on Kriraghor.", alternates: { canonical: "/how-it-works" } };

const PARTS = [
  { key: "esports", photo: PHOTOS.esports, steps: 4, owners: false },
  { key: "gym", photo: PHOTOS.gym, steps: 4, owners: true },
  { key: "venues", photo: PHOTOS.groundsFloodlit, steps: 4, owners: true },
  { key: "shop", photo: PHOTOS.shopGear, steps: 4, owners: true },
  { key: "hire", photo: PHOTOS.hire, steps: 4, owners: false },
  { key: "events", photo: PHOTOS.tournaments, steps: 3, owners: true },
] as const;
const TRUST = [
  { key: "money", icon: <ShieldCheck size={24} aria-hidden /> },
  { key: "verified", icon: <SealCheck size={24} aria-hidden /> },
  { key: "refunds", icon: <ArrowUUpLeft size={24} aria-hidden /> },
];

/** How each part of Kriraghor works, from the v3 business rules. Amounts and windows stay out: they are settings. */
export default async function HowItWorksPage({ params }: PageProps<"/[locale]/how-it-works">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("howItWorks");
  return (
    <div className="mx-auto max-w-wide px-5 py-10" data-testid="how-page">
      <PageHeader photo={PHOTOS.groundsNight}>
        <h1 className="text-[clamp(32px,4vw,48px)] font-extrabold leading-tight">{t("title")}</h1>
        <p className="mt-3 max-w-[56ch] text-lg text-muted">{t("sub")}</p>
      </PageHeader>
      <nav aria-label={t("jump")} className="mt-6 flex flex-wrap gap-2">
        {[...PARTS.map((p) => p.key), "money" as const].map((k) => (
          <a key={k} href={`#${k}`} className="glass inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-bold no-underline">
            {t(`${k}.title`)}
          </a>
        ))}
      </nav>

      {PARTS.map((p) => {
        const href = sectionUrl(p.key);
        const cta = (
          <>
            {t(`${p.key}.cta`)} <ArrowRight size={16} aria-hidden />
          </>
        );
        const ctaClass = "mt-4 inline-flex min-h-11 items-center gap-1 font-bold text-brand-text underline-offset-4 hover:underline";
        return (
          <section key={p.key} id={p.key} className="mt-14 grid scroll-mt-24 gap-6 md:grid-cols-[320px_minmax(0,1fr)] md:gap-10" aria-labelledby={`how-${p.key}`}>
            <div>
              <span className="relative block aspect-[16/10] overflow-hidden rounded-[20px] bg-surface-2">
                <Image src={p.photo} alt="" fill sizes="(min-width: 900px) 320px, 100vw" className="object-cover" />
              </span>
              <h2 id={`how-${p.key}`} className="mt-4 text-3xl font-extrabold">
                {t(`${p.key}.title`)}
              </h2>
              {isExternal(href) ? (
                <a href={href} className={ctaClass}>
                  {cta}
                </a>
              ) : (
                <Link href={href} className={ctaClass}>
                  {cta}
                </Link>
              )}
            </div>
            <div>
              <ol className="grid gap-5 sm:grid-cols-2">
                {Array.from({ length: p.steps }, (_, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-brand-soft font-display font-bold tabular-nums text-brand-text" aria-hidden>
                      {(i + 1).toLocaleString(locale === "bn" ? "bn-BD" : "en-GB")}
                    </span>
                    <span>
                      <h3 className="font-extrabold">{t(`${p.key}.s${i + 1}.title`)}</h3>
                      <p className="mt-0.5 text-muted">{t(`${p.key}.s${i + 1}.body`)}</p>
                    </span>
                  </li>
                ))}
              </ol>
              {p.owners ? (
                <p className="glass-card mt-5 p-4 text-sm">
                  <b>{t("forOwners")}</b> {t(`${p.key}.owners`)}{" "}
                  <Link href="/business" className="font-bold text-brand-text underline">
                    {t("seeBusiness")}
                  </Link>
                </p>
              ) : null}
            </div>
          </section>
        );
      })}

      <section id="money" className="mt-14 scroll-mt-24" aria-labelledby="how-money">
        <h2 id="how-money" className="text-3xl font-extrabold">
          {t("money.title")}
        </h2>
        <dl className="mt-5 grid gap-4 md:grid-cols-3">
          {TRUST.map((x) => (
            <div key={x.key} className="glass-card p-5">
              <dt className="flex items-center gap-2 text-lg font-extrabold">
                <span className="text-brand-text">{x.icon}</span>
                {t(`money.${x.key}.title`)}
              </dt>
              <dd className="mt-1 text-muted">{t(`money.${x.key}.body`)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-sm text-muted">
          {t("money.more")}{" "}
          <Link href="/buyer-protection" className="font-semibold underline">
            {t("money.protection")}
          </Link>
          {" · "}
          <Link href="/refund-policy" className="font-semibold underline">
            {t("money.refundPolicy")}
          </Link>
          {" · "}
          <Link href="/fair-play" className="font-semibold underline">
            {t("money.fairPlay")}
          </Link>
        </p>
      </section>
    </div>
  );
}

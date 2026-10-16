import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { APP } from "@/app.config";
import { EsportsStrip } from "@/components/EsportsStrip";
import { GroundsStrip } from "@/components/grounds/GroundsStrip";

/** Home placeholder. The real home (kriraghor-docs/design/home-v3) is built with its modules; esports leads (M21). */
export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <>
      <section className="mx-auto max-w-[1320px] px-5 py-16">
        <h1 className="max-w-[16ch] text-5xl font-extrabold" data-testid="home-title">
          {t(`app.${APP.titleKey}`)}
        </h1>
        <p className="mt-4 max-w-[52ch] text-lg text-muted">{APP.description}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/sign-in" className="inline-flex min-h-12 items-center bg-brand px-5 font-bold text-white hover:bg-brand-hover">
            {t("nav.signIn")}
          </Link>
          <Link href="/me" className="inline-flex min-h-12 items-center border-2 border-line-strong px-5 font-bold">
            {t("nav.me")}
          </Link>
        </div>
      </section>
      <EsportsStrip />
      <GroundsStrip />
    </>
  );
}

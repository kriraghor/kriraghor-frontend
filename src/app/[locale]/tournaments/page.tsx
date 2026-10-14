import { getTranslations, setRequestLocale } from "next-intl/server";

/** Placeholder until M21 (phase 3) builds tournaments, registration and room reveal. */
export default async function TournamentsPage({ params }: PageProps<"/[locale]/tournaments">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-16">
      <h1 className="text-4xl font-extrabold">{t("nav.esports")}</h1>
      <p className="mt-3 text-muted">{t("placeholder.soon")}</p>
    </section>
  );
}

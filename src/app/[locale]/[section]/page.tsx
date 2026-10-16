import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

/** Placeholders for the public verticals until their modules are built (M11, M12/M13, M20; grounds is M09). Unknown sections 404. */
const SECTIONS = ["hiring", "shop", "gym"] as const;
type Section = (typeof SECTIONS)[number];

export function generateStaticParams() {
  return SECTIONS.map((section) => ({ section }));
}

export default async function SectionPage({ params }: PageProps<"/[locale]/[section]">) {
  const { locale, section } = await params;
  if (!SECTIONS.includes(section as Section)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-16">
      <h1 className="text-4xl font-extrabold">{t(`nav.${section as Section}`)}</h1>
      <p className="mt-3 text-muted">{t("placeholder.soon")}</p>
    </section>
  );
}

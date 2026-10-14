import { getTranslations, setRequestLocale } from "next-intl/server";
import { MePanel } from "@/components/MePanel";

export const metadata = { title: "Business desk" };

/** Vendor home: the customer session (ground owners, shops, gyms, organisers). Desks arrive with M09–M22. */
export default async function VendorHome({ params }: PageProps<"/[locale]/vendor">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <>
      <section className="mx-auto max-w-xl px-5 pt-12">
        <h1 className="text-3xl font-extrabold">{t("vendor.home")}</h1>
        <p className="mt-2 text-muted">{t("vendor.intro")}</p>
      </section>
      <MePanel signInHref="/vendor/sign-in" />
    </>
  );
}

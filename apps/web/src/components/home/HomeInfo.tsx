import { getTranslations } from "next-intl/server";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Link } from "@kriraghor/ui/i18n/navigation";

/** The last home section: About and Help, each leading to its own page. */
export async function HomeInfo() {
  const t = await getTranslations("home.info");
  const boxes = [
    { key: "about", href: "/about" },
    { key: "help", href: "/help" },
  ];
  return (
    <section className="mx-auto grid max-w-wide gap-4 px-5 py-16 md:grid-cols-2" data-testid="home-info">
      {boxes.map((b) => (
        <div key={b.key} className="rv glass-card flex flex-col items-start gap-2 p-6">
          <h2 className="text-xl font-extrabold">{t(`${b.key}.title`)}</h2>
          <p className="max-w-[60ch] text-muted">{t(`${b.key}.body`)}</p>
          <Link href={b.href} className="mt-1 inline-flex min-h-11 items-center gap-1 font-bold text-brand-text underline-offset-4 hover:underline">
            {t(`${b.key}.link`)} <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      ))}
    </section>
  );
}

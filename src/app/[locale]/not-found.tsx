import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { esportsHref } from "@/lib/links";

export const metadata = { title: "Page not found", robots: { index: false } };

/** 404 (launch polish): what happened, then the four places most people were looking for. */
export default function NotFound() {
  const t = useTranslations("notFound");
  const links = [
    { href: "/", label: t("home") },
    { href: "/grounds", label: t("grounds") },
    { href: "/shop", label: t("shop") },
    { href: "/hiring", label: t("hire") },
  ];
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-20" data-testid="not-found">
      <p className="text-sm font-bold uppercase tracking-[0.12em] text-brand-text">404</p>
      <h1 className="mt-3 max-w-[20ch] text-4xl font-extrabold md:text-5xl">{t("title")}</h1>
      <p className="mt-4 max-w-[52ch] text-lg text-muted">{t("body")}</p>
      <ul className="mt-8 flex flex-wrap gap-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="inline-flex min-h-12 items-center border-2 border-line-strong px-5 font-bold hover:bg-surface-2">
              {l.label}
            </Link>
          </li>
        ))}
        <li>
          <a href={esportsHref("/tournaments")} className="inline-flex min-h-12 items-center bg-brand px-5 font-bold text-white hover:bg-brand-hover">
            {t("esports")}
          </a>
        </li>
      </ul>
    </section>
  );
}

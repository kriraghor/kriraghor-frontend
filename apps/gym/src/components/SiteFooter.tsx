import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { webHref } from "@/lib/links";

/** Gym footer: the gym pages, running a gym, and kriraghor.com (the shop, help and the legal pages). */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  const cols = [
    {
      title: t("train"),
      own: true,
      links: [
        { href: "/gyms", label: t("gyms") },
        { href: "/trainers", label: t("trainers") },
        { href: "/me/passes", label: t("myPasses") },
        { href: "/me/subscriptions", label: t("myPlans") },
      ],
    },
    {
      title: t("business"),
      own: true,
      links: [
        { href: "/start", label: t("start") },
        { href: "/manage", label: t("manage") },
      ],
    },
    {
      title: t("help"),
      own: false,
      links: [
        { href: webHref("/shop?category=gym"), label: t("gear") },
        { href: webHref("/help"), label: t("helpCentre") },
        { href: webHref("/refund-policy"), label: t("refunds") },
        { href: webHref("/terms"), label: t("terms") },
        { href: webHref("/privacy"), label: t("privacy") },
        { href: webHref(), label: t("kriraghor") },
      ],
    },
  ];
  const link = "inline-flex min-h-11 items-center text-sm hover:underline";
  return (
    <footer className="mt-16 border-t border-line bg-surface text-ink" data-testid="site-footer">
      <div className="mx-auto grid max-w-[1320px] gap-8 px-5 py-12 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 no-underline" aria-label={t("homeLabel")}>
            <Image src="/logo.png" alt="" width={36} height={36} />
            <span className="font-display text-lg font-extrabold">{t("brand")}</span>
          </Link>
          <p className="mt-3 max-w-[34ch] text-sm text-muted">{t("tagline")}</p>
        </div>
        {cols.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-muted">{col.title}</h3>
            <ul className="mt-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  {col.own ? (
                    <Link href={l.href} className={link}>
                      {l.label}
                    </Link>
                  ) : (
                    <a href={l.href} className={link}>
                      {l.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p className="mx-auto max-w-[1320px] border-t border-line px-5 py-5 text-sm text-muted">{t("legal")}</p>
    </footer>
  );
}

import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { webHref } from "@/lib/links";

/** Esports footer: the esports pages, kriraghor.com, and the help and legal pages (on kriraghor.com). */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  const own = [
    { href: "/events", label: t("events") },
    { href: "/showcases", label: t("showcases") },
    { href: "/leaderboards", label: t("leaderboards") },
    { href: "/me/matches", label: t("myMatches") },
  ];
  const web = [
    { href: webHref("/fair-play"), label: t("fairPlay") },
    { href: webHref("/help"), label: t("help") },
    { href: webHref("/refund-policy"), label: t("refunds") },
    { href: webHref("/terms"), label: t("terms") },
    { href: webHref("/privacy"), label: t("privacy") },
    { href: webHref(), label: t("kriraghor") },
  ];
  const link = "inline-flex min-h-11 items-center text-sm hover:underline";
  return (
    <footer className="mt-16 bg-band text-band-text" data-testid="site-footer">
      <div className="mx-auto grid max-w-[1320px] gap-8 px-5 py-12 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 no-underline" aria-label={t("homeLabel")}>
            <Image src="/logo.png" alt="" width={36} height={36} />
            <span className="font-display text-lg font-extrabold">{t("brand")}</span>
          </Link>
          <p className="mt-3 max-w-[34ch] text-sm text-band-muted">{t("tagline")}</p>
        </div>
        <nav aria-label={t("play")}>
          <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-band-muted">{t("play")}</h3>
          <ul className="mt-2">
            {own.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={link}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={t("help")}>
          <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-band-muted">{t("help")}</h3>
          <ul className="mt-2">
            {web.map((l) => (
              <li key={l.href}>
                <a href={l.href} className={link}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <p className="mx-auto max-w-[1320px] border-t border-band-line px-5 py-5 text-sm text-band-muted">{t("legal")}</p>
    </footer>
  );
}

import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { esportsHref, gymHref } from "@/lib/links";

type Col = { title: string; links: { href: string; label: string }[] };

/**
 * Site footer (home-v3 §10): brand, then Esports, Play, Business and Help. Rendered on the server;
 * esports links go through /go/esports so the HTML never carries a build-time host. No "Panels"
 * link (design audit) and no app-store buttons until the mobile app ships.
 */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  const cols: Col[] = [
    {
      title: t("esports"),
      links: [
        { href: esportsHref("/events"), label: t("tournaments") },
        { href: esportsHref("/leaderboards"), label: t("leaderboards") },
        { href: "/fair-play", label: t("fairPlay") },
      ],
    },
    {
      title: t("play"),
      links: [
        { href: "/venues", label: t("grounds") },
        { href: "/shop", label: t("shop") },
        { href: "/hiring", label: t("hire") },
        { href: gymHref(), label: t("gym") },
        { href: "/events", label: t("sportsTournaments") },
      ],
    },
    {
      title: t("business"),
      links: [
        { href: "/account/business", label: t("listGround") },
        { href: "/account/business?as=shop", label: t("openShop") },
        { href: "/account/business?as=pro", label: t("getHired") },
        { href: "/account/business?as=gym", label: t("listGym") },
        { href: "/account/business?as=organiser", label: t("organisers") },
      ],
    },
    {
      title: t("help"),
      links: [
        { href: "/help", label: t("helpCentre") },
        { href: "/refund-policy", label: t("refunds") },
        { href: "/buyer-protection", label: t("buyerProtection") },
        { href: "/terms", label: t("terms") },
        { href: "/privacy", label: t("privacy") },
      ],
    },
  ];

  return (
    <footer className="bg-band text-band-text" data-testid="site-footer">
      <div className="mx-auto max-w-[1320px] px-5 py-14">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 no-underline" aria-label={t("homeLabel")}>
              <Image src="/logo.png" alt="" width={38} height={38} />
              <span className="font-bangla text-xl font-bold" lang="bn">
                ক্রীড়াঘর
              </span>
            </Link>
            <p className="mt-3 max-w-[34ch] text-sm text-band-muted">{t("tagline")}</p>
          </div>
          {cols.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-band-muted">{col.title}</h3>
              <ul className="mt-3 flex flex-col">
                {col.links.map((l) => (
                  <li key={l.href}>
                    {l.href.startsWith("/go/") ? (
                      <a href={l.href} className="inline-flex min-h-11 items-center text-sm hover:underline">
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="inline-flex min-h-11 items-center text-sm hover:underline">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="mt-10 border-t border-band-line pt-6 text-sm text-band-muted">{t("legal")}</p>
      </div>
    </footer>
  );
}

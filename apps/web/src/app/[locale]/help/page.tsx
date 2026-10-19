import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { helpGroups } from "@/content/legal";

export const metadata = { title: "Help centre", alternates: { canonical: "/help" } };

/**
 * Help centre (launch polish): common questions in native <details> accordions (keyboard and
 * screen-reader friendly without JavaScript), each with a link to where the task is done.
 */
export default async function HelpPage({ params }: PageProps<"/[locale]/help">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("help");
  const groups = helpGroups(locale);
  const policies = [
    { href: "/refund-policy", label: t("refunds") },
    { href: "/buyer-protection", label: t("protection") },
    { href: "/fair-play", label: t("fairPlay") },
    { href: "/terms", label: t("terms") },
    { href: "/privacy", label: t("privacy") },
  ];
  return (
    <div className="mx-auto max-w-[1100px] px-5 py-12" data-testid="help-page">
      <h1 className="text-4xl font-extrabold">{t("title")}</h1>
      <p className="mt-3 max-w-[60ch] text-lg text-muted">{t("sub")}</p>
      <div className="mt-10 grid gap-10 md:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-10">
          {groups.map((g) => (
            <section key={g.id} id={g.id} aria-labelledby={`help-${g.id}`} className="scroll-mt-24">
              <h2 id={`help-${g.id}`} className="text-2xl font-extrabold">
                {g.title}
              </h2>
              <div className="glass-card mt-3 divide-y divide-[var(--glass-edge)] px-5">
                {g.items.map((it) => (
                  <details key={it.q} className="group">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-bold">
                      {it.q}
                      <span className="text-xl text-muted transition-transform group-open:rotate-45" aria-hidden>
                        +
                      </span>
                    </summary>
                    <div className="pb-4 text-muted">
                      <p className="max-w-[65ch]">{it.a}</p>
                      {it.link ? (
                        <Link href={it.link.href} className="mt-2 inline-flex min-h-11 items-center font-semibold text-brand-text underline">
                          {it.link.label}
                        </Link>
                      ) : null}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
        <aside className="glass-card h-fit p-5 md:sticky md:top-24">
          <h2 className="text-lg font-extrabold">{t("policies")}</h2>
          <ul className="mt-2 flex flex-col">
            {policies.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className="inline-flex min-h-11 items-center hover:underline">
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
          <h2 className="mt-6 text-lg font-extrabold">{t("contact")}</h2>
          <p className="mt-2 text-sm text-muted">{t("contactBody")}</p>
        </aside>
      </div>
    </div>
  );
}

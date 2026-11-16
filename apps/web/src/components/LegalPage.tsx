import { getTranslations } from "next-intl/server";
import type { LegalDoc } from "@/content/legal";
import { LEGAL_VERSION } from "@/content/legal";

/**
 * A legal page (launch polish): the draft notice, version and date, a table of contents with anchors,
 * then the sections. Print-friendly: the site header, footer and tab bar are hidden when printing.
 */
export async function LegalPage({ doc, locale }: { doc: LegalDoc; locale: string }) {
  const t = await getTranslations("legal");
  const updated = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" }).format(new Date(`${LEGAL_VERSION.updated}T12:00:00+06:00`));
  return (
    <article className="mx-auto max-w-[860px] px-5 py-12" data-testid="legal-page">
      <p className="rounded-control border-l-4 border-warning bg-warning-soft px-4 py-3 text-sm font-semibold text-ink" role="note">
        {t("draft")}
      </p>
      <h1 className="mt-6 text-4xl font-extrabold">{doc.title}</h1>
      <p className="mt-2 text-sm text-muted">{t("version", { version: LEGAL_VERSION.version, updated })}</p>
      <p className="mt-6 max-w-[65ch] text-lg">{doc.intro}</p>
      <nav aria-label={t("contents")} className="surface-card mt-8 p-5 print:hidden">
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-muted">{t("contents")}</h2>
        <ol className="mt-2 grid gap-x-6 sm:grid-cols-2">
          {doc.sections.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="inline-flex min-h-11 items-center gap-2 hover:underline">
                <span className="w-6 text-sm tabular-nums text-muted">{i + 1}.</span>
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      {doc.sections.map((s, i) => (
        <section key={s.id} id={s.id} className="mt-10 scroll-mt-24">
          <h2 className="text-2xl font-extrabold">
            {i + 1}. {s.title}
          </h2>
          {s.body.map((b, j) =>
            typeof b === "string" ? (
              <p key={j} className="mt-3 max-w-[65ch]">
                {b}
              </p>
            ) : (
              <ul key={j} className="mt-3 flex max-w-[65ch] list-disc flex-col gap-2 pl-6">
                {b.map((li) => (
                  <li key={li}>{li}</li>
                ))}
              </ul>
            )
          )}
        </section>
      ))}
    </article>
  );
}

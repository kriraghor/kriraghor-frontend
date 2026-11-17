"use client";

import { useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";

/**
 * Error boundary for every page (launch polish). Shows only Next's error digest, a reference staff
 * can find in the server logs; never the message, which may carry details from the request.
 */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("pageError");
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-20" role="alert" data-testid="page-error">
      <h1 className="max-w-[20ch] text-4xl font-extrabold">{t("title")}</h1>
      <p className="mt-4 max-w-[52ch] text-lg text-muted">{t("body")}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="inline-flex min-h-12 items-center bg-brand px-5 font-bold text-on-brand hover:bg-brand-hover">
          {t("retry")}
        </button>
        <Link href="/" className="rounded-control inline-flex min-h-12 items-center border border-line-strong px-5 font-bold">
          {t("home")}
        </Link>
      </div>
      {error.digest ? <p className="mt-6 text-sm text-muted">{t("reference", { digest: error.digest })}</p> : null}
    </section>
  );
}

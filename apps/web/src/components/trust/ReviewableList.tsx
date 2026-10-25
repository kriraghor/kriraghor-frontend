"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Notice } from "@kriraghor/ui/kit";
import { RateButton, reviewDate, targetOf, useReviewable } from "@kriraghor/ui/trust";
import { isExternal } from "@/lib/links";
import { sourceHref, subjectNameOf } from "@/lib/trust";

/**
 * /me/reviews, "Waiting for your rating": one card per item (venue, pro, shop, gym), newest first,
 * with what it was, when, the last day to rate it, and "Rate this". The rating dialog itself is
 * shared with gym.kriraghor.com (@kriraghor/ui/trust); a gym pass opens on the gym site.
 */
export function ReviewableList() {
  const t = useTranslations("trust");
  const locale = useLocale();
  const q = useReviewable();
  const items = q.data?.items ?? [];
  if (q.isPending) return <div className="h-24 animate-pulse bg-surface-2" />;
  if (q.isError) return <Notice tone="error">{t("reviewable.loadFailed")}</Notice>;
  if (!items.length) return <p className="text-muted" data-testid="reviewable-empty">{t("reviewable.none")}</p>;
  return (
    <ul className="grid gap-3 md:grid-cols-2" data-testid="reviewable">
      {items.map((x) => {
        const name = subjectNameOf(x) ?? t(`subjects.${x.subjectType}`);
        const href = sourceHref(x);
        const label = t(`reviewable.source.${x.sourceType}`, { ref: x.ref });
        return (
          <li key={`${x.sourceType}-${x.sourceId}`} className="glass-card flex flex-col gap-3 p-4" data-testid="reviewable-item">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">{t(`subjects.${x.subjectType}`)}</p>
              <p className="mt-0.5 truncate text-lg font-extrabold">{name}</p>
              <p className="mt-1 text-sm text-muted">
                {isExternal(href) ? (
                  <a href={href} className="font-semibold underline">
                    {label}
                  </a>
                ) : (
                  <Link href={href} className="font-semibold underline">
                    {label}
                  </Link>
                )}{" "}
                · {t("reviewable.done", { when: reviewDate(x.doneAt, locale) })}
              </p>
              <p className="text-sm text-muted">{t("reviewable.closes", { when: reviewDate(x.closesAt, locale) })}</p>
            </div>
            <div>
              <RateButton target={targetOf(x)} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

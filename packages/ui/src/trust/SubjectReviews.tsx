"use client";

import type { ReactNode } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Star } from "@phosphor-icons/react";
import { ratingSummary, sharedReviews as reviews, type ReviewSubject } from "./reviews";
import { ReportButton } from "./ReportButton";

/** A day in Dhaka ("21 Oct 2026"), in the page's language. */
export const reviewDate = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" }).format(new Date(iso));

/** A number in the page's language (Bangla digits on /bn). */
export const localNumber = (v: number, locale: string, digits = 0) =>
  v.toLocaleString(locale === "bn" ? "bn-BD" : "en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Five stars, filled to the rating; the number is also read out. */
export function Stars({ value, label, size = "h-4 w-4" }: { value: number; label: string; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-brand" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className={size} aria-hidden="true">
          <path d="M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6L10 15l-5.4 3 1.2-6L1.3 7.8l6.1-.7z" fill={i <= Math.round(value) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4" />
        </svg>
      ))}
    </span>
  );
}

/**
 * The short rating for a card or a page header: "★ 4.6 · 12 reviews", or "No rating yet" while the
 * API holds the average back (null until reviews.min_count_display reviews), with the count if any.
 */
export function RatingLine({ avg, count, className }: { avg: number | null; count: number; className?: string }) {
  const t = useTranslations("trust.reviews");
  const locale = useLocale();
  return (
    <span className={className} data-testid="rating-line">
      {avg !== null ? (
        <>
          <Star size={14} weight="fill" aria-hidden className="-mt-0.5 mr-0.5 inline text-brand" />
          <span className="sr-only">{t("starsOf", { stars: localNumber(avg, locale, 1) })}</span>
          <span aria-hidden="true" className="font-semibold tabular-nums">
            {localNumber(avg, locale, 1)}
          </span>
          {" · "}
          {t("count", { count })}
        </>
      ) : count ? (
        `${t("noRatingYet")} · ${t("count", { count })}`
      ) : (
        t("noRatingYet")
      )}
    </span>
  );
}

/**
 * The public reviews block for any subject (M17 FR-35): a venue, a pro's hire profile, a shop or a
 * gym. The average shows only once the API sends one (reviews.min_count_display reviews), then the
 * spread of stars and the newest reviews with the owner's reply, 20 at a time with Load more. Only
 * published reviews come back, without their source, so nothing private is shown. Anyone signed in
 * can report a review.
 */
export function SubjectReviews({ subjectType, subjectId, action, testId = "subject-reviews" }: { subjectType: ReviewSubject; subjectId: string; action?: ReactNode; testId?: string }) {
  const t = useTranslations("trust.reviews");
  const locale = useLocale();
  const q = useInfiniteQuery({
    queryKey: ["subject-reviews", subjectType, subjectId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => reviews.forSubject(subjectType, subjectId, pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const n = (v: number, digits = 0) => localNumber(v, locale, digits);
  const first = q.data?.pages[0];
  const s = ratingSummary(first?.summary);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const titleId = `reviews-title-${subjectType}`;

  return (
    <section className="mt-10" aria-labelledby={titleId} data-testid={testId}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={titleId} className="text-2xl font-extrabold">
          {t("title")}
        </h2>
        {action}
      </div>
      {q.isPending ? <div className="rounded-card mt-4 h-32 kg-shimmer bg-surface-2" /> : null}
      {q.isError ? (
        <p className="mt-4 text-sm text-muted" role="status">
          {t("loadFailed")}{" "}
          <button type="button" onClick={() => void q.refetch()} className="font-semibold text-brand underline">
            {t("retry")}
          </button>
        </p>
      ) : null}
      {first ? (
        <>
          <div className="mt-4 grid gap-6 border-y-2 border-line py-4 sm:grid-cols-[auto_1fr]">
            <div>
              {s.showAvg && s.avg !== null ? (
                <>
                  <p className="text-4xl font-extrabold tabular-nums" data-testid="rating-avg">
                    {n(s.avg, 1)}
                  </p>
                  <Stars value={s.avg} label={t("starsOf", { stars: n(s.avg, 1) })} />
                </>
              ) : (
                <p className="max-w-[16rem] font-semibold">{s.count ? t("tooFew") : t("noRatingYet")}</p>
              )}
              <p className="mt-1 text-sm text-muted">{t("count", { count: s.count })}</p>
            </div>
            {s.count ? (
              <ol className="space-y-1 text-sm" aria-label={t("spread")}>
                {s.spread.map((x) => (
                  <li key={x.stars} className="grid grid-cols-[2.5rem_1fr_2rem] items-center gap-2">
                    <span className="tabular-nums">{t("starsShort", { stars: n(x.stars) })}</span>
                    <span className="h-2 bg-surface-2">
                      <span className="block h-2 bg-brand" style={{ width: `${x.pct}%` }} />
                    </span>
                    <span className="text-right tabular-nums text-muted">{n(x.n)}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
          {items.length ? (
            <ul className="mt-2 divide-y-2 divide-line">
              {items.map((r) => (
                <li key={r.id} className="py-4" data-testid="review">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars value={r.stars} label={t("starsOf", { stars: n(r.stars) })} />
                    <span className="font-semibold">{r.author.displayName ?? t("member")}</span>
                    <span className="text-sm text-muted">{reviewDate(r.createdAt, locale)}</span>
                  </div>
                  {r.text ? <p className="mt-2 max-w-[65ch] whitespace-pre-line leading-relaxed">{r.text}</p> : null}
                  {r.reply ? (
                    <div className="mt-3 border-l-4 border-line pl-3 text-sm" data-testid="review-reply">
                      <p className="font-semibold">{t(`replyFrom.${subjectType}`)}</p>
                      <p className="mt-1 whitespace-pre-line text-muted">{r.reply.text}</p>
                    </div>
                  ) : null}
                  <div className="mt-2">
                    <ReportButton subjectType="review" subjectId={r.id} label={t("reportReview")} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-muted" data-testid="reviews-empty">
              {t(`empty.${subjectType}`)}
            </p>
          )}
          {q.hasNextPage ? (
            <button type="button" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} className="rounded-control mt-4 min-h-12 border border-line-strong/60 px-5 font-bold hover:border-brand disabled:opacity-50" data-testid="reviews-more">
              {t("more")}
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

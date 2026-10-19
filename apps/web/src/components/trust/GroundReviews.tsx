"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { reviews } from "@/lib/trust";
import { ReportButton } from "./ReportButton";

const dateLabel = (iso: string, locale: string) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" }).format(new Date(iso));

/** Five stars, filled to the rating; the number is also read out. */
export function Stars({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-brand" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
          <path d="M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6L10 15l-5.4 3 1.2-6L1.3 7.8l6.1-.7z" fill={i <= Math.round(value) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4" />
        </svg>
      ))}
    </span>
  );
}

/**
 * Reviews on /grounds/[slug] (M17 FR-23): the average (shown once the ground has enough reviews),
 * the spread of stars, then the newest reviews with the owner's replies. Members who played there
 * rate it from their booking; anyone signed in can report a review or the ground.
 */
export function GroundReviews({ groundId }: { groundId: string }) {
  const t = useTranslations("trust.reviews");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["ground-reviews", groundId], queryFn: () => reviews.forGround(groundId) });
  const n = (v: number, digits = 0) => v.toLocaleString(locale === "bn" ? "bn-BD" : "en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

  return (
    <section className="mt-10" aria-labelledby="reviews-title" data-testid="ground-reviews">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="reviews-title" className="text-2xl font-extrabold">
          {t("title")}
        </h2>
        <ReportButton subjectType="ground" subjectId={groundId} label={t("reportGround")} />
      </div>
      {q.isPending ? <div className="mt-4 h-32 animate-pulse bg-surface-2" /> : null}
      {q.data ? (
        <>
          <div className="mt-4 grid gap-6 border-y-2 border-line py-4 sm:grid-cols-[auto_1fr]">
            <div>
              {q.data.summary.avg !== null ? (
                <>
                  <p className="text-4xl font-extrabold tabular-nums" data-testid="rating-avg">
                    {n(q.data.summary.avg, 1)}
                  </p>
                  <Stars value={q.data.summary.avg} label={t("starsOf", { stars: n(q.data.summary.avg, 1) })} />
                </>
              ) : (
                <p className="max-w-[16rem] text-sm text-muted">{t("tooFew")}</p>
              )}
              <p className="mt-1 text-sm text-muted">{t("count", { count: q.data.summary.count })}</p>
            </div>
            <ol className="space-y-1 text-sm" aria-label={t("spread")}>
              {[5, 4, 3, 2, 1].map((s) => {
                const c = q.data.summary.histogram[s - 1] ?? 0;
                const pct = q.data.summary.count ? (c / q.data.summary.count) * 100 : 0;
                return (
                  <li key={s} className="grid grid-cols-[2.5rem_1fr_2rem] items-center gap-2">
                    <span className="tabular-nums">{t("starsShort", { stars: n(s) })}</span>
                    <span className="h-2 bg-surface-2">
                      <span className="block h-2 bg-brand" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="text-right tabular-nums text-muted">{n(c)}</span>
                  </li>
                );
              })}
            </ol>
          </div>
          {q.data.items.length ? (
            <ul className="mt-2 divide-y-2 divide-line">
              {q.data.items.map((r) => (
                <li key={r.id} className="py-4" data-testid="review">
                  <div className="flex flex-wrap items-center gap-3">
                    <Stars value={r.stars} label={t("starsOf", { stars: n(r.stars) })} />
                    <span className="font-semibold">{r.author.displayName ?? t("member")}</span>
                    <span className="text-sm text-muted">{dateLabel(r.createdAt, locale)}</span>
                  </div>
                  {r.text ? <p className="mt-2 max-w-[65ch] leading-relaxed">{r.text}</p> : null}
                  {r.reply ? (
                    <div className="mt-3 border-l-4 border-line pl-3 text-sm">
                      <p className="font-semibold">{t("ownerReply")}</p>
                      <p className="mt-1 text-muted">{r.reply.text}</p>
                    </div>
                  ) : null}
                  <div className="mt-2">
                    <ReportButton subjectType="review" subjectId={r.id} label={t("reportReview")} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">{t("none")}</p>
          )}
        </>
      ) : null}
    </section>
  );
}

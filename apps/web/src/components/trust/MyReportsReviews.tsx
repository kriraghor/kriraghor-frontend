"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { useAuth } from "@kriraghor/ui/auth";
import { whenLabel } from "@/lib/bookings";
import { reports, reviews, subjectNameOf } from "@/lib/trust";
import { Notice } from "@kriraghor/ui/primitives";
import { ReviewableList } from "./RateDialog";
import { Stars } from "./SubjectReviews";

function Gate({ next, children }: { next: string; children: React.ReactNode }) {
  const t = useTranslations("trust");
  const { status } = useAuth();
  if (status === "signed_out")
    return (
      <Notice>
        {t("signedOut")}{" "}
        <Link href={`/sign-in?next=${next}`} className="underline">
          {t("signIn")}
        </Link>
      </Notice>
    );
  return <>{children}</>;
}

/** /me/reports (M17 FR-16): what I reported and how it ended (never who else reported). */
export function MyReports() {
  const t = useTranslations("trust");
  const locale = useLocale();
  const { status } = useAuth();
  const q = useQuery({ queryKey: ["my-reports"], queryFn: () => reports.mine(), enabled: status === "signed_in" });
  return (
    <section className="mx-auto max-w-3xl px-5 pb-16 pt-8">
      <h1 className="text-3xl font-extrabold">{t("myReports")}</h1>
      <div className="mt-6">
        <Gate next="/me/reports">
          {q.data && !q.data.items.length ? <p className="text-muted">{t("noReports")}</p> : null}
          <ul className="glass-card divide-y divide-[var(--glass-edge)] px-4">
            {q.data?.items.map((r) => (
              <li key={r.code} className="flex flex-wrap justify-between gap-3 py-3">
                <span>
                  <span className="block font-bold">{t(`report.subject.${r.subjectType}`)}</span>
                  <span className="block text-sm text-muted">
                    {t(`report.reasons.${r.reasonCode}`)} · {whenLabel(r.createdAt as string, locale)}
                  </span>
                </span>
                <span className="text-right text-sm font-semibold">{r.resolution ? t(`report.outcome.${r.resolution}`) : t(`report.status.${r.status}`)}</span>
              </li>
            ))}
          </ul>
        </Gate>
      </div>
    </section>
  );
}

/**
 * /me/reviews (M17 FR-22, FR-30 to FR-34): first what is waiting for my rating (venues I played at,
 * pros whose job was paid out, shop orders I received, gyms I visited), each with "Rate this"; then
 * my reviews with what they rate, whether each is shown, and the owner's reply.
 */
export function MyReviews() {
  const t = useTranslations("trust");
  const locale = useLocale();
  const { status } = useAuth();
  const q = useQuery({ queryKey: ["my-reviews"], queryFn: () => reviews.mine(), enabled: status === "signed_in" });
  return (
    <section className="mx-auto max-w-3xl px-5 pb-16 pt-8">
      <h1 className="text-3xl font-extrabold">{t("myReviews")}</h1>
      <div className="mt-6">
        <Gate next="/me/reviews">
          <h2 className="text-xl font-extrabold">{t("reviewable.title")}</h2>
          <p className="mt-1 text-sm text-muted">{t("reviewable.lead")}</p>
          <div className="mt-4">
            <ReviewableList />
          </div>
          <h2 className="mt-10 text-xl font-extrabold">{t("yourReviews")}</h2>
          {q.isPending && status === "signed_in" ? <div className="mt-3 h-24 animate-pulse bg-surface-2" /> : null}
          {q.data && !q.data.items.length ? <p className="mt-2 text-muted">{t("noReviewsYet")}</p> : null}
          {q.data?.items.length ? (
            <ul className="mt-3 glass-card divide-y divide-[var(--glass-edge)] px-4" data-testid="my-reviews">
              {q.data.items.map((r) => (
                <li key={r.id} className="py-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">{t(`subjects.${r.subjectType}`)}</p>
                  <p className="font-extrabold">{subjectNameOf(r) ?? t(`subjects.${r.subjectType}`)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars value={r.stars} label={t("reviews.starsOf", { stars: r.stars })} />
                    <span className="text-sm text-muted">{whenLabel(r.createdAt, locale)}</span>
                    <span className="border-2 border-line px-2 text-sm font-bold">{t.has(`reviewStatus.${r.status}`) ? t(`reviewStatus.${r.status}`) : r.status}</span>
                  </div>
                  {r.text ? <p className="mt-2 max-w-[65ch] whitespace-pre-line">{r.text}</p> : null}
                  {r.reply ? (
                    <div className="mt-3 border-l-4 border-line pl-3 text-sm" data-testid="my-review-reply">
                      <p className="font-semibold">{t(`reviews.replyFrom.${r.subjectType}`)}</p>
                      <p className="mt-1 whitespace-pre-line text-muted">{r.reply.text}</p>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </Gate>
      </div>
    </section>
  );
}

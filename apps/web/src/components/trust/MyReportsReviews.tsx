"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { whenLabel } from "@/lib/bookings";
import { reports, reviews } from "@/lib/trust";
import { Notice } from "../ui";
import { Stars } from "./GroundReviews";

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
          <ul className="divide-y-2 divide-line border-y-2 border-line">
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

/** /me/reviews (M17 FR-22): my ratings and whether each is shown. */
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
          {q.data && !q.data.items.length ? <p className="text-muted">{t("noReviews")}</p> : null}
          <ul className="divide-y-2 divide-line border-y-2 border-line">
            {q.data?.items.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Stars value={r.stars} label={t("reviews.starsOf", { stars: r.stars })} />
                  <span className="text-sm text-muted">{whenLabel(r.createdAt, locale)}</span>
                  <span className="border-2 border-line px-2 text-sm font-bold">{t(`reviewStatus.${r.status}`)}</span>
                </div>
                {r.text ? <p className="mt-1 max-w-[65ch]">{r.text}</p> : null}
              </li>
            ))}
          </ul>
        </Gate>
      </div>
    </section>
  );
}

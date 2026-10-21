"use client";

import { useTranslations } from "next-intl";
import { ReportButton } from "./ReportButton";
import { SubjectReviews } from "./SubjectReviews";

export { Stars } from "./SubjectReviews";

/**
 * Reviews on /venues/[slug] (M17 FR-23): the shared reviews block for a venue, plus "Report this
 * venue". Members who played there rate it from their booking.
 */
export function GroundReviews({ groundId }: { groundId: string }) {
  const t = useTranslations("trust.reviews");
  return <SubjectReviews subjectType="ground" subjectId={groundId} testId="ground-reviews" action={<ReportButton subjectType="ground" subjectId={groundId} label={t("reportGround")} />} />;
}

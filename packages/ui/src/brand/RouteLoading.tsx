"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "../kit/Display";

/**
 * The loading.tsx screen: the shape of a page (title, lead, cards) while it streams in. The logo
 * animation is kept for landing on the home page (BootSplash), never for waiting.
 */
export function RouteLoading() {
  const t = useTranslations("kit");
  return (
    <div className="mx-auto w-full max-w-wide px-5 py-8" role="status" aria-label={t("loading")} data-testid="route-loading">
      <Skeleton className="h-11 w-2/3 max-w-xl" />
      <Skeleton className="mt-3 h-5 w-full max-w-2xl" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-56 rounded-card" />
        ))}
      </div>
    </div>
  );
}

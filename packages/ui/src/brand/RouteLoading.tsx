"use client";

import { useTranslations } from "next-intl";
import { LogoSpinner } from "./LogoSpinner";

/** The loading.tsx screen: the logo spinner with the page's own "Loading" label. */
export function RouteLoading() {
  const t = useTranslations("kit");
  return <LogoSpinner label={t("loading")} />;
}

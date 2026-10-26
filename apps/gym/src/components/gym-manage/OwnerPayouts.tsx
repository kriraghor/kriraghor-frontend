"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft } from "@phosphor-icons/react";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { MyPayouts } from "@kriraghor/ui/payouts";
import { webHref } from "@/lib/links";

/**
 * /manage/payouts (owner; M24 §4.1, FR-46): the shared M07 payee view. Released online fees and pass
 * sales join the owner's weekly payout; each line shows gross, Kriraghor's fee, the provider charge
 * (online fees, passed through at cost) and net. The payout account lives on kriraghor.com (same account).
 */
export function OwnerPayouts() {
  const t = useTranslations("gm");
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pt-5 sm:px-6 md:pt-8" data-testid="gm-payouts">
      <Link href="/manage" className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-brand-text hover:underline">
        <ArrowLeft size={16} aria-hidden /> {t("myGyms")}
      </Link>
      <p className="mt-1 max-w-2xl text-sm text-muted">{t("payouts.lead")}</p>
      <MyPayouts signInHref="/sign-in?next=/manage/payouts" payoutAccountHref={webHref("/me/payout-account")} className="px-0 py-4" />
    </div>
  );
}

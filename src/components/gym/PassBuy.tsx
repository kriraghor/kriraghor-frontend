"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { problemOf } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { dayLabel, newKey } from "@/lib/bookings";
import { addDays, gym, openDates, type GymPage } from "@/lib/gym";
import { formatTaka } from "@/lib/payments";
import { Button, Notice } from "../ui";

/**
 * Buy a pass (M20 §5): pick a package, then a date. A day pass is for one open day up to
 * gym.pass_advance_days ahead; a month or quarter pass starts on the chosen date. The pass waits for
 * payment on the M06 page; once paid it shows as a QR on /me/passes.
 */
export function PassBuy({ page }: { page: GymPage }) {
  const t = useTranslations("gym");
  const locale = useLocale();
  const { status } = useAuth();
  const [packageId, setPackageId] = useState(page.packages[0]?.id);
  const pkg = page.packages.find((p) => p.id === packageId) ?? page.packages[0];
  const dates = pkg?.kind === "day" ? openDates(page.hours, page.today, page.advanceDays) : Array.from({ length: page.advanceDays }, (_, i) => addDays(page.today, i));
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const date = picked && dates.includes(picked) ? picked : dates[0];
  // A new Idempotency-Key per choice: a retry of the same choice replays, a new choice is a new pass.
  const [key, setKey] = useState(newKey);
  const choose = (fn: () => void) => {
    fn();
    setKey(newKey());
    buy.reset();
  };
  const buy = useMutation({
    mutationFn: () => gym.buy(pkg!.id, date!, key),
    onSuccess: (r) => {
      if (r.payment) window.location.assign(r.payment.payUrl);
    },
  });
  const problem = buy.error ? problemOf(buy.error) : null;

  if (!page.taking || !pkg) return <p className="font-bold">{t("notSelling")}</p>;
  if (status !== "signed_in")
    return (
      <div>
        <h2 className="text-xl font-extrabold">{t("buyTitle")}</h2>
        <p className="mt-2 text-sm text-muted">{t("signInToBuy")}</p>
        <Link href={`/sign-in?next=/gym/gyms/${page.slug}`} className="mt-3 inline-flex min-h-12 items-center bg-brand px-5 font-bold hover:bg-brand-hover">
          {t("signIn")}
        </Link>
      </div>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        buy.mutate();
      }}
      className="flex flex-col gap-4"
      data-testid="pass-buy"
    >
      <h2 className="text-xl font-extrabold">{t("buyTitle")}</h2>
      <fieldset>
        <legend className="text-xs font-bold uppercase tracking-wide text-muted">{t("pickPackage")}</legend>
        <div className="mt-2 grid gap-2">
          {page.packages.map((p) => (
            <label key={p.id} className={`flex min-h-12 cursor-pointer items-center justify-between border-2 px-3 ${p.id === pkg.id ? "border-brand" : "border-line"}`}>
              <span className="flex items-center gap-2">
                <input type="radio" name="package" value={p.id} checked={p.id === pkg.id} onChange={() => choose(() => setPackageId(p.id))} className="accent-[var(--kg-brand)]" />
                <span className="font-semibold">{t(`kind.${p.kind}`)}</span>
              </span>
              <span className="font-extrabold tabular-nums">{formatTaka(p.price, locale)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-bold uppercase tracking-wide text-muted">{pkg.kind === "day" ? t("pickDay") : t("pickStart")}</legend>
        {dates.length ? (
          <div className="mt-2 flex flex-wrap gap-1" role="radiogroup">
            {dates.map((d) => (
              <button key={d} type="button" role="radio" aria-checked={d === date} onClick={() => choose(() => setPicked(d))} className={`min-h-11 border-2 px-2 text-sm font-semibold ${d === date ? "border-brand bg-brand" : "border-line"}`} data-testid="pass-date">
                {d === page.today ? t("today") : dayLabel(d, locale)}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">{t("noOpenDays")}</p>
        )}
        {pkg.kind !== "day" && date ? <p className="mt-2 text-sm text-muted">{t("validUntil", { date: dayLabel(addDays(date, pkg.days - 1), locale) })}</p> : null}
      </fieldset>

      <div className="flex items-baseline justify-between border-t-2 border-line pt-3">
        <span className="font-semibold">{t("total")}</span>
        <span className="text-2xl font-extrabold tabular-nums">{formatTaka(pkg.price, locale)}</span>
      </div>
      <p className="text-sm text-muted">{pkg.kind === "day" ? t("dayRefund") : t("periodRefund")}</p>
      {problem ? (
        <Notice tone="error">
          {t.has(`err.${problem.code}`) ? t(`err.${problem.code}`) : problem.title}{" "}
          {problem.status === 403 ? (
            <Link href="/account/verification" className="font-bold underline">
              {t("verifyPhone")}
            </Link>
          ) : null}
        </Notice>
      ) : null}
      <Button type="submit" busy={buy.isPending} disabled={!date} data-testid="pass-pay">
        {t("payNow", { price: formatTaka(pkg.price, locale) })}
      </Button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { dayLabel, newKey } from "@/lib/bookings";
import { addDays, trainer } from "@/lib/trainer";
import { formatTaka } from "@/lib/payments";
import { Button, Notice } from "@kriraghor/ui/primitives";

/**
 * Monthly plans on a fitness trainer's page (M20 §6): pick a plan and a start date (today up to
 * gym.subscription_start_days ahead), then pay the first month on the M06 page. The money is held
 * and paid to the trainer at the end of the month; the first gym.subscription_cancel_days days
 * refund in full.
 */
export function TrainerPlans({ profileId, slug }: { profileId: string; slug: string }) {
  const t = useTranslations("gym");
  const locale = useLocale();
  const { status } = useAuth();
  const q = useQuery({ queryKey: ["trainer-plans", profileId], queryFn: () => trainer.plansOf(profileId) });
  const [planId, setPlanId] = useState<string | undefined>(undefined);
  const [start, setStart] = useState<string | undefined>(undefined);
  const [key, setKey] = useState(newKey);
  const subscribe = useMutation({
    mutationFn: ({ plan, date }: { plan: string; date: string }) => trainer.subscribe(plan, date, key),
    onSuccess: (s) => {
      if (s.payment) window.location.assign(s.payment.payUrl);
    },
  });
  if (q.isPending || q.isError || !q.data.items.length) return null;
  const offer = q.data;
  const plan = offer.items.find((p) => p.id === planId) ?? offer.items[0];
  const dates = Array.from({ length: Math.min(offer.startDays, 14) }, (_, i) => addDays(offer.today, i));
  const date = start && dates.includes(start) ? start : dates[0];
  const choose = (fn: () => void) => {
    fn();
    setKey(newKey());
    subscribe.reset();
  };
  const problem = subscribe.error ? problemOf(subscribe.error) : null;

  return (
    <div data-testid="trainer-plans">
      <h2 className="text-xl font-extrabold">{t("plansTitle")}</h2>
      <ul className="mt-3 grid gap-2">
        {offer.items.map((p) => (
          <li key={p.id}>
            <label className={`rounded-card flex cursor-pointer flex-col border p-3 ${p.id === plan.id ? "border-brand" : "border-line"}`}>
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-bold">
                  <input type="radio" name="plan" checked={p.id === plan.id} onChange={() => choose(() => setPlanId(p.id))} />
                  {p.title}
                </span>
                <span className="font-extrabold tabular-nums">{t("perMonth", { price: formatTaka(p.price, locale) })}</span>
              </span>
              <span className="mt-1 text-sm text-muted">
                {p.sessionsPerMonth ? t("sessions", { n: p.sessionsPerMonth }) : t("sessionsAgreed")} · {t(`where.${p.where}`)}
              </span>
              {p.description ? <span className="mt-1 text-sm">{p.description}</span> : null}
            </label>
          </li>
        ))}
      </ul>
      {status !== "signed_in" ? (
        <Link href={`/sign-in?next=/hiring/${slug}`} className="mt-4 inline-flex min-h-12 items-center bg-brand px-5 font-bold text-on-brand hover:bg-brand-hover">
          {t("signInToSubscribe")}
        </Link>
      ) : (
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            subscribe.mutate({ plan: plan.id, date: date! });
          }}
        >
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
            {t("startOn")}
            <select value={date} onChange={(e) => choose(() => setStart(e.target.value))} className="min-h-11 field px-3 text-ink" data-testid="plan-start">
              {dates.map((d) => (
                <option key={d} value={d}>
                  {d === offer.today ? t("today") : dayLabel(d, locale)}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-muted">{t("subscribeRule", { n: offer.cancelDays })}</p>
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
          <Button type="submit" busy={subscribe.isPending} data-testid="plan-subscribe">
            {t("subscribeFor", { price: formatTaka(plan.price, locale) })}
          </Button>
        </form>
      )}
    </div>
  );
}

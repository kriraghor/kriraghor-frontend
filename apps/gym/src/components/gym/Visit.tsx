"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowLeft, Footprints } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { SignedOutCard, useMe } from "@kriraghor/ui/account";
import { Link, useRouter } from "@kriraghor/ui/i18n/navigation";
import { Button, ButtonLink, Notice, Skeleton } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { gym } from "@/lib/gym";
import { webHref } from "@/lib/links";
import { nextDays } from "@/lib/manage";
import { bookableDays, dhakaMinuteNow, gymVisits, visitTimes } from "@/lib/gym-visits";
import { useFmt, useGymError } from "@/components/gym-manage/common";

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `gv-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * The gym page's **Book a free visit** (M24-FR-110, 9 Nov 2026): shown while the gym takes trial visits and a
 * day still has a place. It opens /gyms/[slug]/visit; signed-out visitors sign in there and come back.
 */
export function VisitCta({ slug }: { slug: string }) {
  const t = useTranslations("gv");
  const q = useQuery({ queryKey: ["gym-visit-slots", slug], queryFn: () => gymVisits.slots(slug), staleTime: 60_000, retry: false });
  if (!q.data?.open) return null;
  const days = bookableDays(q.data.days, { today: nextDays(1)[0], nowMinute: dhakaMinuteNow() });
  return (
    <div className="mt-4 border-t-2 border-line pt-4" data-testid="visit-cta">
      <p className="text-sm text-muted">{days.length ? t("cta.lead") : t("cta.full")}</p>
      {days.length ? (
        <ButtonLink href={`/gyms/${encodeURIComponent(slug)}/visit`} size="lg" variant="secondary" block className="mt-2" icon={<Footprints size={20} aria-hidden />} data-testid="visit-book">
          {t("cta.button")}
        </ButtonLink>
      ) : null}
    </div>
  );
}

/**
 * /gyms/[slug]/visit (M24-FR-111): pick a day (today to two weeks ahead, open days with a place left) and an
 * arrival time inside the gym's hours, then book. Confirmed at once; the guest lands on My visits with the
 * QR and code. A verified phone is needed (gate join_gym).
 */
export function VisitForm({ slug }: { slug: string }) {
  const t = useTranslations("gv");
  const tg = useTranslations("gym");
  const f = useFmt();
  const err = useGymError();
  const router = useRouter();
  const qc = useQueryClient();
  const { status } = useAuth();
  const { me } = useMe();
  const page = useQuery({ queryKey: ["gym", slug], queryFn: () => gym.page(slug), retry: false });
  const slots = useQuery({ queryKey: ["gym-visit-slots", slug], queryFn: () => gymVisits.slots(slug), retry: false });
  const [today] = useState(() => nextDays(1)[0]);
  const [nowMinute] = useState(() => dhakaMinuteNow());
  const days = useMemo(() => (slots.data ? bookableDays(slots.data.days, { today, nowMinute }) : []), [slots.data, today, nowMinute]);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [key] = useState(newKey);
  const day = days.find((d) => d.date === (date ?? days[0]?.date)) ?? null;
  const times = day ? visitTimes(day.windows, { isToday: day.date === today, nowMinute }) : [];
  const chosenTime = time && times.includes(time) ? time : null;
  const book = useMutation({
    mutationFn: () => gymVisits.book({ gymId: page.data!.id, date: day!.date, arriveAt: chosenTime! }, key),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-gym-visits"] });
      void qc.invalidateQueries({ queryKey: ["gym-visit-slots", slug] });
      router.push("/me/visits?booked=1");
    },
  });

  const shell = (body: React.ReactNode) => (
    <div data-theme="gym" className="min-h-[70dvh]">
      <section className="mx-auto w-full max-w-[720px] px-4 py-8 sm:px-6" data-testid="visit-page">
        <Link href={`/gyms/${encodeURIComponent(slug)}`} className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-brand underline">
          <ArrowLeft size={16} aria-hidden /> {page.data?.name ?? tg("back")}
        </Link>
        {body}
      </section>
    </div>
  );

  if (status === "signed_out") return shell(<SignedOutCard signInHref={`/sign-in?next=${encodeURIComponent(`/gyms/${slug}/visit`)}`} />);
  if (page.isPending || slots.isPending || me.isPending) return shell(<Skeleton className="mt-6 h-96 w-full" />);
  if (page.isError || !page.data) return shell(<h1 className="mt-6 text-2xl font-extrabold">{tg("notFound")}</h1>);
  const g = page.data;
  const heading = (
    <>
      <h1 className="mt-4 font-display text-3xl font-extrabold">{t("form.title", { gym: g.name })}</h1>
      <p className="mt-1 max-w-xl text-muted">{t("form.lead")}</p>
    </>
  );
  if (!slots.data?.open) return shell(<>{heading}<Notice tone="info" className="mt-6">{t("form.closed")}</Notice></>);
  // M01 gate join_gym: a verified phone. Accounts made with Google or email add one on kriraghor.com.
  if (me.data && !me.data.phoneVerified)
    return shell(
      <>
        {heading}
        <Notice tone="warning" className="mt-6" title={t("form.phoneTitle")} action={<ButtonLink href={webHref("/account/settings")} size="sm">{t("form.phoneCta")}</ButtonLink>}>
          {t("form.phoneBody")}
        </Notice>
      </>,
    );
  if (!days.length) return shell(<>{heading}<Notice tone="info" className="mt-6">{t("cta.full")}</Notice></>);

  const code = book.error ? problemOf(book.error)?.code : null;
  return shell(
    <>
      {heading}
      {slots.data.note ? (
        <Notice tone="info" className="mt-4" title={t("form.noteTitle")}>
          <span className="whitespace-pre-line">{slots.data.note}</span>
        </Notice>
      ) : null}
      <form
        className="mt-6 flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (day && chosenTime) book.mutate();
        }}
      >
        <fieldset className="min-w-0">
          <legend className="text-sm font-bold">{t("form.day")}</legend>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label={t("form.day")} data-testid="visit-days">
            {days.map((d) => {
              const on = d.date === day?.date;
              return (
                <button
                  key={d.date}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => (setDate(d.date), setTime(null))}
                  className={cn("flex min-h-16 min-w-20 shrink-0 flex-col items-center justify-center rounded-control border px-3 py-2 text-sm transition-colors", on ? "border-brand bg-brand-soft font-bold" : "border-line hover:border-brand/60")}
                  data-testid="visit-day"
                >
                  <span>{d.date === today ? t("form.today") : f.weekday(d.date)}</span>
                  <span className="tabular-nums">{f.short(d.date)}</span>
                </button>
              );
            })}
          </div>
          {day ? <p className="mt-2 text-sm text-muted">{t("form.places", { n: f.n(day.placesLeft) })}</p> : null}
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="text-sm font-bold">{t("form.time")}</legend>
          <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6" role="radiogroup" aria-label={t("form.time")} data-testid="visit-times">
            {times.map((tm) => {
              const on = tm === chosenTime;
              const ladies = day?.windows.some((w) => w.womenOnly && tm >= w.openTime && tm < w.closeTime);
              return (
                <button
                  key={tm}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setTime(tm)}
                  className={cn("min-h-11 rounded-control border text-sm font-semibold tabular-nums transition-colors", on ? "border-brand bg-brand text-on-brand" : "border-line hover:border-brand/60")}
                  data-testid="visit-time"
                >
                  {tm}
                  {ladies ? <span className="block text-xs font-bold uppercase">{tg("womenOnly")}</span> : null}
                </button>
              );
            })}
          </div>
        </fieldset>
        <p className="text-sm text-muted">{t("form.privacy", { gym: g.name })}</p>
        {book.isError ? (
          <p role="alert" className="text-sm font-semibold text-danger" data-testid="visit-error">
            {code && t.has(`err.${code}`) ? t(`err.${code}`) : err(book.error)}
          </p>
        ) : null}
        <Button type="submit" size="lg" busy={book.isPending} disabled={!chosenTime} className="self-start" data-testid="visit-confirm">
          {chosenTime && day ? t("form.confirm", { day: day.date === today ? t("form.todayInline") : f.short(day.date), time: chosenTime }) : t("form.pickTime")}
        </Button>
      </form>
    </>,
  );
}

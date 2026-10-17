"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { problemOf } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { bookings, canStartAt, coveredIndexes, dayLabel, daysBetween, newKey, timeLabel, useGroundLive, type PaymentChoice } from "@/lib/bookings";
import { formatTaka } from "@/lib/payments";
import { Notice } from "../ui";

const CELL: Record<string, string> = {
  open: "border-line bg-surface hover:border-brand",
  booked: "border-transparent bg-surface-2 text-muted line-through",
  yours: "border-brand bg-brand/10 text-brand",
  closed: "border-transparent bg-surface-2 text-muted",
  past: "border-transparent bg-transparent text-muted/60",
};

/**
 * The booking aside of /grounds/[slug] (M10 FR-01 to FR-06, v3): a 7-day strip, court and length, the
 * half-hour grid (live through the ground's socket room), then both payment options from the shared
 * calculator. "Hold and pay" holds the slot for 10 minutes and opens the M06 payment page.
 */
export function BookingWidget({ groundId, slug }: { groundId: string; slug: string }) {
  const t = useTranslations("bookings");
  const locale = useLocale();
  const { status } = useAuth();
  const qc = useQueryClient();
  const [date, setDate] = useState<string | undefined>(undefined);
  const [courtId, setCourtId] = useState<string | undefined>(undefined);
  const [minutes, setMinutes] = useState<number | undefined>(undefined);
  const [startIndex, setStartIndex] = useState<number | null>(null);
  const [choice, setChoice] = useState<PaymentChoice>("advance");

  const grid = useQuery({ queryKey: ["availability", groundId, date ?? "today"], queryFn: () => bookings.availability(groundId, date), refetchInterval: 30_000 });
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ["availability", groundId] }), [qc, groundId]);
  useGroundLive(groundId, refresh);

  const a = grid.data;
  const court = a?.courts.find((k) => k.id === courtId) ?? a?.courts[0];
  const length = minutes ?? a?.lengths[0] ?? 60;
  const cells = useMemo(() => court?.cells ?? [], [court]);
  const selected = startIndex !== null && canStartAt(cells, startIndex, length) ? cells[startIndex] : null;
  const covered = coveredIndexes(selected ? startIndex : null, length);

  const quote = useQuery({
    queryKey: ["quote", groundId, court?.id, selected?.start, length],
    queryFn: () => bookings.quote(groundId, [court!.id], selected!.start, length),
    enabled: Boolean(court && selected),
  });

  const holdIt = useMutation({
    mutationFn: () => bookings.hold({ groundId, courtIds: [court!.id], start: selected!.start, minutes: length, payment: choice }, newKey()),
    onSuccess: (r) => {
      if (r.payment) window.location.assign(r.payment.payUrl);
    },
    onError: () => refresh(),
  });
  const problem = holdIt.error ? problemOf(holdIt.error) : null;
  const money = (n: number) => formatTaka(n, locale);
  const pick = (fn: () => void) => {
    fn();
    setStartIndex(null);
    holdIt.reset();
  };

  if (grid.isPending) return <div className="h-72 animate-pulse bg-surface-2" role="status" aria-label={t("loading")} />;
  if (grid.isError || !a) return <Notice tone="error">{t("gridFailed")}</Notice>;
  if (!a.bookable) return <p className="font-bold">{t("notTaking")}</p>;

  const options = quote.data?.options ?? [];
  return (
    <div data-testid="booking-widget">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{t("pickDay")}</p>
      <div className="mt-2 flex gap-1 overflow-x-auto" role="tablist" aria-label={t("pickDay")}>
        {daysBetween(a.window.from, a.window.to).map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={d === a.date}
            onClick={() => pick(() => setDate(d))}
            className={`min-h-11 shrink-0 border-2 px-2 text-sm font-semibold ${d === a.date ? "border-brand bg-brand text-white" : "border-line bg-surface"}`}
          >
            {dayLabel(d, locale)}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
          {t("court")}
          <select className="min-h-11 border-2 border-line bg-surface px-2 text-ink" value={court?.id} onChange={(e) => pick(() => setCourtId(e.target.value))}>
            {a.courts.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
          {t("length")}
          <select className="min-h-11 border-2 border-line bg-surface px-2 text-ink" value={length} onChange={(e) => pick(() => setMinutes(Number(e.target.value)))}>
            {a.lengths.map((m) => (
              <option key={m} value={m}>
                {t("minutes", { n: m })}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">{t("pickStart")}</p>
      <div className="mt-2 grid max-h-64 grid-cols-4 gap-1 overflow-y-auto pr-1" data-testid="slot-grid">
        {cells.map((c, i) => {
          const startable = canStartAt(cells, i, length);
          const on = covered.has(i);
          return (
            <button
              key={c.start}
              type="button"
              disabled={!startable && !on}
              aria-pressed={on}
              aria-label={`${timeLabel(c.start, locale)}, ${t(`state.${c.state}`)}`}
              onClick={() => {
                setStartIndex(i);
                holdIt.reset();
              }}
              className={`min-h-11 border-2 text-xs font-semibold tabular-nums disabled:cursor-not-allowed ${on ? "border-brand bg-brand text-white" : CELL[c.state]}`}
              data-state={c.state}
            >
              {timeLabel(c.start, locale)}
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="mt-4 border-t-2 border-line pt-4" aria-live="polite">
          <p className="font-bold">
            {timeLabel(selected.start, locale)} · {t("minutes", { n: length })} · {court?.name}
          </p>
          {quote.isPending ? (
            <div className="mt-2 h-24 animate-pulse bg-surface-2" />
          ) : quote.isError ? (
            <Notice tone="error">{problemOf(quote.error)?.title ?? t("quoteFailed")}</Notice>
          ) : (
            <fieldset className="mt-3 space-y-2">
              <legend className="sr-only">{t("howToPay")}</legend>
              {options.map((o) => (
                <label key={o.kind} className={`flex cursor-pointer items-start gap-3 border-2 p-3 ${choice === o.kind ? "border-brand" : "border-line"}`}>
                  <input type="radio" name="pay" className="mt-1" checked={choice === o.kind} onChange={() => setChoice(o.kind)} />
                  <span>
                    <span className="block font-bold">{o.kind === "advance" ? t("payAdvanceNow", { amount: money(o.payNow) }) : t("payFullNow", { amount: money(o.payNow) })}</span>
                    <span className="block text-sm text-muted">{o.atVenue > 0 ? t("atVenue", { amount: money(o.atVenue) }) : t("nothingAtVenue")}</span>
                  </span>
                </label>
              ))}
              <p className="text-sm text-muted">{t("total", { amount: money(quote.data?.price ?? 0) })}</p>
              <p className="text-sm text-muted">{t("advanceKept")}</p>
            </fieldset>
          )}
          {problem ? (
            <div className="mt-3">
              <Notice tone="error">{problem.code === "SLOT_UNAVAILABLE" ? t("taken") : problem.title}</Notice>
            </div>
          ) : null}
          {status === "signed_in" ? (
            <button
              type="button"
              onClick={() => holdIt.mutate()}
              disabled={holdIt.isPending || !options.length}
              aria-busy={holdIt.isPending || undefined}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center bg-brand px-5 font-bold text-white hover:bg-brand-hover disabled:opacity-50"
              data-testid="hold-and-pay"
            >
              {holdIt.isPending ? t("holding") : t("holdAndPay")}
            </button>
          ) : (
            <Link href={`/sign-in?next=/grounds/${slug}`} className="mt-4 inline-flex min-h-12 w-full items-center justify-center bg-brand px-5 font-bold text-white">
              {t("signInToBook")}
            </Link>
          )}
          <p className="mt-2 text-xs text-muted">{t("holdNote")}</p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">{t("pickHint")}</p>
      )}
    </div>
  );
}

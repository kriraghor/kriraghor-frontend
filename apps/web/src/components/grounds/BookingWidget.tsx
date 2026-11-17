"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { problemOf } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { bookings, canStartAt, coveredIndexes, dayLabel, daysBetween, newKey, timeLabel, useGroundLive, type PaymentChoice } from "@/lib/bookings";
import { formatTaka } from "@/lib/payments";
import { dhakaDateOf } from "@/lib/home";
import { Notice } from "@kriraghor/ui/primitives";
import { Button, ButtonLink, Dropdown } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";

const CELL: Record<string, string> = {
  open: "border-line-strong/50 bg-surface hover:border-brand hover:text-brand-text",
  booked: "border-transparent bg-surface-2 text-muted/70 line-through",
  yours: "border-prize bg-prize text-prize-ink",
  closed: "border-transparent bg-surface-2/60 text-muted/50",
  past: "border-transparent bg-transparent text-muted/50",
};

/**
 * The booking aside of /grounds/[slug] (M10 FR-01 to FR-06, v3): a 7-day strip, court and length, the
 * half-hour grid (live through the ground's socket room), then both payment options from the shared
 * calculator. "Hold and pay" holds the slot for 10 minutes and opens the M06 payment page.
 * `initial` pre-selects a slot picked on /venues or the home page (?court=&at=&len=); any later pick replaces it.
 */
export function BookingWidget({ groundId, slug, initial }: { groundId: string; slug: string; initial?: { courtId?: string; start?: string; minutes?: number } }) {
  const t = useTranslations("bookings");
  const locale = useLocale();
  const { status } = useAuth();
  const qc = useQueryClient();
  const [date, setDate] = useState<string | undefined>(() => (initial?.start ? dhakaDateOf(initial.start) : undefined));
  const [courtId, setCourtId] = useState<string | undefined>(initial?.courtId);
  const [initialStart, setInitialStart] = useState<string | null>(initial?.start ?? null);
  const [minutes, setMinutes] = useState<number | undefined>(undefined);
  const [startIndex, setStartIndex] = useState<number | null>(null);
  const [choice, setChoice] = useState<PaymentChoice>("advance");

  const grid = useQuery({ queryKey: ["availability", groundId, date ?? "today"], queryFn: () => bookings.availability(groundId, date), refetchInterval: 30_000 });
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ["availability", groundId] }), [qc, groundId]);
  useGroundLive(groundId, refresh);

  const a = grid.data;
  const court = a?.courts.find((k) => k.id === courtId) ?? a?.courts[0];
  const wanted = minutes ?? initial?.minutes;
  const length = wanted && a?.lengths.includes(wanted) ? wanted : (a?.lengths[0] ?? 60);
  const cells = useMemo(() => court?.cells ?? [], [court]);
  const preset = initialStart ? cells.findIndex((c) => c.start === initialStart) : -1;
  const at = startIndex ?? (preset >= 0 ? preset : null);
  const selected = at !== null && canStartAt(cells, at, length) ? cells[at] : null;
  const covered = coveredIndexes(selected ? at : null, length);

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
    setInitialStart(null);
    holdIt.reset();
  };

  if (grid.isPending) return <div className="h-72 kg-shimmer rounded-card bg-surface-2" role="status" aria-label={t("loading")} />;
  if (grid.isError || !a) return <Notice tone="error">{t("gridFailed")}</Notice>;
  if (!a.bookable) return <p className="font-bold">{t("notTaking")}</p>;

  const options = quote.data?.options ?? [];
  return (
    <div data-testid="booking-widget">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{t("pickDay")}</p>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label={t("pickDay")}>
        {daysBetween(a.window.from, a.window.to).map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={d === a.date}
            onClick={() => pick(() => setDate(d))}
            className={cn("min-h-11 shrink-0 rounded-control border px-3 text-sm font-semibold transition-colors", d === a.date ? "border-brand bg-brand text-on-brand" : "border-line bg-surface hover:border-brand")}
          >
            {dayLabel(d, locale)}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Dropdown id="bw-court" label={t("court")} value={court?.id ?? ""} onChange={(v) => v && pick(() => setCourtId(v))} options={a.courts.map((k) => ({ value: k.id, label: k.name }))} testId="bw-court" />
        <Dropdown id="bw-length" label={t("length")} value={String(length)} onChange={(v) => v && pick(() => setMinutes(Number(v)))} options={a.lengths.map((m) => ({ value: String(m), label: t("minutes", { n: m }) }))} testId="bw-length" />
      </div>

      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">{t("pickStart")}</p>
      <div className="mt-2 grid max-h-64 grid-cols-4 gap-1.5 overflow-y-auto pr-1" data-testid="slot-grid">
        {cells.map((c, i) => {
          if (c.state === "past") return null; // only what is still to come
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
                setInitialStart(null);
                setStartIndex(i);
                holdIt.reset();
              }}
              className={cn("min-h-11 rounded-[10px] border text-xs font-semibold tabular transition-colors disabled:cursor-not-allowed", on ? "border-brand bg-brand text-on-brand" : CELL[c.state])}
              data-state={c.state}
            >
              {timeLabel(c.start, locale)}
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="mt-4 border-t border-line pt-4" aria-live="polite">
          <p className="font-bold">
            {timeLabel(selected.start, locale)} · {t("minutes", { n: length })} · {court?.name}
          </p>
          {quote.isPending ? (
            <div className="mt-2 h-24 kg-shimmer rounded-control bg-surface-2" />
          ) : quote.isError ? (
            <Notice tone="error">{problemOf(quote.error)?.title ?? t("quoteFailed")}</Notice>
          ) : (
            <fieldset className="mt-3 space-y-2">
              <legend className="sr-only">{t("howToPay")}</legend>
              {options.map((o) => (
                <label key={o.kind} className={cn("flex cursor-pointer items-start gap-3 rounded-control border p-3 transition-colors", choice === o.kind ? "border-brand bg-brand-soft" : "border-line hover:border-brand/60")}>
                  <input type="radio" name="pay" className="mt-1 size-4 accent-[var(--kg-brand)]" checked={choice === o.kind} onChange={() => setChoice(o.kind)} />
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
            <Button type="button" block size="lg" className="mt-4" onClick={() => holdIt.mutate()} disabled={!options.length} busy={holdIt.isPending} data-testid="hold-and-pay">
              {holdIt.isPending ? t("holding") : t("holdAndPay")}
            </Button>
          ) : (
            <ButtonLink href={`/sign-in?next=/venues/${slug}`} block size="lg" className="mt-4">
              {t("signInToBook")}
            </ButtonLink>
          )}
          <p className="mt-2 text-xs text-muted">{t("holdNote")}</p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">{t("pickHint")}</p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { bookings, timeLabel, whenLabel } from "@/lib/bookings";
import { formatTaka } from "@/lib/payments";
import { Notice } from "../ui";
import { BookingTrust } from "../trust/BookingTrust";

/**
 * /me/bookings/[id] (M10 FR-10 to FR-12): the booking, what was paid and what is due at the venue,
 * and cancel with a preview of the refund (v3: the advance is kept; anything above it comes back).
 * M17: disputes inside the window and rating the ground after play (BookingTrust).
 */
export function BookingDetail({ id }: { id: string }) {
  const t = useTranslations("bookings");
  const locale = useLocale();
  const { status } = useAuth();
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const q = useQuery({ queryKey: ["my-booking", id], queryFn: () => bookings.get(id), enabled: status === "signed_in" });
  const pay = useMutation({ mutationFn: () => bookings.pay(id), onSuccess: (r) => r.payment && window.location.assign(r.payment.payUrl) });
  const release = useMutation({ mutationFn: () => bookings.release(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["my-booking", id] }) });
  const cancel = useMutation({
    mutationFn: (expectedRefund: number) => bookings.cancel(id, expectedRefund),
    onSuccess: () => {
      setConfirming(false);
      qc.invalidateQueries({ queryKey: ["my-booking", id] });
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
    },
    onError: () => qc.invalidateQueries({ queryKey: ["my-booking", id] }),
  });
  const money = (n: number) => formatTaka(n, locale);

  if (status === "signed_out")
    return (
      <Shell>
        <Notice>
          {t("signedOut")}{" "}
          <Link href={`/sign-in?next=/me/bookings/${id}`} className="underline">
            {t("signIn")}
          </Link>
        </Notice>
      </Shell>
    );
  if (q.isPending) return <Shell>{<div className="h-64 animate-pulse bg-surface-2" role="status" aria-label={t("loading")} />}</Shell>;
  if (q.isError || !q.data)
    return (
      <Shell>
        <Notice tone="error">{t("notFound")}</Notice>
      </Shell>
    );
  const { booking: b, cancel: terms } = q.data;
  const problem = cancel.error ? problemOf(cancel.error) : null;

  return (
    <Shell>
      <Link href="/me/bookings" className="text-sm font-semibold text-brand underline">
        ← {t("myBookings")}
      </Link>
      <p className="mt-4 font-mono text-sm text-muted">{b.code}</p>
      <h1 className="text-3xl font-extrabold" data-testid="booking-when">
        {whenLabel(b.start, locale)}–{timeLabel(b.end, locale)}
      </h1>
      <p className="mt-1 text-muted">{b.courts.map((k) => k.name).join(", ")}</p>
      <p className="mt-3 inline-block border-2 border-line px-3 py-1 text-sm font-bold" data-testid="booking-status">
        {t(`status.${b.status}`)}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-y-2 border-line py-4 text-sm">
        <dt className="text-muted">{t("price")}</dt>
        <dd className="text-right font-bold tabular-nums">{money(b.money.total)}</dd>
        <dt className="text-muted">{t("paidOnline")}</dt>
        <dd className="text-right font-bold tabular-nums">{money(b.money.paidOnline)}</dd>
        <dt className="text-muted">{t("dueAtVenue")}</dt>
        <dd className="text-right font-bold tabular-nums" data-testid="due-at-venue">
          {money(b.money.dueAtVenue)}
        </dd>
        {b.money.refund > 0 ? (
          <>
            <dt className="text-muted">{t("refunded")}</dt>
            <dd className="text-right font-bold tabular-nums">{money(b.money.refund)}</dd>
          </>
        ) : null}
      </dl>

      {b.status === "pending_payment" ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => pay.mutate()} className="inline-flex min-h-12 items-center bg-brand px-5 font-bold text-white">
            {t("payNow")}
          </button>
          <button type="button" onClick={() => release.mutate()} className="inline-flex min-h-12 items-center border-2 border-line px-5 font-semibold">
            {t("releaseHold")}
          </button>
        </div>
      ) : null}

      {terms?.allowed ? (
        <div className="mt-6">
          {!confirming ? (
            <button type="button" onClick={() => setConfirming(true)} className="inline-flex min-h-12 items-center border-2 border-danger px-5 font-bold text-danger" data-testid="cancel-booking">
              {t("cancel")}
            </button>
          ) : (
            <div className="border-2 border-danger p-4" role="alertdialog" aria-labelledby="cancel-title">
              <p id="cancel-title" className="font-bold">
                {t("cancelTitle")}
              </p>
              <p className="mt-2 text-sm">{terms.refund > 0 ? t("cancelRefund", { refund: money(terms.refund), kept: money(terms.retained) }) : t("cancelNoRefund", { kept: money(terms.retained) })}</p>
              {terms.free ? <p className="mt-1 text-sm text-muted">{t("cancelFree")}</p> : null}
              {problem ? (
                <div className="mt-3">
                  <Notice tone="error">{problem.code === "REFUND_CHANGED" ? t("refundChanged") : problem.title}</Notice>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={() => cancel.mutate(terms.refund)} disabled={cancel.isPending} className="inline-flex min-h-12 items-center bg-danger px-5 font-bold text-white disabled:opacity-50" data-testid="confirm-cancel">
                  {t("confirmCancel")}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="inline-flex min-h-12 items-center border-2 border-line px-5 font-semibold">
                  {t("keep")}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
      {b.status === "confirmed" ? <p className="mt-6 text-sm text-muted">{t("checkInHint")}</p> : null}
      {b.status !== "pending_payment" && b.status !== "expired" ? <BookingTrust bookingId={b.id} /> : null}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <section className="mx-auto max-w-xl px-5 pb-16 pt-8">{children}</section>;
}

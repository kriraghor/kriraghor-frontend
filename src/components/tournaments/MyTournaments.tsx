"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { problemOf } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { newKey } from "@/lib/bookings";
import { formatTaka } from "@/lib/payments";
import { statusTone, TONE, tournaments } from "@/lib/tournaments";
import { MePanel } from "../MePanel";
import { Notice } from "../ui";

/** /me/tournaments (M14): my teams' registrations: pay, take an offered place, withdraw (refund per §6.9). */
export function MyTournaments() {
  const t = useTranslations("tournaments");
  const locale = useLocale();
  const { status } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["my-registrations"], queryFn: tournaments.mine, enabled: status === "signed_in" });
  const [confirm, setConfirm] = useState<string | null>(null);
  const done = () => qc.invalidateQueries({ queryKey: ["my-registrations"] });
  const offer = useMutation({
    mutationFn: (id: string) => tournaments.acceptOffer(id, newKey()),
    onSuccess: (r) => {
      if (r.payment) window.location.assign(r.payment.payUrl);
      else done();
    },
  });
  const withdraw = useMutation({ mutationFn: (id: string) => tournaments.withdraw(id), onSuccess: () => (setConfirm(null), done()) });

  if (status === "signed_out") return <MePanel />;
  const p = problemOf(offer.error ?? withdraw.error);

  return (
    <section className="mx-auto max-w-[1100px] px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold">{t("myTournaments")}</h1>
        <Link href="/tournaments" className="min-h-11 border-2 border-line px-4 py-2 font-bold hover:border-brand">
          {t("findTournament")}
        </Link>
      </div>
      {p ? (
        <div className="mt-4">
          <Notice tone="error">{t.has(`errors.${p.code}`) ? t(`errors.${p.code}`) : (p.title ?? t("failed"))}</Notice>
        </div>
      ) : null}
      {q.isPending ? (
        <div className="mt-6 h-40 animate-pulse bg-surface-2" />
      ) : q.isError ? (
        <div className="mt-6">
          <Notice tone="error">{t("failed")}</Notice>
        </div>
      ) : !q.data.items.length ? (
        <p className="mt-6 border-2 border-dashed border-line p-8 text-center font-semibold" data-testid="my-registrations-empty">
          {t("noRegistrations")}
        </p>
      ) : (
        <ul className="mt-6 divide-y-2 divide-line border-y-2 border-line" data-testid="my-registrations">
          {q.data.items.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-4" data-testid="my-registration">
              <span className="min-w-0 flex-1">
                <Link href={`/tournaments/${r.tournament.slug}`} className="block font-bold">
                  {r.tournament.name}
                </Link>
                <span className="block text-sm text-muted">
                  {r.team?.name ?? "–"}
                  {r.reservePosition ? ` · ${t("reservePos", { n: r.reservePosition })}` : ""}
                  {r.refundedPoisha ? ` · ${t("refunded", { amount: formatTaka(r.refundedPoisha, locale) })}` : ""}
                  {r.reason ? ` · ${r.reason}` : ""}
                </span>
              </span>
              <span className={`border-2 px-2 py-0.5 text-sm font-bold ${TONE[statusTone(r.status)]}`} data-testid="registration-status">
                {t(`regStatus.${r.status}`)}
              </span>
              {r.payment ? (
                <a href={r.payment.payUrl} className="inline-flex min-h-11 items-center bg-brand px-4 font-bold text-white hover:bg-brand-hover">
                  {t("payEntry", { fee: formatTaka(r.feePoisha, locale) })}
                </a>
              ) : null}
              {r.status === "offered" ? (
                <button type="button" className="min-h-11 bg-brand px-4 font-bold text-white" onClick={() => offer.mutate(r.id)}>
                  {t("takePlace")}
                </button>
              ) : null}
              {["pending_payment", "reserve", "offered", "pending_approval", "approved"].includes(r.status) ? (
                confirm === r.id ? (
                  <span className="flex gap-2">
                    <button type="button" className="min-h-11 bg-danger px-3 text-sm font-bold text-white" onClick={() => withdraw.mutate(r.id)}>
                      {t("withdrawConfirm")}
                    </button>
                    <button type="button" className="min-h-11 px-2 text-sm underline" onClick={() => setConfirm(null)}>
                      {t("cancel")}
                    </button>
                  </span>
                ) : (
                  <button type="button" className="min-h-11 border-2 border-line px-3 text-sm font-bold hover:border-danger" onClick={() => setConfirm(r.id)}>
                    {t("withdraw")}
                  </button>
                )
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-sm text-muted">{t("refundRules")}</p>
    </section>
  );
}

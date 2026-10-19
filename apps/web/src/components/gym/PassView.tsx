"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import QRCode from "qrcode";
import { Link } from "@/i18n/navigation";
import { problemOf } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { dayLabel } from "@/lib/bookings";
import { gym, passTone, TONE } from "@/lib/gym";
import { formatTaka } from "@/lib/payments";
import { MePanel } from "../MePanel";
import { Notice } from "../ui";

/** The QR, drawn on the device from the signed token (never fetched as an image, so it stays private). */
function PassQr({ token, label }: { token: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(token, { errorCorrectionLevel: "M", margin: 2, width: 640, color: { dark: "#111210", light: "#ffffff" } }).then((u) => live && setSrc(u));
    return () => {
      live = false;
    };
  }, [token]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={label} className="aspect-square w-full max-w-[320px] bg-white" data-testid="pass-qr" /> : <span className="block aspect-square w-full max-w-[320px] animate-pulse bg-white/80" />;
}

/**
 * /me/passes/[code] (M20 §5): the pass to show at the front desk. While it is active: the QR and the
 * 6-character backup code (for a desk without a camera), the dates, and cancel with the refund it
 * gives. A pass waiting for payment links to the payment page.
 */
export function PassView({ code }: { code: string }) {
  const t = useTranslations("gym");
  const locale = useLocale();
  const { status } = useAuth();
  const qc = useQueryClient();
  const [full, setFull] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const q = useQuery({ queryKey: ["my-pass", code], queryFn: () => gym.pass(code), enabled: status === "signed_in", refetchInterval: 30_000 });
  const cancel = useMutation({
    mutationFn: () => gym.cancelPass(q.data!.pass.id),
    onSuccess: (r) => {
      qc.setQueryData(["my-pass", code], r);
      qc.invalidateQueries({ queryKey: ["my-passes"] });
      setConfirm(false);
    },
  });
  const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso)) : "");

  if (status === "signed_out") return <MePanel />;
  if (q.isPending) return <div className="mx-auto mt-10 h-96 max-w-[640px] animate-pulse bg-surface-2" />;
  if (q.isError || !q.data)
    return (
      <section className="mx-auto max-w-[640px] px-5 py-16">
        <h1 className="text-2xl font-extrabold">{t("passNotFound")}</h1>
        <Link href="/me/passes" className="mt-3 inline-block font-semibold text-brand underline">
          {t("myPasses")}
        </Link>
      </section>
    );
  const { pass: p, payment } = q.data;
  const problem = cancel.error ? problemOf(cancel.error) : null;
  const dates = p.validFrom === p.validTo ? dayLabel(p.validFrom, locale) : `${dayLabel(p.validFrom, locale)} – ${dayLabel(p.validTo, locale)}`;

  if (full && p.token)
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white p-6 text-[#111210]" role="dialog" aria-label={t("showAtDesk")}>
        <PassQr token={p.token} label={t("qrOf", { code: p.code })} />
        <p className="font-mono text-4xl font-extrabold tracking-[0.3em]" data-testid="pass-backup-full">
          {p.backupCode}
        </p>
        <p className="text-center font-semibold">
          {p.gym?.name} · {t(`kind.${p.kind}`)} · {dates}
        </p>
        <button type="button" onClick={() => setFull(false)} className="min-h-12 border-2 border-[#111210] px-6 font-bold">
          {t("close")}
        </button>
      </div>
    );

  return (
    <div data-theme="gym" className="min-h-[70dvh]">
      <section className="mx-auto max-w-[640px] px-5 py-10">
        <Link href="/me/passes" className="text-sm font-semibold text-brand underline">
          ← {t("myPasses")}
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              {p.code} · {t(`kind.${p.kind}`)}
            </p>
            <h1 className="mt-1 text-3xl font-extrabold" data-testid="pass-gym">
              {p.gym ? <Link href={`/gym/gyms/${p.gym.slug}`}>{p.gym.name}</Link> : "–"}
            </h1>
            {p.gym?.addressLine ? <p className="text-muted">{p.gym.addressLine}</p> : null}
          </div>
          <span className={`border-2 px-2 py-0.5 text-sm font-bold ${TONE[passTone(p.status)]}`} data-testid="pass-status">
            {t(`passStatus.${p.status}`)}
          </span>
        </div>

        {p.token ? (
          <div className="mt-6 flex flex-col items-center gap-4 glass-card p-6">
            <button type="button" onClick={() => setFull(true)} aria-label={t("showAtDesk")} className="w-full max-w-[320px]">
              <PassQr token={p.token} label={t("qrOf", { code: p.code })} />
            </button>
            <p className="text-sm text-muted">{t("backupCode")}</p>
            <p className="font-mono text-3xl font-extrabold tracking-[0.3em]" data-testid="pass-backup">
              {p.backupCode}
            </p>
            <button type="button" onClick={() => setFull(true)} className="min-h-12 bg-brand px-5 font-bold hover:bg-brand-hover">
              {t("showAtDesk")}
            </button>
            <p className="text-center text-sm text-muted">{t("deskHint")}</p>
          </div>
        ) : p.status === "pending_payment" && payment ? (
          <div className="mt-6 glass-card p-6">
            <p className="font-semibold">{t("awaitingPayment")}</p>
            <a href={payment.payUrl} className="mt-3 inline-flex min-h-12 items-center bg-brand px-5 font-bold hover:bg-brand-hover">
              {t("payNow", { price: formatTaka(p.money.price, locale) })}
            </a>
          </div>
        ) : null}

        <dl className="mt-6 grid grid-cols-2 gap-4 border-y-2 border-line py-4 text-sm">
          <div>
            <dt className="text-muted">{t("validDates")}</dt>
            <dd className="font-bold">{dates}</dd>
          </div>
          <div>
            <dt className="text-muted">{t("paid")}</dt>
            <dd className="font-bold tabular-nums">{formatTaka(p.money.price, locale)}</dd>
          </div>
          {p.lastRedeemedAt ? (
            <div>
              <dt className="text-muted">{t("lastUsed")}</dt>
              <dd className="font-bold">{when(p.lastRedeemedAt)}</dd>
            </div>
          ) : null}
          {p.money.refunded ? (
            <div>
              <dt className="text-muted">{t("refunded")}</dt>
              <dd className="font-bold tabular-nums">{formatTaka(p.money.refunded, locale)}</dd>
            </div>
          ) : null}
        </dl>

        {p.can.cancel ? (
          <div className="mt-6">
            {confirm ? (
              <div className="border-2 border-danger p-4">
                <p className="font-semibold">{t("cancelConfirm", { price: formatTaka(p.money.price, locale) })}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => cancel.mutate()} disabled={cancel.isPending} className="min-h-12 bg-danger px-5 font-bold text-white disabled:opacity-50" data-testid="pass-cancel-yes">
                    {t("cancelYes")}
                  </button>
                  <button type="button" onClick={() => setConfirm(false)} className="min-h-12 border-2 border-line px-5 font-bold">
                    {t("keepPass")}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirm(true)} className="min-h-12 border-2 border-line px-5 font-bold hover:border-danger" data-testid="pass-cancel">
                {t("cancelPass")}
              </button>
            )}
            <p className="mt-2 text-sm text-muted">{p.kind === "day" ? t("dayRefund") : t("periodRefund")}</p>
          </div>
        ) : null}
        {problem ? (
          <div className="mt-4">
            <Notice tone="error">{t.has(`err.${problem.code}`) ? t(`err.${problem.code}`) : problem.title}</Notice>
          </div>
        ) : null}
      </section>
    </div>
  );
}

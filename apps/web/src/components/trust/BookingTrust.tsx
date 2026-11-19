"use client";

import { Star } from "@phosphor-icons/react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { newKey, whenLabel } from "@/lib/bookings";
import { formatTaka } from "@/lib/payments";
import { disputes, reviews, type Category } from "@/lib/trust";
import { Notice } from "@kriraghor/ui/primitives";
import { useConfirm } from "@kriraghor/ui/kit";

/**
 * The M17 part of /me/bookings/[id]: open a dispute while the window is open (contest a no-show, a
 * problem at the venue, money paid at the counter), go to the case once it exists, and rate the
 * ground after playing.
 */
export function BookingTrust({ bookingId }: { bookingId: string }) {
  const t = useTranslations("trust");
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const opts = useQuery({ queryKey: ["dispute-options", bookingId], queryFn: () => disputes.options(bookingId) });
  const reviewable = useQuery({ queryKey: ["reviewable"], queryFn: () => reviews.reviewable() });
  const [category, setCategory] = useState<Category | null>(null);
  const [statement, setStatement] = useState("");
  const [key] = useState(newKey);
  const ask = useConfirm();
  const a = useTranslations("ask");
  const open = useMutation({
    mutationFn: () => disputes.open({ sourceId: bookingId, category: category!, statement: statement.trim() }, key),
    onSuccess: (r) => router.push(`/me/disputes/${r.dispute.code}`),
  });
  const problem = open.error ? problemOf(open.error) : null;
  const canRate = reviewable.data?.items.some((x) => x.bookingId === bookingId) ?? false;
  // Kept after posting: the refreshed list no longer has this booking, so the thanks would vanish with the form.
  const [rated, setRated] = useState<"published" | "held" | null>(null);
  const tr = useTranslations("trust.rate");

  return (
    <div className="mt-8 space-y-6">
      {opts.data?.dispute ? (
        <Notice>
          {t("dispute.exists")}{" "}
          <Link href={`/me/disputes/${opts.data.dispute}`} className="font-semibold underline" data-testid="open-case">
            {opts.data.dispute}
          </Link>
        </Notice>
      ) : null}
      {opts.data?.items.length ? (
        <div className="rounded-card border border-line p-4" data-testid="dispute-options">
          <p className="font-bold">{t("dispute.title")}</p>
          <p className="mt-1 text-sm text-muted">{t("dispute.help")}</p>
          {category === null ? (
            <div className="mt-3 flex flex-wrap gap-3">
              {opts.data.items.map((o) => (
                <button key={o.category} type="button" onClick={() => setCategory(o.category as Category)} className="rounded-control inline-flex min-h-12 items-center border border-line-strong px-4 font-semibold" data-testid={`dispute-${o.category}`}>
                  {t(`dispute.open.${o.category}`)}
                </button>
              ))}
            </div>
          ) : (
            <form
              className="mt-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void ask({ kind: "send", title: a("sendReport") }).then((ok) => ok && open.mutate());
              }}
            >
              {(() => {
                const o = opts.data.items.find((x) => x.category === category)!;
                return (
                  <p className="text-sm">
                    {o.money ? t("dispute.held", { amount: formatTaka(o.held, locale) }) : t("dispute.findings")} {o.closesAt ? t("dispute.closes", { when: whenLabel(o.closesAt, locale) }) : null}
                  </p>
                );
              })()}
              <div className="flex flex-col gap-1">
                <label htmlFor="dispute-statement" className="text-sm font-semibold text-muted">
                  {t("dispute.statement")}
                </label>
                <textarea id="dispute-statement" required minLength={2} maxLength={2000} rows={4} value={statement} onChange={(e) => setStatement(e.target.value)} className="surface-card px-3 py-2" />
                <p className="text-sm text-muted">{t("dispute.statementHint")}</p>
              </div>
              {problem ? <Notice tone="error">{t.has(`errors.${problem.code}`) ? t(`errors.${problem.code}`) : problem.title}</Notice> : null}
              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={open.isPending || statement.trim().length < 2} className="inline-flex min-h-12 items-center bg-brand px-5 font-bold text-on-brand disabled:opacity-50" data-testid="submit-dispute">
                  {t("dispute.submit")}
                </button>
                <button type="button" onClick={() => setCategory(null)} className="rounded-control inline-flex min-h-12 items-center border border-line-strong/60 px-5 font-semibold">
                  {t("cancel")}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}
      {rated ? <Notice>{rated === "held" ? tr("held") : tr("thanks")}</Notice> : canRate ? (
        <RateGround
          bookingId={bookingId}
          onDone={(status) => {
            setRated(status === "held" ? "held" : "published");
            void qc.invalidateQueries({ queryKey: ["reviewable"] });
          }}
        />
      ) : null}
    </div>
  );
}

function RateGround({ bookingId, onDone }: { bookingId: string; onDone: (status: string) => void }) {
  const t = useTranslations("trust.rate");
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  const ask = useConfirm();
  const a = useTranslations("ask");
  const post = useMutation({ mutationFn: () => reviews.post({ bookingId, stars, text: text.trim() || undefined }), onSuccess: (r) => onDone(r.review.status) });
  return (
    <form
      className="rounded-card border border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void ask({ kind: "send", title: a("postReview") }).then((ok) => ok && post.mutate());
      }}
      data-testid="rate-ground"
    >
      <fieldset>
        <legend className="font-bold">{t("title")}</legend>
        <div className="mt-3 flex gap-1" role="radiogroup" aria-label={t("stars")}>
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} type="button" role="radio" aria-checked={stars === s} aria-label={t("starN", { n: s })} onClick={() => setStars(s)} className={`rounded-control flex h-12 w-12 items-center justify-center border ${s <= stars ? "border-brand bg-brand text-on-brand" : "border-line"}`} data-testid={`star-${s}`}>
              <Star size={22} weight="fill" aria-hidden />
            </button>
          ))}
        </div>
      </fieldset>
      <div className="mt-3 flex flex-col gap-1">
        <label htmlFor="review-text" className="text-sm font-semibold text-muted">
          {t("text")}
        </label>
        <textarea id="review-text" maxLength={1000} rows={3} value={text} onChange={(e) => setText(e.target.value)} className="surface-card px-3 py-2" />
        <p className="text-sm text-muted">{t("hint")}</p>
      </div>
      {post.error ? <Notice tone="error">{t("failed")}</Notice> : null}
      <button type="submit" disabled={!stars || post.isPending} className="mt-3 inline-flex min-h-12 items-center bg-brand px-5 font-bold text-on-brand disabled:opacity-50" data-testid="submit-review">
        {t("submit")}
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Star } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Button, Dialog, Notice, Textarea, useToast } from "@kriraghor/ui/kit";
import { newKey } from "@/lib/bookings";
import { rateErrorKey, reviewedGymFromOtherPass, reviews, sourceHref, subjectNameOf, SUBJECT_OF, type ReviewableItem, type ReviewSource, type ReviewSubject } from "@/lib/trust";
import { reviewDate } from "./SubjectReviews";

/** What a rating is about: the source I paid for and the subject it rates. */
export type RateTarget = { sourceType: ReviewSource; sourceId: string; subjectType: ReviewSubject; subjectId?: string; subjectName?: string | null; update?: boolean };

/**
 * The rating dialog (M17 FR-30 to FR-33): 1 to 5 stars and optional words, posted for one source
 * (a played booking, a released hire job, a received shop order or a used gym pass). A gym keeps one
 * review per member: posting from a newer pass updates it, and the API says so (`updated`).
 */
export function RateDialog({ target, open, onOpenChange, onDone }: { target: RateTarget; open: boolean; onOpenChange: (open: boolean) => void; onDone?: (status: string) => void }) {
  const t = useTranslations("trust.rate");
  const qc = useQueryClient();
  const toast = useToast();
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  // One key per dialog opening: a double tap or a retry after a lost answer posts once.
  const [key, setKey] = useState(newKey);
  const post = useMutation({
    mutationFn: () => reviews.rate({ sourceType: target.sourceType, sourceId: target.sourceId, stars, text: text.trim() || undefined }, key),
    onSuccess: (r) => {
      toast.show(r.updated ? t("updated") : r.review.status === "held" ? t("held") : t("thanks"));
      void qc.invalidateQueries({ queryKey: ["reviewable"] });
      void qc.invalidateQueries({ queryKey: ["my-reviews"] });
      void qc.invalidateQueries({ queryKey: ["subject-reviews", target.subjectType] });
      onDone?.(r.review.status);
      close(false);
    },
  });
  function close(next: boolean) {
    if (!next) {
      setStars(0);
      setText("");
      setKey(newKey());
      post.reset();
    }
    onOpenChange(next);
  }
  const problem = post.error ? problemOf(post.error) : null;
  const fieldId = `rate-text-${target.sourceId}`;
  const what = t(`what.${target.subjectType}`);

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={target.update ? t("updateTitle") : t(`titleFor.${target.subjectType}`)}
      description={target.subjectName ?? undefined}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={() => close(false)}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={`rate-form-${target.sourceId}`} disabled={!stars} busy={post.isPending} data-testid="submit-review">
            {target.update ? t("update") : t("submit")}
          </Button>
        </>
      }
    >
      <form
        id={`rate-form-${target.sourceId}`}
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (stars) post.mutate();
        }}
        data-testid="rate-dialog"
      >
        {target.update ? <p className="text-sm text-muted">{t("updateHint")}</p> : null}
        <fieldset>
          <legend className="text-sm font-semibold">{t("starsFor", { what })}</legend>
          <div className="mt-2 flex gap-1" role="radiogroup" aria-label={t("stars")}>
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={stars === s}
                aria-label={t("starN", { n: s })}
                onClick={() => setStars(s)}
                className={`flex size-12 items-center justify-center rounded-control border-2 ${s <= stars ? "border-brand bg-brand text-on-brand" : "border-line text-muted hover:border-brand"}`}
                data-testid={`star-${s}`}
              >
                <Star size={22} weight={s <= stars ? "fill" : "regular"} aria-hidden />
              </button>
            ))}
          </div>
          {stars ? <p className="mt-2 text-sm font-semibold">{t(`scale.${stars}`)}</p> : null}
        </fieldset>
        <Textarea id={fieldId} label={t("text")} hint={t("hint")} maxLength={1000} rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        {problem || post.isError ? <Notice tone="error">{t(`errors.${rateErrorKey(problem?.code)}`)}</Notice> : null}
      </form>
    </Dialog>
  );
}

/** A button that opens the rating dialog for one target. */
export function RateButton({ target, label, variant = "primary", testId = "rate-this" }: { target: RateTarget; label?: string; variant?: "primary" | "secondary"; testId?: string }) {
  const t = useTranslations("trust.rate");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={variant} icon={<Star size={18} aria-hidden />} onClick={() => setOpen(true)} data-testid={testId}>
        {label ?? (target.update ? t("updateCta") : t("cta"))}
      </Button>
      <RateDialog target={target} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** The waiting item for a source, from my list of things to rate (one shared query). */
function useReviewable(enabled = true) {
  const { status } = useAuth();
  return useQuery({ queryKey: ["reviewable"], queryFn: () => reviews.reviewable(), enabled: enabled && status === "signed_in", staleTime: 30_000 });
}

/**
 * The small entry point on a source's own page (the hire request for the manager after release, the
 * order once received, the gym pass after a visit): shown only while the source is waiting for a
 * rating. For a gym already rated from another pass it offers "Update your review" after a visit.
 */
export function RateSourceButtons({ sourceType, sourceIds, update, className }: { sourceType: ReviewSource; sourceIds: string[]; update?: { subjectId: string; subjectName?: string | null; sourceId: string } | null; className?: string }) {
  const t = useTranslations("trust.rate");
  const q = useReviewable(sourceIds.length > 0 || Boolean(update));
  const waiting = (q.data?.items ?? []).filter((x) => x.sourceType === sourceType && sourceIds.includes(x.sourceId));
  if (waiting.length)
    return (
      <div className={`flex flex-wrap gap-2 ${className ?? ""}`} data-testid="rate-source">
        {waiting.map((x) => (
          <RateButton key={x.sourceId} target={targetOf(x)} label={waiting.length > 1 ? t("ctaRef", { ref: x.ref }) : undefined} />
        ))}
      </div>
    );
  if (update && q.data)
    return (
      <div className={className}>
        <RateButton target={{ sourceType, sourceId: update.sourceId, subjectType: SUBJECT_OF[sourceType], subjectId: update.subjectId, subjectName: update.subjectName, update: true }} variant="secondary" testId="rate-update" />
      </div>
    );
  return null;
}

/** The gym pass page's entry: rate the gym after a visit, or update my one review of it. */
export function RatePassButton({ pass, className }: { className?: string; pass: { id: string; status: string; firstRedeemedAt: string | null; gym: { id: string; name: string } | null } }) {
  const { status } = useAuth();
  const used = Boolean(pass.firstRedeemedAt) && ["active", "redeemed", "expired"].includes(pass.status);
  const mine = useQuery({ queryKey: ["my-reviews"], queryFn: () => reviews.mine(), enabled: used && status === "signed_in" && Boolean(pass.gym) });
  if (!used || !pass.gym) return null;
  const rated = reviewedGymFromOtherPass(mine.data?.items, pass.gym.id, pass.id);
  return <RateSourceButtons sourceType="gym_pass" sourceIds={[pass.id]} update={rated ? { subjectId: pass.gym.id, subjectName: pass.gym.name, sourceId: pass.id } : null} className={className} />;
}

export const targetOf = (x: ReviewableItem): RateTarget => ({ sourceType: x.sourceType, sourceId: x.sourceId, subjectType: x.subjectType, subjectId: x.subjectId, subjectName: subjectNameOf(x) });

/**
 * /me/reviews, "Waiting for your rating": one card per item (venue, pro, shop, gym), newest first,
 * with what it was, when, the last day to rate it, and "Rate this".
 */
export function ReviewableList() {
  const t = useTranslations("trust");
  const locale = useLocale();
  const q = useReviewable();
  const items = q.data?.items ?? [];
  if (q.isPending) return <div className="h-24 animate-pulse bg-surface-2" />;
  if (q.isError) return <Notice tone="error">{t("reviewable.loadFailed")}</Notice>;
  if (!items.length) return <p className="text-muted" data-testid="reviewable-empty">{t("reviewable.none")}</p>;
  return (
    <ul className="grid gap-3 md:grid-cols-2" data-testid="reviewable">
      {items.map((x) => {
        const name = subjectNameOf(x) ?? t(`subjects.${x.subjectType}`);
        return (
          <li key={`${x.sourceType}-${x.sourceId}`} className="glass-card flex flex-col gap-3 p-4" data-testid="reviewable-item">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">{t(`subjects.${x.subjectType}`)}</p>
              <p className="mt-0.5 truncate text-lg font-extrabold">{name}</p>
              <p className="mt-1 text-sm text-muted">
                <Link href={sourceHref(x)} className="font-semibold underline">
                  {t(`reviewable.source.${x.sourceType}`, { ref: x.ref })}
                </Link>{" "}
                · {t("reviewable.done", { when: reviewDate(x.doneAt, locale) })}
              </p>
              <p className="text-sm text-muted">{t("reviewable.closes", { when: reviewDate(x.closesAt, locale) })}</p>
            </div>
            <div>
              <RateButton target={targetOf(x)} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

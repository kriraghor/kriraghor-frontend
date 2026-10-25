"use client";

import { useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ChatCircleText } from "@phosphor-icons/react";
import { Button, EmptyState, Notice } from "@kriraghor/ui/kit";
import { hire } from "@/lib/hire";
import { reviews, subjectNameOf, type Review } from "@/lib/trust";
import { ReplyDialog } from "../trust/ReplyDialog";
import { localNumber, reviewDate, Stars } from "@kriraghor/ui/trust";

/**
 * /pro/reviews (M11-FR-06, M17-FR-34): what managers said about my hire profiles after a job was
 * paid out, newest first, with my reply. A reply can be changed; phone numbers and links are refused.
 * REVIEW_NEW notifications open this tab.
 */
export function ProReviews() {
  const t = useTranslations("trust");
  const locale = useLocale();
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: ["pro-reviews"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => reviews.owned("hire_profile", pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const profiles = useQuery({ queryKey: ["pro-profiles"], queryFn: () => hire.myProfiles() });
  const [replying, setReplying] = useState<Review | null>(null);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const many = (profiles.data?.items.length ?? 0) > 1;
  const roleOf = (id: string) => {
    const p = profiles.data?.items.find((x) => x.id === id);
    return p?.role ? (locale === "bn" ? p.role.nameBn : p.role.nameEn) : null;
  };

  if (q.isPending) return <div className="h-40 animate-pulse bg-surface-2" />;
  if (q.isError) return <Notice tone="error">{t("owner.loadFailed")}</Notice>;
  return (
    <div data-testid="pro-reviews">
      <p className="max-w-2xl text-muted">{t("owner.proLead")}</p>
      {!items.length ? (
        <EmptyState className="mt-6" icon={<ChatCircleText size={32} aria-hidden />} title={t("owner.noneTitle")} body={t("owner.proNone")} />
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {items.map((r) => (
            <li key={r.id} className="border-2 border-line p-4" data-testid="pro-review">
              {many ? <p className="text-xs font-bold uppercase tracking-wide text-muted">{subjectNameOf(r) ?? roleOf(r.subjectId) ?? t("subjects.hire_profile")}</p> : null}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stars value={r.stars} label={t("reviews.starsOf", { stars: localNumber(r.stars, locale) })} />
                <span className="font-semibold">{r.author.displayName ?? t("reviews.member")}</span>
                <span className="text-sm text-muted">{reviewDate(r.createdAt, locale)}</span>
              </div>
              {r.text ? <p className="mt-2 max-w-[65ch] whitespace-pre-line leading-relaxed">{r.text}</p> : <p className="mt-2 text-sm text-muted">{t("owner.noText")}</p>}
              {r.reply ? (
                <div className="mt-3 border-l-4 border-line pl-3 text-sm" data-testid="pro-review-reply">
                  <p className="font-semibold">{t("owner.yourReply")}</p>
                  <p className="mt-1 whitespace-pre-line text-muted">{r.reply.text}</p>
                </div>
              ) : null}
              <div className="mt-3">
                <Button type="button" variant={r.reply ? "secondary" : "primary"} size="sm" onClick={() => setReplying(r)} data-testid="pro-reply">
                  {r.reply ? t("owner.changeReply") : t("owner.reply")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {q.hasNextPage ? (
        <button type="button" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} className="mt-4 min-h-12 border-2 border-line px-5 font-bold hover:border-brand disabled:opacity-50">
          {t("reviews.more")}
        </button>
      ) : null}
      {replying ? (
        <ReplyDialog
          key={replying.id}
          reviewId={replying.id}
          current={replying.reply?.text ?? null}
          open
          onOpenChange={(open) => !open && setReplying(null)}
          onDone={() => void qc.invalidateQueries({ queryKey: ["pro-reviews"] })}
        />
      ) : null}
    </div>
  );
}

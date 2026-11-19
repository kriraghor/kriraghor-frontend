"use client";

import { useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ChatCircleText, Star } from "@phosphor-icons/react";
import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { Badge, Button, Checkbox, EmptyState, Notice, SkeletonList, Textarea, useToast } from "@kriraghor/ui/kit";
import { Stars } from "@kriraghor/ui/trust";
import { unwrap } from "@/lib/manage";
import { GymPage, useFmt, useGymError, type GymCtx } from "./common";

type Review = components["schemas"]["Review"];

/** A reply is 2 to 1,000 characters after trimming (the API's rule, M17 FR-34). */
export const replyOk = (text: string) => text.trim().length >= 2 && text.trim().length <= 1000;

const reviewsOf = (gymId: string, cursor?: string) =>
  api()
    .GET("/me/reviews", { params: { query: { role: "owner", subjectType: "gym", subjectId: gymId, ...(cursor ? { cursor } : {}) } } })
    .then(unwrap);
const postReply = (id: string, text: string) => api().POST("/me/reviews/{id}/reply", { params: { path: { id } }, body: { text } }).then(unwrap);

/**
 * /manage/[gymId]/reviews (M24 prompt 3, the owner only): the gym's published reviews (M17, Round B1:
 * members review a gym after a pass was used at the front desk) with the owner's public reply. Moved
 * here from vendor.kriraghor.com/vendor/reviews for gyms; the API is the same (GET /me/reviews with
 * role=owner and the gym as subject, POST /me/reviews/:id/reply).
 */
export function Reviews({ gymId }: { gymId: string }) {
  const t = useTranslations("gp.reviews");
  return (
    <GymPage gymId={gymId} page="reviews" title={t("title")} description={t("lead")} testId="gm-reviews">
      {(ctx) => <List ctx={ctx} />}
    </GymPage>
  );
}

function List({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("gp.reviews");
  const err = useGymError();
  const [waitingOnly, setWaitingOnly] = useState(false);
  const q = useInfiniteQuery({
    queryKey: ["gm-reviews", ctx.gymId],
    queryFn: ({ pageParam }) => reviewsOf(ctx.gymId, pageParam || undefined),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const all = q.data?.pages.flatMap((p) => p.items) ?? [];
  const rows = waitingOnly ? all.filter((r) => !r.reply) : all;
  return (
    <div className="flex flex-col gap-3">
      <Checkbox id="reviews-waiting" label={t("waitingOnly")} checked={waitingOnly} onChange={(e) => setWaitingOnly(e.target.checked)} />
      {q.isPending ? (
        <SkeletonList rows={4} />
      ) : q.isError ? (
        <Notice tone="error">{err(q.error)}</Notice>
      ) : !rows.length ? (
        <EmptyState icon={<Star size={32} aria-hidden />} title={waitingOnly && all.length ? t("allReplied") : t("empty")} body={waitingOnly && all.length ? undefined : t("emptyBody")} />
      ) : (
        <ul className="flex flex-col gap-3" data-testid="gym-reviews">
          {rows.map((r) => (
            <ReviewCard key={r.id} review={r} gymId={ctx.gymId} />
          ))}
        </ul>
      )}
      {q.hasNextPage ? (
        <div>
          <Button variant="secondary" onClick={() => void q.fetchNextPage()} busy={q.isFetchingNextPage}>
            {t("loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ReviewCard({ review: r, gymId }: { review: Review; gymId: string }) {
  const t = useTranslations("gp.reviews");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(!r.reply);
  const [text, setText] = useState(r.reply?.text ?? "");
  const reply = useMutation({
    mutationFn: () => postReply(r.id, text.trim()),
    onSuccess: () => {
      toast.show(r.reply ? t("replyChanged") : t("replyPosted"));
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ["gm-reviews", gymId] });
    },
  });
  return (
    <li className="rounded-card border border-line bg-surface p-4" data-testid="gym-review">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={r.stars} label={t("stars", { n: r.stars })} />
        <span className="text-sm text-muted">
          {r.author.displayName ?? t("member")} · {f.date(r.createdAt)}
        </span>
        <Badge tone={r.reply ? "brand" : "warning"} className="ml-auto">
          {r.reply ? t("replied") : t("awaiting")}
        </Badge>
      </div>
      {r.text ? <p className="mt-2 max-w-[65ch] whitespace-pre-line">{r.text}</p> : <p className="mt-2 text-sm text-muted">{t("noText")}</p>}
      {r.reply && !editing ? (
        <div className="mt-3 rounded-control border-l-4 border-line-strong/50 bg-surface-2/60 py-2 pl-3 text-sm">
          <p className="font-semibold">{t("yourReply")}</p>
          <p className="mt-1 whitespace-pre-line text-muted">{r.reply.text}</p>
          <Button variant="ghost" size="sm" className="mt-1" onClick={() => setEditing(true)}>
            {t("editReply")}
          </Button>
        </div>
      ) : null}
      {editing ? (
        <form
          className="mt-3 flex flex-col gap-3 border-t border-line pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (replyOk(text)) reply.mutate();
          }}
        >
          <Textarea id={`reply-${r.id}`} label={r.reply ? t("editReply") : t("writeReply")} hint={t("replyHint")} value={text} onChange={(e) => setText(e.target.value)} rows={3} minLength={2} maxLength={1000} />
          {reply.isError ? <Notice tone="error">{err(reply.error)}</Notice> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!replyOk(text)} busy={reply.isPending} confirm={r.reply ? "save" : { kind: "send", title: t("replyAsk") }} data-testid="send-reply">
              <ChatCircleText size={16} aria-hidden /> {r.reply ? t("saveReply") : t("reply")}
            </Button>
            {r.reply ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setText(r.reply?.text ?? "");
                  setEditing(false);
                }}
              >
                {t("cancel")}
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}
    </li>
  );
}

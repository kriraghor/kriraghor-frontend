"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { problemOf } from "@kriraghor/api-client";
import { Button, Dialog, Notice, Textarea, useToast } from "@kriraghor/ui/kit";
import { replyErrorKey, replyOk, reviews } from "@/lib/trust";

/**
 * The owner's reply to a review (M17 FR-34): one reply per review, which can be changed. Phone
 * numbers and links are refused (REPLY_HAS_CONTACT) so the conversation stays on Kriraghor; the
 * member is told about the first reply.
 */
export function ReplyDialog({ reviewId, current, open, onOpenChange, onDone }: { reviewId: string; current: string | null; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }) {
  const t = useTranslations("trust.replyDialog");
  const toast = useToast();
  const [text, setText] = useState(current ?? "");
  const send = useMutation({
    mutationFn: () => reviews.reply(reviewId, text.trim()),
    onSuccess: () => {
      toast.show(current ? t("changed") : t("posted"));
      onDone();
      onOpenChange(false);
    },
  });
  const problem = send.error ? problemOf(send.error) : null;
  const formId = `reply-form-${reviewId}`;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) send.reset();
        onOpenChange(next);
      }}
      title={current ? t("editTitle") : t("title")}
      description={t("lead")}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={!replyOk(text)} busy={send.isPending} confirm={current ? "save" : "send"} data-testid="send-reply">
            {current ? t("save") : t("send")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          if (replyOk(text)) send.mutate();
        }}
        className="flex flex-col gap-3"
      >
        <Textarea id={`reply-${reviewId}`} label={t("label")} hint={t("hint")} value={text} onChange={(e) => setText(e.target.value)} minLength={2} maxLength={1000} rows={4} />
        {send.isError ? <Notice tone="error">{t(`errors.${replyErrorKey(problem?.code)}`)}</Notice> : null}
      </form>
    </Dialog>
  );
}

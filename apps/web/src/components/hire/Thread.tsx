"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { problemOf } from "@/lib/api/client";
import { hire } from "@/lib/hire";
import { Notice } from "../ui";

/**
 * The request's message thread (M11 v3: contact stays in-app). Before payment the server refuses
 * phone numbers, emails and links (CONTACT_NOT_ALLOWED); the phones show on the request once paid.
 */
export function Thread({ requestId }: { requestId: string }) {
  const t = useTranslations("hire");
  const locale = useLocale();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const q = useQuery({ queryKey: ["hire-thread", requestId], queryFn: () => hire.messages(requestId), refetchInterval: 15_000 });
  const send = useMutation({
    mutationFn: () => hire.post(requestId, body.trim()),
    onSuccess: () => {
      setBody("");
      return qc.invalidateQueries({ queryKey: ["hire-thread", requestId] });
    },
  });
  const problem = send.error ? problemOf(send.error) : null;
  const time = (iso: string) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso));

  return (
    <section className="flex flex-col border-2 border-line" aria-labelledby={`thread-${requestId}`} data-testid="hire-thread">
      <h2 id={`thread-${requestId}`} className="border-b-2 border-line px-4 py-3 text-lg font-extrabold">
        {t("messages")}
      </h2>
      <ol className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto px-4 py-3" aria-live="polite">
        {q.data?.items.length ? (
          q.data.items.map((m) => (
            <li key={m.id} className={`max-w-[85%] px-3 py-2 text-sm ${m.mine ? "self-end bg-brand/10" : "self-start bg-surface-2"}`} data-testid="hire-message">
              {!m.mine && m.author ? <span className="block text-xs font-bold">{m.author}</span> : null}
              <span className="whitespace-pre-line">{m.body}</span>
              <span className="mt-1 block text-right text-xs text-muted">{time(m.at)}</span>
            </li>
          ))
        ) : (
          <li className="text-sm text-muted">{q.isPending ? t("loading") : t("noMessages")}</li>
        )}
      </ol>
      {q.data && !q.data.contactAllowed ? <p className="px-4 text-xs text-muted">{t("contactNote")}</p> : null}
      <form
        className="flex flex-col gap-2 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) send.mutate();
        }}
      >
        <label htmlFor={`msg-${requestId}`} className="sr-only">
          {t("message")}
        </label>
        <textarea id={`msg-${requestId}`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={2} placeholder={t("messageHint")} className="glass-card p-3 text-base text-ink" data-testid="hire-message-input" />
        {problem ? <Notice tone="error">{problem.code === "CONTACT_NOT_ALLOWED" ? t("contactRefused") : problem.code === "MESSAGES_RATE_LIMITED" ? t("tooMany") : problem.title}</Notice> : null}
        <button type="submit" disabled={send.isPending || !body.trim()} className="min-h-11 self-end bg-brand px-4 font-bold text-white hover:bg-brand-hover disabled:opacity-50" data-testid="hire-message-send">
          {t("sendMessage")}
        </button>
      </form>
    </section>
  );
}

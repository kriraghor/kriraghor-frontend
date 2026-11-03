"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ChatCircleText, Plus, Trophy } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Avatar, Badge, Button, ButtonLink, EmptyState, Notice, Skeleton, Tabs, Textarea } from "@kriraghor/ui/kit";
import { usePathname, useRouter } from "@kriraghor/ui/i18n/navigation";
import { dateRange } from "@/lib/tournament-dates";
import { tournamentPosts, type Thread } from "@/lib/tournament-posts";
import { MePanel } from "../MePanel";

const POLL_MS = 15_000;

/** /me/tournaments: my posts and my conversations about tournaments (M26-FR-07). */
export function MyTournaments() {
  const t = useTranslations("tournaments");
  const { status } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const threadId = params.get("thread");
  const tab = threadId || params.get("tab") === "messages" ? "messages" : "posts";
  const threads = useQuery({ queryKey: ["tournament-threads"], queryFn: tournamentPosts.threads, enabled: status === "signed_in", refetchInterval: POLL_MS });
  const unread = (threads.data?.items ?? []).reduce((n, x) => n + x.unread, 0);
  if (status === "signed_out") return <MePanel />;
  return (
    <section className="flex flex-col gap-5 px-4 py-6 md:px-0 md:py-8" data-testid="my-tournaments">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">{t("myTitle")}</h1>
        <ButtonLink href="/tournaments/new" icon={<Plus size={18} aria-hidden />}>
          {t("postOne")}
        </ButtonLink>
      </div>
      <Tabs
        label={t("myTitle")}
        value={tab}
        onValueChange={(v) => router.replace(v === "messages" ? `${pathname}?tab=messages` : pathname)}
        items={[
          { value: "posts", label: t("myPosts"), content: <MyPosts /> },
          { value: "messages", label: unread ? `${t("messages")} (${unread})` : t("messages"), content: threadId ? <Conversation id={threadId} /> : <Inbox threads={threads.data?.items} loading={threads.isPending} /> },
        ]}
      />
    </section>
  );
}

function MyPosts() {
  const t = useTranslations("tournaments");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["my-tournament-posts"], queryFn: () => tournamentPosts.mine() });
  if (q.isPending) return <Skeleton className="h-40 rounded-card" />;
  if (q.isError || !q.data) return <Notice tone="error">{t("failed")}</Notice>;
  if (!q.data.items.length) return <EmptyState icon={<Trophy size={32} aria-hidden />} title={t("noMyPosts")} body={t("noMyPostsBody")} action={<ButtonLink href="/tournaments/new">{t("postOne")}</ButtonLink>} />;
  return (
    <ul className="flex flex-col gap-3" data-testid="my-posts">
      {q.data.items.map((p) => (
        <li key={p.id} className="surface-card flex flex-wrap items-center justify-between gap-3 p-4" data-testid="my-post">
          <div className="min-w-0">
            <Link href={`/tournaments/${p.slug}`} className="font-bold">
              {p.title}
            </Link>
            <p className="text-sm text-muted">{dateRange(p.startDate, p.endDate, locale)}</p>
            {p.removedReason ? <p className="mt-1 text-sm text-danger">{t("removedBecause", { reason: p.removedReason })}</p> : null}
          </div>
          <span className="flex items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1 text-muted" aria-label={t("comments", { n: p.commentCount })}>
              <ChatCircleText size={16} aria-hidden />
              {p.commentCount}
            </span>
            <Badge tone={p.status === "open" ? "brand" : p.status === "removed" ? "danger" : "neutral"}>{t(`status.${p.status}`)}</Badge>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Inbox({ threads, loading }: { threads?: Thread[]; loading: boolean }) {
  const t = useTranslations("tournaments");
  if (loading) return <Skeleton className="h-40 rounded-card" />;
  if (!threads?.length) return <EmptyState icon={<ChatCircleText size={32} aria-hidden />} title={t("noMessages")} body={t("noMessagesBody")} action={<ButtonLink href="/tournaments" variant="secondary">{t("backToFeed")}</ButtonLink>} />;
  return (
    <ul className="flex flex-col gap-2" data-testid="thread-list">
      {threads.map((x) => (
        <li key={x.id}>
          <Link href={`/me/tournaments?thread=${x.id}`} className="surface-card flex items-center gap-3 p-3 no-underline hover:border-brand" data-testid="thread-row">
            <Avatar name={x.other.displayName} src={x.other.avatarUrl} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold text-ink">{x.other.displayName}</span>
              <span className="block truncate text-sm text-muted">{x.post.title}</span>
              {x.lastMessage ? <span className="block truncate text-sm text-ink">{x.lastMessage.body}</span> : null}
            </span>
            {x.unread ? <Badge tone="brand">{x.unread}</Badge> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** One conversation: polls for new messages, and marks what arrived as read. */
function Conversation({ id }: { id: string }) {
  const t = useTranslations("tournaments");
  const locale = useLocale();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const q = useQuery({ queryKey: ["tournament-thread", id], queryFn: () => tournamentPosts.messages(id), refetchInterval: POLL_MS });
  const waiting = (q.data?.items ?? []).filter((m) => !m.mine).length;
  const threadUnread = q.data?.thread.unread ?? 0;
  useEffect(() => {
    if (!threadUnread) return;
    void tournamentPosts.markRead(id).then(() => qc.invalidateQueries({ queryKey: ["tournament-threads"] }));
  }, [id, qc, threadUnread, waiting]);
  const send = useMutation({
    mutationFn: () => tournamentPosts.send(id, body.trim()),
    onSuccess: () => {
      setBody("");
      void qc.invalidateQueries({ queryKey: ["tournament-thread", id] });
      void qc.invalidateQueries({ queryKey: ["tournament-threads"] });
    },
  });
  const problem = problemOf(send.error);
  const when = (iso: string) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso));
  if (q.isPending) return <Skeleton className="h-64 rounded-card" />;
  if (q.isError || !q.data) return <Notice tone="error">{t("threadNotFound")}</Notice>;
  const { thread } = q.data;
  return (
    <section className="flex flex-col gap-3" data-testid="thread">
      <Link href="/me/tournaments?tab=messages" className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-brand-text no-underline hover:underline">
        <ArrowLeft size={16} aria-hidden />
        {t("allMessages")}
      </Link>
      <div className="surface-card p-3">
        <p className="font-bold">{thread.other.displayName}</p>
        <Link href={`/tournaments/${thread.post.slug}`} className="text-sm">
          {thread.post.title}
        </Link>
      </div>
      <ol className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto" aria-live="polite" data-testid="thread-messages">
        {q.data.items.length ? (
          q.data.items.map((m) => (
            <li key={m.id} className={`max-w-[85%] rounded-card px-3 py-2 text-sm ${m.mine ? "self-end bg-brand-soft" : "self-start bg-surface-2"}`} data-testid="thread-message">
              <span className="whitespace-pre-line break-words">{m.body}</span>
              <span className="mt-1 block text-right text-xs text-muted">{when(m.at)}</span>
            </li>
          ))
        ) : (
          <li className="text-sm text-muted">{t("startConversation")}</li>
        )}
      </ol>
      {q.data.canSend ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) send.mutate();
          }}
        >
          <Textarea id="thread-body" label={t("yourMessage")} hint={t("messageHint")} value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={2000} data-testid="thread-body" />
          {problem ? <Notice tone="error">{problem.title ?? t("failed")}</Notice> : null}
          <Button type="submit" className="self-end" busy={send.isPending} disabled={!body.trim()} data-testid="thread-send">
            {t("send")}
          </Button>
        </form>
      ) : (
        <Notice tone="info">{t("threadClosed")}</Notice>
      )}
    </section>
  );
}

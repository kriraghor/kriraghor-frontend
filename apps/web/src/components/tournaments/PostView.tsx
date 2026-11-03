"use client";

import { useState } from "react";
import Image from "next/image";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, ChatCircleDots, MapPin, PencilSimple, X } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { Link, useRouter } from "@kriraghor/ui/i18n/navigation";
import { Avatar, Badge, Button, ButtonLink, EmptyState, Notice, Skeleton, Textarea } from "@kriraghor/ui/kit";
import { ShareButton } from "@kriraghor/ui/share";
import { ReportButton } from "@kriraghor/ui/trust";
import { publicEnv } from "@kriraghor/session/env";
import { formatTaka } from "@/lib/payments";
import { dateRange } from "@/lib/tournament-dates";
import { tournamentPosts, type PostPage } from "@/lib/tournament-posts";
import { placeOf } from "./PostCard";

/**
 * /tournaments/[slug] (M26-FR-02, FR-06, FR-07): every detail of a tournament, its comments and a way
 * to message the person who posted it. A clear line says Kriraghor doesn't run it or handle its fees.
 */
export function PostView({ slug }: { slug: string }) {
  const t = useTranslations("tournaments");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["tournament-post", slug], queryFn: () => tournamentPosts.page(slug) });
  if (q.isPending) return <Skeleton className="mx-auto mt-10 h-96 max-w-[1100px] rounded-card" />;
  if (q.isError || !q.data) {
    return (
      <section className="mx-auto max-w-[1100px] px-5 py-10">
        <EmptyState title={t("notFound")} body={t("notFoundBody")} action={<ButtonLink href="/tournaments">{t("backToFeed")}</ButtonLink>} />
      </section>
    );
  }
  const p = q.data;
  const sport = locale === "bn" ? p.sport.bn : p.sport.en;
  const facts: [string, string | null][] = [
    [t("field.dates"), dateRange(p.startDate, p.endDate, locale)],
    [t("field.deadline"), dateRange(p.registrationDeadline, null, locale)],
    [t("fact.fee"), p.entryFee ? formatTaka(p.entryFee, locale) : t("free")],
    [t("fact.prizePool"), p.prizePool ? formatTaka(p.prizePool, locale) : null],
    [t("field.format"), t(`format.${p.format}`)],
    [t("field.teamLimit"), p.teamLimit ? String(p.teamLimit) : null],
    [t("field.playersPerTeam"), p.playersPerTeam ? String(p.playersPerTeam) : null],
    [t("field.gender"), t(`gender.${p.gender}`)],
    [t("field.ageGroup"), p.ageGroup],
    [t("field.skillLevel"), p.skillLevel ? t(`skill.${p.skillLevel}`) : null],
  ];

  return (
    <article className="mx-auto max-w-[1100px] px-5 py-8" data-testid="post-view">
      <Link href="/tournaments" className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-brand-text no-underline hover:underline">
        <ArrowLeft size={16} aria-hidden />
        {t("backToFeed")}
      </Link>
      {p.status === "removed" ? (
        <Notice tone="error" className="mt-4" title={t("removedTitle")}>
          {p.removedReason}
        </Notice>
      ) : null}

      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{sport}</Badge>
            {p.status === "open" ? (p.registrationOpen ? <Badge tone="info">{t("registrationOpen")}</Badge> : <Badge tone="neutral">{t("registrationClosed")}</Badge>) : <Badge tone="neutral">{t(`status.${p.status}`)}</Badge>}
          </div>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight md:text-4xl">{p.title}</h1>
          <p className="mt-1 text-muted">{t("by", { org: p.organiserName })}</p>
          {p.photos.length ? (
            <ul className="mt-5 grid gap-2 sm:grid-cols-2" data-testid="post-photos">
              {p.photos.map((ph, i) => (
                <li key={ph.id} className={`relative aspect-[16/10] overflow-hidden rounded-card bg-surface-2 ${i === 0 ? "sm:col-span-2" : ""}`}>
                  <Image src={ph.url} alt="" fill sizes="(min-width: 1180px) 700px, 100vw" className="object-cover" unoptimized />
                </li>
              ))}
            </ul>
          ) : null}
          <h2 className="mt-6 text-xl font-extrabold">{t("about")}</h2>
          <p className="mt-2 whitespace-pre-line">{p.description}</p>
          {p.prizeDetails ? (
            <>
              <h2 className="mt-6 text-xl font-extrabold">{t("field.prizeDetails")}</h2>
              <p className="mt-2 whitespace-pre-line">{p.prizeDetails}</p>
            </>
          ) : null}
          {p.rules ? (
            <>
              <h2 className="mt-6 text-xl font-extrabold">{t("field.rules")}</h2>
              <p className="mt-2 whitespace-pre-line">{p.rules}</p>
            </>
          ) : null}
          <p className="mt-6 rounded-card border border-line bg-surface-2 p-4 text-sm" data-testid="post-disclaimer">
            {t("notOurs")}
          </p>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="surface-card p-4">
            <p className="flex items-start gap-2 font-semibold">
              <MapPin size={18} aria-hidden className="mt-0.5 shrink-0 text-muted" />
              <span>
                {p.venueName}
                <span className="block text-sm font-normal text-muted">{[p.address, placeOf(p, locale)].filter(Boolean).join(", ")}</span>
                {p.mapLink ? (
                  <a href={p.mapLink} target="_blank" rel="noopener noreferrer nofollow" className="text-sm font-semibold text-brand-text">
                    {t("openMap")}
                  </a>
                ) : null}
              </span>
            </p>
            <dl className="mt-3 grid gap-2 border-t border-line pt-3 text-sm">
              {facts
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-right font-semibold">{v}</dd>
                  </div>
                ))}
            </dl>
          </div>
          <Actions post={p} />
          <div className="flex flex-wrap items-center gap-3">
            <ShareButton url={`${publicEnv().WEB_URL}/tournaments/${p.slug}`} title={p.title} text={p.organiserName} />
            {p.mine ? null : <ReportButton subjectType="tournament_post" subjectId={p.id} label={t("report")} />}
          </div>
        </aside>
      </div>
      {p.status === "removed" ? null : <Comments post={p} />}
    </article>
  );
}

/** Message the organiser, or, on my own post, edit and close it. */
function Actions({ post: p }: { post: PostPage }) {
  const t = useTranslations("tournaments");
  const router = useRouter();
  const qc = useQueryClient();
  const { status } = useAuth();
  const open = useMutation({ mutationFn: () => tournamentPosts.openThread(p.id), onSuccess: (th) => router.push(`/me/tournaments?thread=${th.id}`) });
  const close = useMutation({ mutationFn: () => tournamentPosts.close(p.id), onSuccess: () => qc.invalidateQueries({ queryKey: ["tournament-post", p.slug] }) });
  const problem = problemOf(open.error ?? close.error);
  if (p.mine) {
    return (
      <div className="surface-card flex flex-col gap-2 p-4" data-testid="post-owner">
        <p className="text-sm font-semibold">{t("yourPost")}</p>
        {p.can.edit ? (
          <ButtonLink href={`/tournaments/${p.slug}/edit`} variant="secondary" icon={<PencilSimple size={18} aria-hidden />} data-testid="post-edit">
            {t("edit")}
          </ButtonLink>
        ) : null}
        {p.can.close ? (
          <Button variant="secondary" icon={<X size={18} aria-hidden />} busy={close.isPending} onClick={() => close.mutate()} data-testid="post-close">
            {t("close")}
          </Button>
        ) : null}
        <ButtonLink href="/me/tournaments" variant="link">
          {t("myPosts")}
        </ButtonLink>
        {problem ? <Notice tone="error">{problem.title ?? t("failed")}</Notice> : null}
      </div>
    );
  }
  if (p.threadId) {
    return (
      <ButtonLink href={`/me/tournaments?thread=${p.threadId}`} size="lg" block icon={<ChatCircleDots size={20} aria-hidden />} data-testid="post-message">
        {t("openConversation")}
      </ButtonLink>
    );
  }
  if (!p.can.message) return null;
  if (status !== "signed_in") {
    return (
      <ButtonLink href={`/sign-in?next=/tournaments/${p.slug}`} size="lg" block icon={<ChatCircleDots size={20} aria-hidden />} data-testid="post-message">
        {t("signInToMessage")}
      </ButtonLink>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" block icon={<ChatCircleDots size={20} aria-hidden />} busy={open.isPending} onClick={() => open.mutate()} data-testid="post-message">
        {t("messageOrganiser")}
      </Button>
      {problem ? (
        <Notice tone="error">
          {problem.code === "PHONE_REQUIRED" ? (
            <>
              {t("phoneRequired")}{" "}
              <Link href="/account/settings#phone" className="font-semibold">
                {t("addPhone")}
              </Link>
            </>
          ) : (
            (problem.title ?? t("failed"))
          )}
        </Notice>
      ) : null}
    </div>
  );
}

/** Public comments, oldest first (M26-FR-06). Phones and links are refused; messages allow them. */
function Comments({ post: p }: { post: PostPage }) {
  const t = useTranslations("tournaments");
  const locale = useLocale();
  const qc = useQueryClient();
  const { status } = useAuth();
  const [body, setBody] = useState("");
  const key = ["tournament-comments", p.id, status];
  const list = useInfiniteQuery({
    queryKey: key,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => tournamentPosts.comments(p.id, pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["tournament-comments", p.id] });
    void qc.invalidateQueries({ queryKey: ["tournament-post", p.slug] });
  };
  const add = useMutation({
    mutationFn: () => tournamentPosts.comment(p.id, body.trim()),
    onSuccess: () => {
      setBody("");
      refresh();
    },
  });
  const remove = useMutation({ mutationFn: (id: string) => tournamentPosts.removeComment(p.id, id), onSuccess: refresh });
  const problem = problemOf(add.error ?? remove.error);
  const items = list.data?.pages.flatMap((x) => x.items) ?? [];
  const when = (iso: string) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso));

  return (
    <section className="mt-10 max-w-3xl" aria-labelledby="post-comments" data-testid="post-comments">
      <h2 id="post-comments" className="text-2xl font-extrabold">
        {t("comments", { n: p.commentCount })}
      </h2>
      <ul className="mt-4 flex flex-col gap-4">
        {items.map((c) => (
          <li key={c.id} className="flex gap-3" data-testid="post-comment">
            <Avatar name={c.author.displayName} src={c.author.avatarUrl} size={36} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                {c.author.username ? (
                  <Link href={`/players/${c.author.username}`} className="font-bold">
                    {c.author.displayName}
                  </Link>
                ) : (
                  <span className="font-bold">{c.author.displayName}</span>
                )}
                <span className="text-xs text-muted">{when(c.at)}</span>
              </p>
              <p className="mt-0.5 whitespace-pre-line break-words">{c.body}</p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                {c.canRemove ? (
                  <button type="button" className="min-h-9 text-sm font-semibold text-muted underline-offset-4 hover:underline" onClick={() => remove.mutate(c.id)} data-testid="comment-remove">
                    {t("removeComment")}
                  </button>
                ) : null}
                {c.mine ? null : <ReportButton subjectType="tournament_comment" subjectId={c.id} label={t("report")} />}
              </div>
            </div>
          </li>
        ))}
        {!list.isPending && !items.length ? <li className="text-muted">{t("noComments")}</li> : null}
      </ul>
      {list.hasNextPage ? (
        <Button variant="secondary" className="mt-4" busy={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
          {t("more")}
        </Button>
      ) : null}
      {p.can.comment ? (
        status === "signed_in" ? (
          <form
            className="mt-6 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (body.trim()) add.mutate();
            }}
          >
            <Textarea id="comment-body" label={t("addComment")} hint={t("commentHint")} value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={1000} data-testid="comment-body" />
            {problem ? <Notice tone="error">{problem.code === "CONTACT_NOT_ALLOWED" ? t("contactRefused") : problem.code === "PHONE_REQUIRED" ? t("phoneRequired") : (problem.title ?? t("failed"))}</Notice> : null}
            <Button type="submit" className="self-start" busy={add.isPending} disabled={!body.trim()} data-testid="comment-send">
              {t("sendComment")}
            </Button>
          </form>
        ) : (
          <p className="mt-6">
            <Link href={`/sign-in?next=/tournaments/${p.slug}`} className="font-semibold">
              {t("signInToComment")}
            </Link>
          </p>
        )
      ) : null}
    </section>
  );
}

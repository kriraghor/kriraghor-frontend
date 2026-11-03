"use client";

import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { publicEnv } from "@kriraghor/session/env";
import { Button, DataTable, DetailLayout, FilterBar, Notice, PageTitle, ReasonDialog, Skeleton, type Column } from "@kriraghor/ui/kit";
import { formatTaka } from "@/lib/admin/finance";
import { POST_STATUSES, postActions, tournamentPostsAdmin, type PostStatus } from "@/lib/admin/tournament-posts";
import { useCursorList } from "@/lib/use-cursor-list";
import { useUrlFilters } from "@/lib/use-url-filters";
import { StatusBadge } from "../../StatusBadge";
import { formatDhaka, useAdminMe } from "../useAdminMe";

type Row = Awaited<ReturnType<typeof tournamentPostsAdmin.list>>["items"][number];

/**
 * /admin/tournament-posts (M26-FR-09): every tournament post people have made. They go live at once,
 * so staff read them here, remove one with a reason (its author is told) and restore it as it was.
 */
export function TournamentPostsDesk() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-10 h-64 max-w-[1320px]" />}>
      <Desk />
    </Suspense>
  );
}

function Desk() {
  const t = useTranslations("tournamentPosts");
  const locale = useLocale();
  const { ready } = useAdminMe();
  const { values, set, clear, params } = useUrlFilters({ status: { default: "", allowed: ["", ...POST_STATUSES] }, q: { default: "" } });
  const status = values.status as PostStatus | "";
  const search = values.q.trim();
  const open = params.get("id");
  const list = useCursorList<Row>(["admin-tournament-posts", status, search], (cursor) => tournamentPostsAdmin.list({ status: status || undefined, q: search || undefined, cursor }), { enabled: ready });
  const openTitle = list.items.find((x) => x.id === open)?.title;

  const columns: Column<Row>[] = [
    {
      id: "title",
      header: t("post"),
      primary: true,
      sort: (x) => x.title,
      cell: (x) => (
        <>
          <span className="block font-semibold">{x.title}</span>
          <span className="block text-xs font-normal text-muted">
            {x.organiserName} · {locale === "bn" ? x.sport.bn : x.sport.en}
          </span>
        </>
      ),
    },
    { id: "author", header: t("author"), sort: (x) => x.author.displayName, cell: (x) => x.author.displayName },
    { id: "start", header: t("starts"), sort: (x) => x.startDate, cell: (x) => x.startDate },
    { id: "comments", header: t("comments"), align: "end", sort: (x) => x.commentCount, cell: (x) => x.commentCount },
    {
      id: "status",
      header: t("statusLabel"),
      sort: (x) => x.status,
      cell: (x) => (
        <StatusBadge status={x.status} domain="tournamentPost">
          {t(`status.${x.status}`)}
        </StatusBadge>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8" data-testid="tournament-posts-desk">
      <PageTitle title={t("title")} description={t("intro")} />
      <DetailLayout className="mt-6" open={Boolean(open)} onClose={() => set({ id: null })} title={openTitle ?? t("title")} pane={open ? <PostPane key={open} id={open} /> : null}>
        <div className="flex flex-col gap-4">
          <FilterBar
            search={{ value: values.q, onChange: (v) => set({ q: v }), label: t("search") }}
            selects={[{ id: "status", label: t("statusLabel"), value: status, onChange: (v) => set({ status: v }), anyLabel: t("all"), options: POST_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) })) }]}
            onClear={clear}
          />
          <DataTable
            label={t("title")}
            testId="tournament-posts"
            rowTestId="tournament-post-row"
            columns={columns}
            rows={list.rows}
            rowId={(x) => x.id}
            loading={list.loading}
            error={list.error}
            onRetry={list.retry}
            empty={{ title: t("none") }}
            hasMore={list.hasMore}
            onMore={list.more}
            busy={list.busy}
            onRowClick={(x) => set({ id: x.id })}
            selectedId={open}
          />
        </div>
      </DetailLayout>
    </div>
  );
}

function PostPane({ id }: { id: string }) {
  const t = useTranslations("tournamentPosts");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready } = useAdminMe();
  const [action, setAction] = useState<"remove" | "restore" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const one = useQuery({ queryKey: ["admin-tournament-post", id], queryFn: () => tournamentPostsAdmin.get(id), enabled: ready });
  if (one.isError) return <Notice tone="error">{problemOf(one.error)?.title ?? t("failed")}</Notice>;
  if (!one.data) return <Skeleton className="h-64" />;
  const d = one.data;
  const name = (x: { en: string; bn: string } | null) => (x ? (locale === "bn" ? x.bn : x.en) : null);
  const facts: [string, string | null][] = [
    [t("author"), d.author.displayName],
    [t("organiser"), d.organiserName],
    [t("sport"), name(d.sport)],
    [t("place"), [d.venueName, d.address, name(d.area), name(d.district)].filter(Boolean).join(", ")],
    [t("starts"), d.startDate],
    [t("ends"), d.endDate],
    [t("deadline"), d.registrationDeadline],
    [t("fee"), d.entryFee ? formatTaka(d.entryFee, locale) : t("free")],
    [t("prize"), d.prizePool ? formatTaka(d.prizePool, locale) : null],
    [t("posted"), formatDhaka(d.createdAt, locale)],
  ];
  const act = async (reason: string) => {
    if (!action) return;
    setBusy(true);
    setError(null);
    try {
      await tournamentPostsAdmin[action](id, reason);
      setAction(null);
      await Promise.all([qc.invalidateQueries({ queryKey: ["admin-tournament-post", id] }), qc.invalidateQueries({ queryKey: ["admin-tournament-posts"] })]);
    } catch (err) {
      setError(problemOf(err)?.title ?? t("failed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-4" data-testid="tournament-post-pane">
      <StatusBadge status={d.status} domain="tournamentPost" className="self-start">
        {t(`status.${d.status}`)}
      </StatusBadge>
      {d.removedReason ? <Notice tone="error" title={t("removedBecause")}>{d.removedReason}</Notice> : null}
      <dl className="grid gap-2 text-sm">
        {facts
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right font-semibold">{v}</dd>
            </div>
          ))}
      </dl>
      <section>
        <h3 className="font-semibold">{t("description")}</h3>
        <p className="mt-1 whitespace-pre-line break-words text-sm">{d.description}</p>
      </section>
      {d.rules ? (
        <section>
          <h3 className="font-semibold">{t("rules")}</h3>
          <p className="mt-1 whitespace-pre-line break-words text-sm">{d.rules}</p>
        </section>
      ) : null}
      <a href={`${publicEnv().WEB_URL}/tournaments/${d.slug}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 self-start font-semibold text-brand-text">
        {t("openPublic")}
        <ArrowSquareOut size={16} aria-hidden />
      </a>
      <div className="flex flex-wrap gap-2">
        {postActions(d.status).map((a) => (
          <Button key={a} variant={a === "remove" ? "danger" : "secondary"} onClick={() => setAction(a)} data-testid={`tournament-post-${a}`}>
            {t(a)}
          </Button>
        ))}
      </div>
      <ReasonDialog
        open={Boolean(action)}
        onOpenChange={(v) => {
          if (!v) {
            setAction(null);
            setError(null);
          }
        }}
        title={action ? `${t(action)}: ${d.title}` : ""}
        description={action === "remove" ? t("removeHelp") : t("restoreHelp")}
        label={t("reason")}
        confirmLabel={action ? t(action) : ""}
        danger={action === "remove"}
        minLength={5}
        maxLength={300}
        busy={busy}
        error={error}
        onConfirm={(why) => void act(why)}
      />
    </div>
  );
}

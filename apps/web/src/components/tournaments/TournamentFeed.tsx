"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Trophy } from "@phosphor-icons/react";
import { ButtonLink, Button, Checkbox, EmptyState, ErrorState, FilterBar, SkeletonList } from "@kriraghor/ui/kit";
import { PageHeader } from "@kriraghor/ui/page-header";
import { useUrlFilters } from "@kriraghor/ui/url-filters";
import { PHOTOS } from "@/lib/photos";
import { FEED_FILTERS, FEES, FORMATS, GENDERS, SORTS, tournamentPosts, type FeedFilters } from "@/lib/tournament-posts";
import { PostCard } from "./PostCard";

/**
 * /tournaments (M26-FR-05): the feed of tournaments people have posted, with filters and a sort kept
 * in the URL. Kriraghor organises none of them, and the page says so.
 */
export function TournamentFeed() {
  const t = useTranslations("tournaments");
  const locale = useLocale();
  const { values, set, clear } = useUrlFilters(FEED_FILTERS);
  const f = values as FeedFilters;
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const sports = useQuery({ queryKey: ["catalog-sports"], queryFn: tournamentPosts.sports, staleTime: 3600_000 });
  const places = useQuery({ queryKey: ["catalog-locations"], queryFn: tournamentPosts.locations, staleTime: 3600_000 });
  const list = useInfiniteQuery({
    queryKey: ["tournament-feed", f],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => tournamentPosts.feed(f, pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;
  const filtered = Boolean(f.q || f.sport || f.districtId || f.fee || f.format || f.gender || f.open);
  const districts = (places.data ?? []).flatMap((d) => d.districts.map((x) => ({ value: x.id, label: `${name(x)}, ${name(d)}` })));

  return (
    <section className="mx-auto max-w-[1320px] px-5 py-10" data-testid="tournament-feed">
      <PageHeader photo={PHOTOS.tournaments}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="mr-auto">
            <h1 className="text-4xl font-extrabold">{t("title")}</h1>
            <p className="mt-2 max-w-2xl text-muted">{t("lead")}</p>
          </div>
          <ButtonLink href="/tournaments/new" icon={<Plus size={18} aria-hidden />} data-testid="post-new">
            {t("postOne")}
          </ButtonLink>
        </div>
      </PageHeader>

      <FilterBar
        className="mt-6"
        search={{ value: f.q, onChange: (q) => set({ q }), label: t("search"), placeholder: t("searchHint"), testId: "feed-search" }}
        selects={[
          { id: "feed-sport", label: t("filter.sport"), value: f.sport, onChange: (sport) => set({ sport }), anyLabel: t("filter.anySport"), options: (sports.data ?? []).map((s) => ({ value: s.key, label: name(s) })) },
          { id: "feed-district", label: t("filter.district"), value: f.districtId, onChange: (districtId) => set({ districtId }), anyLabel: t("filter.anyDistrict"), options: districts },
          { id: "feed-fee", label: t("filter.fee"), value: f.fee, onChange: (fee) => set({ fee }), anyLabel: t("filter.anyFee"), options: FEES.map((x) => ({ value: x, label: t(`feeKind.${x}`) })) },
          { id: "feed-format", label: t("filter.format"), value: f.format, onChange: (format) => set({ format }), anyLabel: t("filter.anyFormat"), options: FORMATS.map((x) => ({ value: x, label: t(`format.${x}`) })) },
          { id: "feed-gender", label: t("filter.gender"), value: f.gender, onChange: (gender) => set({ gender }), anyLabel: t("filter.anyGender"), options: GENDERS.map((x) => ({ value: x, label: t(`gender.${x}`) })) },
        ]}
        extra={<Checkbox id="feed-open" label={t("filter.open")} checked={Boolean(f.open)} onChange={(e) => set({ open: e.target.checked ? "1" : null })} data-testid="feed-open" />}
        onClear={filtered ? clear : undefined}
      />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" role="status" data-testid="feed-count">
          {list.isPending ? "" : t("count", { n: total })}
        </p>
        <label className="flex items-center gap-2 text-sm font-semibold" htmlFor="feed-sort">
          {t("sortBy")}
          <select id="feed-sort" value={f.sort} onChange={(e) => set({ sort: e.target.value })} className="field min-h-10 px-2" data-testid="feed-sort">
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`sort.${s}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {list.isPending ? (
        <SkeletonList className="mt-4" />
      ) : list.isError ? (
        <ErrorState className="mt-4" title={t("failed")} onRetry={() => void list.refetch()} />
      ) : items.length ? (
        <>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="post-list">
            {items.map((p) => (
              <li key={p.id}>
                <PostCard post={p} />
              </li>
            ))}
          </ul>
          {list.hasNextPage ? (
            <div className="mt-6 text-center">
              <Button variant="secondary" busy={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()} data-testid="feed-more">
                {t("more")}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState className="mt-4" icon={<Trophy size={32} aria-hidden />} title={filtered ? t("noneFiltered") : t("none")} body={filtered ? t("noneFilteredBody") : t("noneBody")} action={filtered ? <Button variant="secondary" onClick={clear}>{t("clearFilters")}</Button> : <ButtonLink href="/tournaments/new">{t("postOne")}</ButtonLink>} />
      )}
      <p className="mt-8 text-sm text-muted">{t("notOurs")}</p>
    </section>
  );
}

"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@kriraghor/ui/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { esports } from "@/lib/esports";
import { Card, CardSkeleton, Empty } from "./bits";

const STATUS_GROUPS: Record<string, string> = {
  open: "registration_open",
  upcoming: "scheduled,registration_closed,check_in",
  live: "live,results_pending",
  finished: "finalised,paid_out",
};

/** /tournaments: filter by game and stage; the URL keeps the choices (shareable). */
export function TournamentList() {
  const t = useTranslations("esports");
  const locale = useLocale();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const game = params.get("game") ?? "";
  const text = params.get("q") ?? "";
  const group = params.get("show") ?? "open";
  const games = useQuery({ queryKey: ["es-games"], queryFn: () => esports.games() });
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set(k, v);
    else next.delete(k);
    router.replace(`${pathname}?${next.toString()}`);
  };
  const statuses = STATUS_GROUPS[group] ?? STATUS_GROUPS.open;
  const q = useInfiniteQuery({
    queryKey: ["es-list", game, text, statuses],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      // The API takes one status per call; groups are merged here.
      const pages = await Promise.all(statuses.split(",").map((s) => esports.list({ ...(game ? { game } : {}), ...(text ? { q: text } : {}), status: s, cursor: pageParam, limit: 24 })));
      return { items: pages.flatMap((p) => p.items).sort((a, b) => a.startsAt.localeCompare(b.startsAt)), nextCursor: pages.length === 1 ? pages[0].nextCursor : null };
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const gameList = (games.data?.items ?? []) as { key: string; nameEn: string; nameBn: string }[];

  return (
    <section className="mx-auto max-w-[1320px] px-5 py-10">
      <h1 className="text-3xl font-extrabold md:text-4xl">{t("list.title")}</h1>
      <form
        key={text}
        role="search"
        className="mt-5 flex max-w-xl gap-2"
        onSubmit={(ev) => {
          ev.preventDefault();
          const value = String(new FormData(ev.currentTarget).get("q") ?? "").trim();
          set("q", value.length >= 2 ? value : "");
        }}
      >
        <label htmlFor="events-q" className="sr-only">
          {t("list.search")}
        </label>
        <input id="events-q" name="q" type="search" defaultValue={text} placeholder={t("list.searchHint")} autoComplete="off" enterKeyHint="search" maxLength={60} className="min-h-11 min-w-0 flex-1 field px-3 text-base text-ink" data-testid="events-search" />
        <button type="submit" className="min-h-11 rounded-control border border-line-strong/60 px-4 font-bold">
          {t("list.searchGo")}
        </button>
      </form>
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label={t("list.game")}>
        {[{ key: "", nameEn: t("list.allGames"), nameBn: t("list.allGames") }, ...gameList].map((g) => (
          <button key={g.key || "all"} type="button" role="tab" aria-selected={game === g.key} onClick={() => set("game", g.key)} className={`rounded-control min-h-11 border px-4 text-sm font-bold ${game === g.key ? "border-line-strong bg-line-strong text-bg" : "border-line text-muted hover:border-line-strong"}`}>
            {locale === "bn" ? g.nameBn : g.nameEn}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label={t("list.stage")}>
        {Object.keys(STATUS_GROUPS).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={group === k} onClick={() => set("show", k)} className={`min-h-11 border-b-4 px-3 text-sm font-bold ${group === k ? "border-brand text-ink" : "border-transparent text-muted"}`}>
            {t(`list.show.${k}`)}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {q.isPending ? Array.from({ length: 8 }, (_, i) => <CardSkeleton key={i} />) : items.map((item) => <Card key={item.id} t={item} />)}
      </div>
      {q.isError ? <p className="mt-6 text-danger">{t("loadFailed")}</p> : null}
      {q.data && !items.length ? <Empty title={t("list.empty")} body={t("list.emptyBody")} /> : null}
      {q.hasNextPage ? (
        <button type="button" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage} className="rounded-control mt-6 min-h-12 border border-line-strong px-5 font-bold disabled:opacity-50">
          {t("more")}
        </button>
      ) : null}
    </section>
  );
}

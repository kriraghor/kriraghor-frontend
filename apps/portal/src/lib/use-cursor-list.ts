"use client";

import { useInfiniteQuery, type QueryKey } from "@tanstack/react-query";

/** The list shape every desk endpoint returns; `nextCursor` is absent where the API doesn't page. */
export type CursorPage<T> = { items: T[]; nextCursor?: string | null; total?: number | null; counts?: Record<string, number> | null };

/**
 * One desk list over cursor pages: the rows so far, whether there are more, and Load more. Lists
 * whose endpoint has no cursor work the same and simply never have more. `total` and `counts`
 * come from the first page (they describe the whole filtered list).
 */
export function useCursorList<T, P extends CursorPage<T> = CursorPage<T>>(
  key: QueryKey,
  fetchPage: (cursor: string | undefined) => Promise<P>,
  opts: { enabled?: boolean; refetchInterval?: number | false; retry?: boolean | number } = {},
) {
  const q = useInfiniteQuery({
    queryKey: key,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    getNextPageParam: (last: P) => last.nextCursor ?? undefined,
    enabled: opts.enabled,
    refetchInterval: opts.refetchInterval,
    ...(opts.retry !== undefined ? { retry: opts.retry } : {}),
  });
  const first = q.data?.pages[0];
  return {
    items: (q.data?.pages.flatMap((p) => p.items) ?? []) as T[],
    rows: q.data ? (q.data.pages.flatMap((p) => p.items) as T[]) : undefined,
    first,
    total: first?.total ?? null,
    counts: first?.counts ?? null,
    hasMore: Boolean(q.hasNextPage),
    more: () => void q.fetchNextPage(),
    busy: q.isFetchingNextPage,
    loading: q.isPending,
    error: q.error,
    retry: () => void q.refetch(),
    query: q,
  };
}

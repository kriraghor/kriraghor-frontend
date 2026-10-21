"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { ShareButton } from "@kriraghor/ui/share";
import { publicEnv } from "@kriraghor/session/env";
import { market } from "@/lib/market";
import { ReportButton } from "../trust/ReportButton";
import { RatingLine, SubjectReviews } from "../trust/SubjectReviews";
import { ProductCard } from "./ProductCard";

/** /shop/s/[slug]: a verified shop, its area and about text, and its products. */
export function ShopView({ slug }: { slug: string }) {
  const t = useTranslations("market");
  const locale = useLocale();
  const q = useInfiniteQuery({
    queryKey: ["market-shop", slug],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => market.shop(slug, pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    retry: false,
  });
  if (q.isPending) return <div className="mx-auto mt-10 h-96 max-w-[1320px] animate-pulse bg-surface-2" />;
  const s = q.data?.pages[0];
  if (q.isError || !s)
    return (
      <section className="mx-auto max-w-[1320px] px-5 py-16">
        <h1 className="text-2xl font-extrabold">{t("shopNotFound")}</h1>
        <Link href="/shop" className="mt-3 inline-block font-semibold text-brand underline">
          {t("back")}
        </Link>
      </section>
    );
  const items = q.data.pages.flatMap((p) => p.items);
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-8">
      <Link href="/shop" className="text-sm font-semibold text-brand underline">
        ← {t("title")}
      </Link>
      <h1 className="mt-4 text-4xl font-extrabold" data-testid="shop-name">
        {s.name}
      </h1>
      <p className="mt-1 text-muted">
        {t(`shopType.${s.shopType}`)} · {s.addressLine}
        {s.area ? `, ${name(s.area)}` : ""}
      </p>
      <p className="mt-1 text-sm">
        {t("verifiedShop")} · <RatingLine avg={s.ratingAvg} count={s.ratingCount} className="text-muted" />
      </p>
      <ShareButton url={`${publicEnv().WEB_URL}/shop/s/${encodeURIComponent(slug)}`} title={s.name} className="mt-3" testId="shop-share" />
      {s.about ? <p className="mt-4 max-w-3xl whitespace-pre-line">{s.about}</p> : null}
      <h2 className="mt-8 text-2xl font-extrabold">{t("shopProducts", { n: s.total })}</h2>
      {items.length ? (
        <ul className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {items.map((c) => (
            <ProductCard key={c.id} card={c} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-muted">{t("shopEmpty")}</p>
      )}
      {q.hasNextPage ? (
        <button type="button" disabled={q.isFetchingNextPage} className="mt-6 min-h-12 border-2 border-line px-5 font-bold disabled:opacity-50" onClick={() => void q.fetchNextPage()}>
          {t("more")}
        </button>
      ) : null}
      {/* M12, M17-FR-35: what buyers said about the shop, with the seller's replies. */}
      <SubjectReviews subjectType="shop" subjectId={s.id} testId="shop-reviews" action={<ReportButton subjectType="shop" subjectId={s.id} label={t("reportShop")} />} />
    </section>
  );
}

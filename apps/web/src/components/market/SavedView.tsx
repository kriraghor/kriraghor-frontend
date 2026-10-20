"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { useAuth } from "@kriraghor/ui/auth";
import { market } from "@/lib/market";
import { ProductCard } from "./ProductCard";

/** /shop/saved (FR-33): saved items with price-drop, out-of-stock and unavailable badges. */
export function SavedView() {
  const t = useTranslations("market");
  const { status } = useAuth();
  const q = useQuery({ queryKey: ["saved"], queryFn: () => market.saved(), enabled: status === "signed_in" });
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-10">
      <Link href="/shop" className="text-sm font-semibold text-brand underline">
        ← {t("title")}
      </Link>
      <h1 className="mt-4 text-4xl font-extrabold">{t("savedTitle")}</h1>
      {status === "signed_out" ? (
        <p className="mt-4">
          <Link href="/sign-in" className="font-semibold text-brand underline">
            {t("signInToSave")}
          </Link>
        </p>
      ) : q.isPending ? (
        <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-72 animate-pulse bg-surface-2" />
          ))}
        </ul>
      ) : q.isError ? (
        <p className="mt-6 text-danger">{t("error")}</p>
      ) : !q.data.items.length ? (
        <div className="mt-6 border-2 border-dashed border-line p-10 text-center" data-testid="saved-empty">
          <p className="text-lg font-bold">{t("savedEmpty")}</p>
          <Link href="/shop" className="mt-3 inline-block font-semibold text-brand underline">
            {t("browse")}
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">{t("savedCount", { n: q.data.items.length, max: q.data.max })}</p>
          <ul className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4" data-testid="saved-cards">
            {q.data.items.map((i) =>
              i.item ? (
                <ProductCard key={i.itemId} card={i.item} badges={i.badges} />
              ) : (
                <li key={i.itemId} className="border-2 border-dashed border-line p-4 text-sm text-muted">
                  {t("badge.unavailable")}
                </li>
              )
            )}
          </ul>
        </>
      )}
    </section>
  );
}

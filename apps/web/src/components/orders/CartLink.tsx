"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { useAuth } from "@kriraghor/ui/auth";
import { orders } from "@/lib/orders";

/** The header's cart link with the item count (signed-in members only). */
export function CartLink() {
  const t = useTranslations("orders");
  const { status } = useAuth();
  const cart = useQuery({ queryKey: ["cart"], queryFn: () => orders.cart(), enabled: status === "signed_in", staleTime: 30_000 });
  if (status !== "signed_in") return null;
  const n = cart.data?.count ?? 0;
  return (
    <Link href="/shop/cart" className="inline-flex min-h-11 items-center gap-2 border border-line px-3 text-sm font-semibold" data-testid="cart-link" aria-label={t("cartCount", { n })}>
      {t("cart")}
      {n > 0 ? (
        <span className="min-w-6 bg-brand px-1.5 text-center text-xs font-bold text-white" data-testid="cart-count">
          {n}
        </span>
      ) : null}
    </Link>
  );
}

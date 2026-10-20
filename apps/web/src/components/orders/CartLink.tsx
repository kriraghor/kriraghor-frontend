"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ShoppingCart } from "@phosphor-icons/react";
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
    <Link href="/shop/cart" className="relative inline-flex size-11 items-center justify-center rounded-control text-ink no-underline transition-colors hover:bg-surface-2" data-testid="cart-link" aria-label={t("cartCount", { n })}>
      <ShoppingCart size={22} aria-hidden />
      {n > 0 ? (
        <span className="absolute right-0.5 top-0.5 min-w-5 rounded-pill bg-brand px-1 text-center text-[11px] font-bold leading-5 text-on-brand tabular-nums ring-2 ring-surface" data-testid="cart-count">
          {n}
        </span>
      ) : null}
    </Link>
  );
}

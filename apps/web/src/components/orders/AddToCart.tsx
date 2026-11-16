"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { orders } from "@/lib/orders";

const ERRORS: Record<string, string> = { OWN_ITEM: "ownItem", INSUFFICIENT_STOCK: "noStock", ITEM_UNAVAILABLE: "unavailable", QTY_LIMIT: "qtyLimit" };

/** The product page's buy button (M13 FR-01): adds the chosen size and quantity to the cart. */
export function AddToCart({ variantId, qty, open }: { variantId: string | null; qty: number; open: boolean }) {
  const t = useTranslations("orders");
  const { status } = useAuth();
  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: () => orders.setQty(variantId!, qty),
    onSuccess: (cart) => qc.setQueryData(["cart"], cart),
  });
  if (status === "signed_out")
    return (
      <Link href="/sign-in" className="inline-flex min-h-12 flex-1 items-center justify-center bg-brand px-5 font-bold text-on-brand" data-testid="add-to-cart-sign-in">
        {t("signInToBuy")}
      </Link>
    );
  const code = add.error ? problemOf(add.error)?.code : null;
  return (
    <div className="flex flex-1 flex-col gap-2">
      <button
        type="button"
        disabled={!open || !variantId || add.isPending}
        onClick={() => add.mutate()}
        className="min-h-12 bg-brand px-5 font-bold text-on-brand hover:bg-brand-hover disabled:opacity-60"
        data-testid="add-to-cart"
      >
        {add.isPending ? t("adding") : t("addToCart")}
      </button>
      {add.isSuccess ? (
        <p role="status" className="text-sm font-semibold" data-testid="added">
          {t("added")}{" "}
          <Link href="/shop/cart" className="text-brand underline">
            {t("viewCart")}
          </Link>
        </p>
      ) : null}
      {code ? (
        <p role="alert" className="text-sm text-danger">
          {t(ERRORS[code] ?? "failed")}
        </p>
      ) : null}
    </div>
  );
}

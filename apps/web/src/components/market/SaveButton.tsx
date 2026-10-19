"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { problemOf } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { market } from "@/lib/market";

/** Save or unsave a product (FR-33). Signed-out visitors are asked to sign in. */
export function SaveButton({ productId }: { productId: string }) {
  const t = useTranslations("market");
  const { status } = useAuth();
  const qc = useQueryClient();
  const saved = useQuery({ queryKey: ["saved"], queryFn: () => market.saved(), enabled: status === "signed_in" });
  const isSaved = Boolean(saved.data?.items.some((i) => i.itemId === productId));
  const toggle = useMutation({
    mutationFn: () => (isSaved ? market.unsave(productId) : market.save(productId)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved"] }),
  });
  const code = toggle.error ? problemOf(toggle.error)?.code : null;
  if (status !== "signed_in")
    return (
      <p className="text-sm">
        <Link href="/sign-in" className="font-semibold text-brand underline">
          {t("signInToSave")}
        </Link>
      </p>
    );
  return (
    <div>
      <button type="button" aria-pressed={isSaved} disabled={toggle.isPending || saved.isPending} onClick={() => toggle.mutate()} className="min-h-11 border-2 border-line px-4 font-bold hover:border-brand disabled:opacity-50" data-testid="save-button">
        {isSaved ? t("saved") : t("save")}
      </button>
      {code ? (
        <p role="alert" className="mt-1 text-sm text-danger">
          {code === "OWN_ITEM" ? t("ownItem") : code === "SAVED_LIMIT" ? t("savedLimit") : t("error")}
        </p>
      ) : null}
    </div>
  );
}

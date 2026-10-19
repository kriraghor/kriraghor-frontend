"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { diffLines, groundsAdmin, type ReviewDiff } from "@/lib/admin/grounds";
import { formatTaka } from "@/lib/admin/finance";
import { Notice } from "../../ui";

/**
 * The `ground` panel on the Moderation desk (M09): what changed (the diff in the submission), then the
 * working copy the reviewer is approving: photos, courts with sports and hours, area, address and pin,
 * facilities and the price rules. Checks, rubric and the decision are the desk's (M05).
 */
export function GroundPanel({ payload }: { payload: Record<string, unknown> }) {
  const t = useTranslations("groundsAdmin");
  const locale = useLocale();
  const id = String(payload.groundId);
  const q = useQuery({ queryKey: ["admin-ground", id], queryFn: () => groundsAdmin.get(id) });
  if (q.isPending) return <div className="mt-4 h-40 animate-pulse bg-surface-2" />;
  if (q.isError || !q.data) return <Notice tone="error">{t("loadFailed")}</Notice>;
  const g = q.data;
  const lines = diffLines(payload.diff as ReviewDiff | undefined, (k, v) => t(k, v));
  const days = t.raw("days") as string[];
  return (
    <div className="mt-6 space-y-5 border-t-2 border-line pt-4" data-testid="ground-panel">
      <div>
        <h3 className="font-bold">{payload.isEdit ? t("whatChanged") : t("firstReview")}</h3>
        <ul className="mt-1 list-disc pl-5 text-sm">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">{t("owner")}</dt>
        <dd className="font-semibold">{g.owner.displayName ?? "–"}</dd>
        <dt className="text-muted">{t("address")}</dt>
        <dd>{g.addressLine}</dd>
        <dt className="text-muted">{t("pin")}</dt>
        <dd>
          <a className="text-brand underline" href={`https://www.openstreetmap.org/?mlat=${g.lat}&mlon=${g.lng}#map=17/${g.lat}/${g.lng}`} target="_blank" rel="noreferrer">
            {g.lat}, {g.lng}
          </a>
        </dd>
        <dt className="text-muted">{t("indoor")}</dt>
        <dd>{g.isIndoor ? t("yes") : t("no")}</dd>
        {g.rules ? (
          <>
            <dt className="text-muted">{t("price")}</dt>
            <dd>{t("priceLine", { base: formatTaka(g.rules.basePricePoisha, locale), peak: g.rules.peakPct, weekend: g.rules.weekendPct, advance: g.rules.advancePct })}</dd>
          </>
        ) : null}
      </dl>
      <div className="grid grid-cols-3 gap-2">
        {g.photos.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} src={p.url} alt={t("photoN", { n: i + 1 })} className="aspect-[4/3] w-full border-2 border-line object-cover" />
        ))}
      </div>
      <ul className="space-y-2 text-sm">
        {g.courts.map((c) => (
          <li key={c.id} className="border-2 border-line p-2">
            <p className="font-semibold">
              {c.name} <span className="font-normal text-muted">({t(`courtStatus.${c.status}`)})</span>
            </p>
            <p className="text-muted">
              {c.sizeText ?? ""} {c.capacityText ? `· ${c.capacityText}` : ""}
            </p>
            <p className="text-xs">
              {c.hours.map((h) => `${days[h.dow]} ${h.isClosed ? t("closed") : `${h.openTime}–${h.closeTime}`}`).join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

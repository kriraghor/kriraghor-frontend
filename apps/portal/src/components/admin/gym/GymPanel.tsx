"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { formatTaka } from "@/lib/admin/finance";
import { gymAdmin } from "@/lib/admin/gym";
import { Notice } from "@kriraghor/ui/primitives";

type Diff = Record<string, { from: unknown; to: unknown }>;
const WEEK = [6, 0, 1, 2, 3, 4, 5];

/**
 * The `gym` panel on the Moderation desk (M20): what changed since the live version, then the working
 * copy the reviewer approves: name, address and about, photos, the week's hours (women-only windows
 * marked) and the packages against the day-pass limits. Checks, rubric and decision are the desk's (M05).
 */
export function GymPanel({ payload }: { payload: Record<string, unknown> }) {
  const t = useTranslations("gymAdmin");
  const locale = useLocale();
  const id = String(payload.gymId);
  const q = useQuery({ queryKey: ["admin-gym", id], queryFn: () => gymAdmin.gym(id) });
  if (q.isPending) return <div className="rounded-card mt-4 h-40 kg-shimmer bg-surface-2" />;
  if (q.isError || !q.data) return <Notice tone="error">{t("failed")}</Notice>;
  const g = q.data;
  const money = (n: number) => formatTaka(n, locale);
  const days = t.raw("days") as string[];
  const diff = Object.entries((payload.diff ?? {}) as Diff);
  return (
    <div className="mt-6 space-y-4 border-t-2 border-line pt-4" data-testid="gym-panel">
      <div>
        <h3 className="font-bold">{payload.isEdit ? t("whatChanged") : t("firstReview")}</h3>
        {payload.isEdit && diff.length ? (
          <ul className="mt-1 list-disc pl-5 text-sm">
            {diff.map(([field, d]) => (
              <li key={field}>{t("diffField", { field, from: JSON.stringify(d.from ?? "–").slice(0, 160), to: JSON.stringify(d.to ?? "–").slice(0, 160) })}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">{t("name")}</dt>
        <dd className="font-semibold">{g.name}</dd>
        <dt className="text-muted">{t("address")}</dt>
        <dd>{g.addressLine}</dd>
        <dt className="text-muted">{t("about")}</dt>
        <dd className="whitespace-pre-line">{g.about ?? "–"}</dd>
      </dl>
      {g.photos.length ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {g.photos.map((p, i) => (
            <li key={p.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={t("photoN", { n: i + 1 })} className="aspect-[4/3] w-full object-cover" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-danger">{t("noPhotos")}</p>
      )}
      <div>
        <h3 className="font-bold">{t("hours")}</h3>
        <table className="mt-1 text-sm">
          <tbody>
            {WEEK.map((dow) => {
              const ws = g.hours.filter((h) => h.dow === dow).sort((a, b) => a.openTime.localeCompare(b.openTime));
              return (
                <tr key={dow}>
                  <th scope="row" className="py-0.5 pr-4 text-left font-semibold">
                    {days[dow]}
                  </th>
                  <td>{ws.length ? ws.map((w) => `${w.openTime}–${w.closeTime}${w.womenOnly ? ` (${t("womenOnly")})` : ""}`).join(", ") : t("closed")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div>
        <h3 className="font-bold">{t("packages")}</h3>
        <ul className="mt-1 text-sm" data-testid="gym-panel-packages">
          {g.packages.map((p) => (
            <li key={p.id}>
              {t(`kind.${p.kind}`)} · {p.title} · {money(p.price)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

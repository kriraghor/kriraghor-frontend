"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { dayLabel } from "@/lib/bookings";
import { gym, passTone, TONE } from "@/lib/gym";
import { formatTaka } from "@/lib/payments";
import { MePanel } from "../MePanel";
import { Notice } from "../ui";

const GROUPS = ["active", "used", "expired"] as const;
type Group = (typeof GROUPS)[number];

/** /me/passes (M20 §5): my gym passes in three groups. A pass opens its QR and backup code. */
export function MyPasses() {
  const t = useTranslations("gym");
  const locale = useLocale();
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const group: Group = GROUPS.includes(params.get("show") as Group) ? (params.get("show") as Group) : "active";
  const q = useQuery({ queryKey: ["my-passes", group], queryFn: () => gym.myPasses(group), enabled: status === "signed_in" });

  if (status === "signed_out") return <MePanel />;
  return (
    <section className="mx-auto max-w-[1100px] px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold">{t("myPasses")}</h1>
        <Link href="/gym?tab=gyms" className="min-h-11 border-2 border-line px-4 py-2 font-bold hover:border-brand">
          {t("findGym")}
        </Link>
      </div>
      <div className="mt-6 flex gap-1 border-b-2 border-line" role="tablist">
        {GROUPS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={group === k} onClick={() => router.replace(`${pathname}?show=${k}`, { scroll: false })} className={`-mb-0.5 min-h-12 border-b-4 px-4 font-bold ${group === k ? "border-brand" : "border-transparent text-muted hover:text-ink"}`}>
            {t(`group.${k}`)}
          </button>
        ))}
      </div>
      {q.isPending ? (
        <div className="mt-6 h-40 animate-pulse bg-surface-2" />
      ) : q.isError ? (
        <div className="mt-6">
          <Notice tone="error">{t("error")}</Notice>
        </div>
      ) : !q.data.items.length ? (
        <p className="mt-6 border-2 border-dashed border-line p-8 text-center font-semibold" data-testid="my-passes-empty">
          {t(`noPasses.${group}`)}
        </p>
      ) : (
        <ul className="mt-6 divide-y-2 divide-line border-y-2 border-line" data-testid="my-passes">
          {q.data.items.map((p) => (
            <li key={p.id}>
              <Link href={`/me/passes/${p.code}`} className="flex flex-wrap items-center gap-3 py-3 hover:bg-surface-2" data-testid="my-pass">
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">
                    {p.gym?.name ?? "–"} · {t(`kind.${p.kind}`)}
                  </span>
                  <span className="block text-sm text-muted">
                    {p.code} · {p.validFrom === p.validTo ? dayLabel(p.validFrom, locale) : `${dayLabel(p.validFrom, locale)} – ${dayLabel(p.validTo, locale)}`}
                  </span>
                </span>
                <span className="font-bold tabular-nums">{formatTaka(p.money.price, locale)}</span>
                <span className={`border-2 px-2 py-0.5 text-sm font-bold ${TONE[passTone(p.status)]}`}>{t(`passStatus.${p.status}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

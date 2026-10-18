"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import { esports, type TournamentCard } from "@/lib/esports";
import { Card, Empty } from "./bits";

/**
 * An organiser's branded page (M22-FR-11, FR-12): /o/{sub}, and the home page of {sub}.esports.
 * The organiser's logo, colours and tagline frame its tournaments; registration, payment, the room
 * and winnings are Kriraghor's (the money is in Kriraghor escrow).
 */
export function OrganiserPage({ sub }: { sub: string }) {
  const t = useTranslations("esports.organiser");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["es-organiser", sub], queryFn: () => esports.organiser(sub), retry: false });
  if (q.isPending)
    return (
      <section className="mx-auto max-w-[1320px] px-5 py-10">
        <div className="h-40 animate-pulse bg-surface-2" />
      </section>
    );
  if (q.isError || !q.data)
    return (
      <section className="mx-auto max-w-[1320px] px-5 py-16">
        <h1 className="text-2xl font-extrabold">{t("notFound")}</h1>
      </section>
    );
  const o = q.data.organiser;
  const items = q.data.tournaments as TournamentCard[];
  const live = items.filter((i) => !["finalised", "paid_out", "cancelled"].includes(i.status));
  const past = items.filter((i) => ["finalised", "paid_out"].includes(i.status));
  const style = { "--org-primary": o.primaryHex, "--org-accent": o.accentHex } as CSSProperties;
  const tagline = locale === "bn" ? (o.taglineBn ?? o.taglineEn) : (o.taglineEn ?? o.taglineBn);
  return (
    <div style={style} data-testid="organiser-page">
      <header className="border-b-4 border-[var(--org-accent)] bg-[var(--org-primary)] text-white">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-5 px-5 py-10">
          {o.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={o.logoUrl} alt="" className="h-20 w-20 shrink-0 bg-white object-contain p-1" />
          ) : null}
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--org-accent)]">{t("kicker")}</p>
            <h1 className="text-4xl font-extrabold md:text-5xl" data-testid="organiser-name">
              {o.name}
            </h1>
            {tagline ? <p className="mt-2 max-w-2xl text-white/90">{tagline}</p> : null}
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-[1320px] px-5 py-10">
        <h2 className="text-2xl font-extrabold">{t("upcoming")}</h2>
        {live.length ? (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="organiser-tournaments">
            {live.map((i) => (
              <li key={i.id}>
                <Card t={i} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4">
            <Empty title={t("none")} />
          </div>
        )}
        {past.length ? (
          <>
            <h2 className="mt-10 text-2xl font-extrabold">{t("past")}</h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {past.map((i) => (
                <li key={i.id}>
                  <Card t={i} />
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <p className="mt-10 max-w-3xl text-sm text-muted">{t("note", { name: o.name })}</p>
      </section>
    </div>
  );
}


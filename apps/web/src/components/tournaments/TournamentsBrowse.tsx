"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { teams as teamsApi, teamSports } from "@/lib/teams";
import { tournaments, type Status } from "@/lib/tournaments";
import { Notice } from "../ui";
import { TournamentCard } from "./TournamentCard";
import { PageHeader } from "../PageHeader";

const STATUSES: Status[] = ["open", "live", "completed"];

/** /tournaments (M14 §4.7): discover by sport and status, with a search; filters live in the URL. */
export function TournamentsBrowse() {
  const t = useTranslations("tournaments");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const sport = params.get("sport") ?? "";
  const status = (STATUSES.includes(params.get("status") as Status) ? params.get("status") : "open") as Status;
  const [text, setText] = useState(params.get("q") ?? "");
  const sports = useQuery({ queryKey: ["catalog-sports"], queryFn: teamsApi.sports, staleTime: 3600_000 });
  const q = useQuery({ queryKey: ["tournaments", sport, status, params.get("q") ?? ""], queryFn: () => tournaments.list({ sport: sport || undefined, status, q: params.get("q") || undefined }) });
  const go = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <section className="mx-auto max-w-[1320px] px-5 py-10">
      <PageHeader photo="tournaments">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">{t("kicker")}</p>
        <h1 className="mt-2 text-4xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-muted">{t("lead")}</p>
      </PageHeader>

      <div className="mt-6 flex gap-1 border-b-2 border-line" role="tablist">
        {STATUSES.map((s) => (
          <button key={s} type="button" role="tab" aria-selected={status === s} onClick={() => go({ status: s })} className={`-mb-0.5 min-h-12 border-b-4 px-4 font-bold ${status === s ? "border-brand" : "border-transparent text-muted hover:text-ink"}`}>
            {t(`tab.${s}`)}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={!sport} onClick={() => go({ sport: "" })} className={`min-h-11 border-2 px-3 text-sm font-bold ${!sport ? "border-brand bg-brand text-white" : "border-line hover:border-brand"}`}>
          {t("allSports")}
        </button>
        {teamSports(sports.data ?? []).map((s) => (
          <button key={s.key} type="button" aria-pressed={sport === s.key} onClick={() => go({ sport: s.key })} className={`min-h-11 border-2 px-3 text-sm font-bold ${sport === s.key ? "border-brand bg-brand text-white" : "border-line hover:border-brand"}`}>
            {locale === "bn" ? s.nameBn : s.nameEn}
          </button>
        ))}
        <form
          className="ml-auto flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: text.trim() });
          }}
        >
          <label htmlFor="tournament-search" className="sr-only">
            {t("search")}
          </label>
          <input id="tournament-search" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("search")} className="min-h-11 field px-3" />
        </form>
      </div>

      {q.isError ? (
        <div className="mt-6">
          <Notice tone="error">{t("failed")}</Notice>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="tournament-list">
          {q.isPending ? [0, 1, 2].map((i) => <li key={i} className="h-48 animate-pulse bg-surface-2" />) : q.data.items.map((x) => <li key={x.id}><TournamentCard t={x} /></li>)}
          {!q.isPending && !q.data.items.length ? <li className="border-2 border-dashed border-line p-8 text-center font-semibold sm:col-span-2 lg:col-span-3">{t(`none.${status}`)}</li> : null}
        </ul>
      )}
    </section>
  );
}

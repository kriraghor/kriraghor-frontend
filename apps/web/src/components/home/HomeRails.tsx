"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowRight, GameController, SoccerBall, Storefront, Trophy } from "@phosphor-icons/react";
import { esportsHref } from "@/lib/links";
import { sectionUrl, type SectionKey } from "@/lib/home";
import { HomeSection, type RailState } from "./HomeSection";
import { GymSection, HireSection } from "./HomeTickers";
import { EsportsTile, EventTile, ProductTile, ShowcaseTile, VenueTile } from "./SectionCards";
import { useFeaturedEvents, useOpenEsports } from "./queries";
import { RAIL_MAX, sectionItems, type SectionItems } from "./section-data";

const li = (key: string, node: ReactNode) => (
  <li key={key} className="w-[280px] shrink-0 snap-start">
    {node}
  </li>
);

const stateOf = (q: { isPending: boolean; isError: boolean }, count: number): RailState => (q.isPending ? "loading" : count ? "ready" : q.isError ? "error" : "empty");

/** Esports first (priority 1): a featured Showcase as the first card, then events open for registration. */
function EsportsRail() {
  const t = useTranslations("home.sections.esports");
  const open = useOpenEsports();
  const showcases = useFeaturedEvents();
  const events = (open.data?.items ?? []).slice(0, RAIL_MAX);
  const showcase = showcases.data?.items[0];
  return (
    <HomeSection
      section="esports"
      icon={<GameController size={26} aria-hidden />}
      allHref={sectionUrl("esports")}
      extra={
        <a href={esportsHref("/leaderboards")} className="inline-flex min-h-11 items-center gap-1 font-bold underline-offset-4 hover:underline" data-testid="home-top-players">
          {t("top")} <ArrowRight size={16} aria-hidden />
        </a>
      }
      state={stateOf(open, events.length + (showcase ? 1 : 0))}
    >
      {showcase ? li(showcase.id, <ShowcaseTile item={showcase} />) : null}
      {events.map((e) => li(e.id, <EsportsTile item={e} />))}
    </HomeSection>
  );
}

/** A rail fed by the section's public list. */
function ListRail<K extends SectionKey>({ section, icon, render }: { section: K; icon: ReactNode; render: (item: SectionItems[K]) => ReactNode }) {
  const q = useQuery({ queryKey: ["home-rail", section], queryFn: () => sectionItems[section]() as Promise<SectionItems[K][]> });
  const list = (q.data ?? []).slice(0, RAIL_MAX);
  return (
    <HomeSection section={section} icon={icon} allHref={sectionUrl(section)} state={stateOf(q, list.length)}>
      {list.map((item) => li((item as { id: string }).id, render(item)))}
    </HomeSection>
  );
}

/** The design's six sections, in its order; each shows real listings and searches its own list page. Hire and Gym keep their flip and turn lists. */
export function HomeRails() {
  return (
    <>
      <EsportsRail />
      <GymSection />
      <ListRail section="venues" icon={<SoccerBall size={26} aria-hidden />} render={(x) => <VenueTile item={x} />} />
      <ListRail section="shop" icon={<Storefront size={26} aria-hidden />} render={(x) => <ProductTile item={x} />} />
      <HireSection />
      <ListRail section="events" icon={<Trophy size={26} aria-hidden />} render={(x) => <EventTile item={x} />} />
    </>
  );
}

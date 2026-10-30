"use client";

import { useTranslations } from "next-intl";
import { ArrowUpRight, ClipboardText, House, IdentificationBadge, QrCode, Repeat, Sword, Ticket, Trophy, Wallet, type Icon } from "@phosphor-icons/react";
import { MePanel } from "../MePanel";
import { useAuth } from "@kriraghor/ui/auth";
import { esportsHref, gymHref } from "@/lib/links";

type Card = { key: string; href: string; icon: Icon; title: string; body: string; testId?: string };

/**
 * A section whose pages live on another Kriraghor site (Esports, Gym): one line about it and a large
 * card for each page, so the rail item never lands on another domain without warning. Signed out it
 * is the /me sign-in prompt, like the other /me pages.
 */
function SectionLanding({ title, lead, site, cards, testId }: { title: string; lead: string; site: string; cards: Card[]; testId: string }) {
  const t = useTranslations("account.landing");
  const { status } = useAuth();
  if (status === "signed_out") return <MePanel />;
  return (
    <section className="flex flex-col gap-6 px-4 py-6 md:px-0 md:py-8" data-testid={testId}>
      <div>
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-[60ch] text-muted">{lead}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => {
          const CIcon = c.icon;
          return (
            <li key={c.key}>
              <a
                href={c.href}
                className="surface-card group flex min-h-28 items-start gap-4 p-5 no-underline transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-kg)] hover:-translate-y-0.5 hover:border-brand hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                aria-label={`${c.title}. ${c.body} ${t("opens", { site })}`}
                data-testid={c.testId ?? `landing-${c.key}`}
              >
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-text" aria-hidden>
                  <CIcon size={22} weight="fill" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-display text-lg font-bold text-ink">
                    {c.title}
                    <ArrowUpRight size={16} weight="bold" aria-hidden className="shrink-0 text-muted transition-colors group-hover:text-brand-text" />
                  </span>
                  <span className="mt-1 block text-sm text-muted">{c.body}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted">{t("opens", { site })}</p>
    </section>
  );
}

/** kriraghor.com/me/esports: the way into matches, winnings and game IDs on esports.kriraghor.com. */
export function EsportsLanding() {
  const t = useTranslations("account");
  return (
    <SectionLanding
      testId="esports-landing"
      title={t("sections.esports")}
      lead={t("landing.esports.lead")}
      site="esports.kriraghor.com"
      cards={[
        { key: "matches", href: esportsHref("/me/matches"), icon: Sword, title: t("tabs.matches"), body: t("landing.esports.matches") },
        { key: "winnings", href: esportsHref("/me/winnings"), icon: Wallet, title: t("tabs.winnings"), body: t("landing.esports.winnings") },
        { key: "game-ids", href: esportsHref("/me/esports"), icon: IdentificationBadge, title: t("tabs.gameIds"), body: t("landing.esports.gameIds") },
        { key: "esports-home", href: esportsHref(), icon: Trophy, title: t("tabs.esportsHome"), body: t("landing.esports.home") },
      ]}
    />
  );
}

/** kriraghor.com/me/gym: the way into gyms, passes, plans and check-in on gym.kriraghor.com. */
export function GymLanding() {
  const t = useTranslations("account");
  return (
    <SectionLanding
      testId="gym-landing"
      title={t("sections.gym")}
      lead={t("landing.gym.lead")}
      site="gym.kriraghor.com"
      cards={[
        { key: "my-gyms", href: gymHref("/me"), icon: House, title: t("tabs.myGyms"), body: t("landing.gym.myGyms") },
        { key: "passes", href: gymHref("/me/passes"), icon: Ticket, title: t("tabs.passes"), body: t("landing.gym.passes") },
        { key: "plans", href: gymHref("/me/plans"), icon: ClipboardText, title: t("tabs.plans"), body: t("landing.gym.plans") },
        { key: "checkin", href: gymHref("/me/checkin"), icon: QrCode, title: t("tabs.checkin"), body: t("landing.gym.checkin") },
        { key: "trainer-plans", href: gymHref("/me/subscriptions"), icon: Repeat, title: t("tabs.trainerPlans"), body: t("landing.gym.trainerPlans") },
      ]}
    />
  );
}

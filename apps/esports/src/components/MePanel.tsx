"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, GameController, Plus, Sword, Trophy } from "@phosphor-icons/react";
import { api } from "@kriraghor/api-client";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Badge, ButtonLink, Card, EmptyState, ErrorState, Skeleton, type Tone } from "@kriraghor/ui/kit";
import { AccountHeader, DashboardSkeleton, SignedOutCard, WinningsCard, useMe } from "@kriraghor/ui/account";
import { taka } from "@/lib/esports";

const UID_TONE: Record<string, Tone> = { verified: "brand", pending: "warning", rejected: "danger", banned: "danger", unlinked: "neutral" };

/**
 * The esports account overview (design plan Part D): who you are, winnings, your game IDs and the
 * way to your matches. The same account as kriraghor.com (SSO); `children` is the live-connection
 * status the room reveal depends on.
 */
export function MePanel({ children, signInHref = "/sign-in" }: { children?: ReactNode; signInHref?: string }) {
  const locale = useLocale();
  const t = useTranslations("account");
  const { status, me } = useMe();

  if (status === "signed_out") return <SignedOutCard signInHref={signInHref} />;
  if (status === "loading" || me.isPending) return <DashboardSkeleton />;
  if (me.isError || !me.data) {
    return (
      <section className="px-5 py-10 md:px-0">
        <ErrorState onRetry={() => void me.refetch()} />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6 px-4 py-6 md:px-0 md:py-8" data-testid="me-dashboard">
      <AccountHeader user={me.data} />
      <div className="flex flex-col gap-4 lg:flex-row lg:[&>*]:min-w-0 lg:[&>*]:flex-[1_1_0%]">
        <GameIds />
        <WinningsCard withdrawHref="/me/winnings" format={(p) => taka(p, locale)} />
      </div>
      <Link href="/me/matches" className="group flex min-h-20 items-center gap-4 rounded-card border border-line bg-surface p-5 no-underline shadow-sm transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md">
        <span className="flex size-12 items-center justify-center rounded-pill bg-brand-soft text-brand-text">
          <Sword size={24} aria-hidden />
        </span>
        <span className="flex-1 font-display text-lg font-semibold">{t("items.matches")}</span>
        <ArrowRight size={20} aria-hidden className="text-muted transition-transform group-hover:translate-x-0.5" />
      </Link>
      {children}
    </section>
  );
}

/** My game UIDs with their review status; the way to add one when there is none. */
function GameIds() {
  const t = useTranslations("esports");
  const ta = useTranslations("account");
  const q = useQuery({
    queryKey: ["esports-profiles"],
    queryFn: async () => {
      const { data, error } = await api().GET("/me/esports/profiles");
      if (error) throw error;
      return data.items;
    },
  });
  if (q.isPending) return <Skeleton className="h-40 rounded-card" />;
  const items = (q.data ?? []).filter((p) => p.status !== "unlinked");
  if (!items.length) {
    return (
      <EmptyState
        icon={<GameController />}
        title={t("me.noUids")}
        body={t("me.lead")}
        action={
          <ButtonLink href="/me/esports" icon={<Plus size={18} aria-hidden />}>
            {t("me.addUid")}
          </ButtonLink>
        }
      />
    );
  }
  return (
    <Card className="flex flex-col gap-3" data-testid="game-ids">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl">{ta("items.gameIds")}</h2>
        <Trophy size={22} aria-hidden className="text-muted" />
      </div>
      <ul className="-mx-2 flex flex-col">
        {items.map((p) => (
          <li key={p.id}>
            <Link href="/me/esports" className="flex min-h-12 items-center gap-3 rounded-control px-2 no-underline hover:bg-surface-2">
              <GameController size={22} aria-hidden className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.ign}</span>
                <span className="block font-mono text-sm text-muted">{p.uidMasked}</span>
              </span>
              <Badge tone={UID_TONE[p.status] ?? "neutral"}>{t.has(`uidStatus.${p.status}`) ? t(`uidStatus.${p.status}`) : p.status}</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

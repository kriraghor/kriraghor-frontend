"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { SignIn, UserPlus, Wallet } from "@phosphor-icons/react";
import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { useAuth } from "../auth";
import { Avatar, Badge, Card, EmptyState, Skeleton, type Tone } from "../kit/Display";
import { ButtonLink } from "../kit/Button";

/**
 * Pieces of the account overview shared by kriraghor.com and esports (design plan Part D): the
 * signed-in user, the header, the signed-out card, winnings, the loading skeleton.
 */

export type Me = components["schemas"]["Me"];

/** GET /me for the signed-in user (one cache entry, "me", shared by the shell and the pages). */
export function useMe() {
  const { status } = useAuth();
  const me = useQuery({
    queryKey: ["me"],
    enabled: status === "signed_in",
    queryFn: async () => {
      const { data, error } = await api().GET("/me");
      if (error) throw error;
      return data;
    },
  });
  return { status, me };
}

const ROLE_TONE: Record<string, Tone> = { active: "brand", rejected: "danger", suspended: "danger", withdrawn: "neutral" };

function greetingKey(now = new Date()) {
  // Dhaka time: the platform's business day.
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Dhaka" }).format(now));
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}

/** Avatar, greeting, name (me-name), roles as translated badges; the id stays in the page for tests (me-id). */
export function AccountHeader({ user }: { user: Me }) {
  const t = useTranslations("account");
  return (
    <header className="flex flex-wrap items-center gap-4">
      <Avatar name={user.displayName} size={60} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-muted">{t(`greeting.${greetingKey()}`)}</p>
        <h1 className="truncate text-3xl sm:text-4xl" data-testid="me-name">
          {user.displayName}
        </h1>
        <span hidden data-testid="me-id">
          {user.id}
        </span>
        {user.roles.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {user.roles.map((r) => (
              <Badge key={r.role} tone={ROLE_TONE[r.status] ?? "warning"}>
                {t(`roles.${r.role}`)}
                {r.status !== "active" ? ` · ${t(`roleStatus.${r.status}`)}` : ""}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}

/** The account pages when signed out: what lives here, sign in or create an account. */
export function SignedOutCard({ signInHref = "/sign-in", signUpHref = "/signup" }: { signInHref?: string; signUpHref?: string }) {
  const t = useTranslations("account");
  const tn = useTranslations("nav");
  const ta = useTranslations("auth");
  return (
    <section className="mx-auto max-w-form px-5 py-12" data-testid="signed-out">
      <EmptyState
        icon={<SignIn />}
        title={t("signedOutTitle")}
        body={t("signedOutBody")}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href={signInHref}>{tn("signIn")}</ButtonLink>
            <ButtonLink href={signUpHref} variant="secondary" icon={<UserPlus size={18} aria-hidden />}>
              {ta("createAccount")}
            </ButtonLink>
          </div>
        }
      />
    </section>
  );
}

/** Prize money waiting (amber, the prize colour), from M21 winnings; hidden until something was won. */
export function WinningsCard({ withdrawHref, format }: { withdrawHref: string; format: (poisha: number) => string }) {
  const t = useTranslations("account.stats");
  const q = useQuery({
    queryKey: ["esports-winnings"],
    queryFn: async () => {
      const { data, error } = await api().GET("/me/esports/winnings");
      if (error) throw error;
      return data;
    },
  });
  if (q.isPending) return <Skeleton className="h-40 rounded-card" />;
  if (!q.data || q.data.totalWon.amount === 0) return null;
  return (
    <Card className="flex flex-col justify-between gap-4 border-prize/40 bg-gradient-to-br from-prize-soft to-surface" data-testid="winnings-card">
      <div className="flex items-center justify-between text-sm font-semibold text-prize-text">
        <span>{t("winnings")}</span>
        <Wallet size={22} aria-hidden />
      </div>
      <p className="font-display text-4xl font-bold tabular text-prize-text">{format(q.data.available.amount)}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted">{t("totalWon", { amount: format(q.data.totalWon.amount) })}</span>
        <ButtonLink href={withdrawHref} variant="prize" size="sm">
          {t("withdraw")}
        </ButtonLink>
      </div>
    </Card>
  );
}

/** The overview's shape while /me loads. */
export function DashboardSkeleton() {
  const t = useTranslations("kit");
  return (
    <div className="flex flex-col gap-6 px-4 py-6 md:px-0 md:py-8" role="status" aria-label={t("loading")}>
      <div className="flex items-center gap-4">
        <Skeleton className="size-[60px] rounded-pill" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-64 max-w-full" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-56 rounded-card" />
        <Skeleton className="h-56 rounded-card" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-card" />
        ))}
      </div>
    </div>
  );
}

/** The user at the top of the account sidebar (just the avatar on the rail). */
export function ShellUser({ collapsed, user }: { collapsed: boolean; user?: Me }) {
  if (!user) return <Skeleton className={collapsed ? "mx-auto size-11 rounded-pill" : "h-14"} />;
  const handle = user.username ? `@${user.username}` : (user.phone ?? user.email ?? undefined);
  return (
    <div className={collapsed ? "flex justify-center" : "flex items-center gap-3 rounded-control px-2"}>
      <Avatar name={user.displayName} size={collapsed ? 40 : 44} />
      {collapsed ? null : (
        <div className="min-w-0">
          <p className="truncate font-semibold">{user.displayName}</p>
          {handle ? <p className="truncate text-sm text-muted">{handle}</p> : null}
        </div>
      )}
    </div>
  );
}

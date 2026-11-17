"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, CalendarPlus, CheckCircle, Circle, Handshake, Hourglass, ShoppingBag, Trophy } from "@phosphor-icons/react";
import { api } from "@kriraghor/api-client";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Card, ErrorState } from "@kriraghor/ui/kit";
import { AccountHeader, DashboardSkeleton, SignedOutCard, WinningsCard, useMe } from "@kriraghor/ui/account";
import { MemberOverview } from "./MemberOverview";
import { MyReliability } from "./trust/MyReliability";
import { esportsHref, isExternal } from "@/lib/links";
import { formatTaka } from "@/lib/payments";

/**
 * /me (design plan Part D): greeting, set-up checklist, winnings, quick actions, then the M19
 * member overview. Signed out it is the sign-in prompt (the /me pages render it for that). The
 * same account works on every Kriraghor site (SSO).
 */
export function MePanel({ children, signInHref = "/sign-in" }: { children?: ReactNode; signInHref?: string }) {
  const locale = useLocale();
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

  const u = me.data;
  return (
    <section className="flex flex-col gap-6 px-4 py-6 md:px-0 md:py-8" data-testid="me-dashboard">
      <AccountHeader user={u} />

      {/* Either card may be absent (all set up, nothing won): the other then takes the row. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:[&>*:first-child]:flex-[1.4_1_0%] lg:[&>*]:min-w-0 lg:[&>*]:flex-[1_1_0%]">
        <SetupChecklist phoneVerified={u.phoneVerified} emailVerified={u.emailVerified} kycVerified={u.kycStatus === "verified"} />
        <WinningsCard withdrawHref={esportsHref("/me/winnings")} format={(p) => formatTaka(p, locale)} />
      </div>

      <QuickActions />
      <MemberOverview />
      <MyReliability />
      {children}
    </section>
  );
}

type Step = { key: string; done: boolean; pending?: boolean; label: string; href: string; hint?: string };

/** Phone, email, game ID, NID: what is left, with a link for each; hidden once all are done. */
function SetupChecklist({ phoneVerified, emailVerified, kycVerified }: { phoneVerified: boolean; emailVerified: boolean; kycVerified: boolean }) {
  const t = useTranslations("account.setup");
  const profiles = useQuery({
    queryKey: ["esports-profiles"],
    queryFn: async () => {
      const { data, error } = await api().GET("/me/esports/profiles");
      if (error) throw error;
      return data.items;
    },
  });
  const ids = profiles.data ?? [];
  const idVerified = ids.some((p) => p.status === "verified");
  const idPending = !idVerified && ids.some((p) => p.status === "pending" || p.status === "pending_review");
  const steps: Step[] = [
    { key: "phone", done: phoneVerified, label: phoneVerified ? t("phoneDone") : t("phone"), href: "/me/eligibility" },
    { key: "email", done: emailVerified, label: emailVerified ? t("emailDone") : t("email"), href: "/account/settings" },
    { key: "gameId", done: idVerified, pending: idPending, label: idVerified ? t("gameIdDone") : idPending ? t("gameIdPending") : t("gameId"), href: esportsHref("/me/esports") },
    { key: "nid", done: kycVerified, label: kycVerified ? t("nidDone") : t("nid"), hint: kycVerified ? undefined : t("nidWhy"), href: "/account/verification" },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  return (
    <Card className="flex flex-col gap-4" data-testid="setup-checklist">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl">{t("title")}</h2>
        <span className="text-sm font-semibold text-muted tabular">{t("progress", { done, total: steps.length })}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-pill bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label={t("title")}>
        <div className="h-full rounded-pill bg-brand transition-[width] duration-500" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ul className="-mx-2 flex flex-col">
        {steps.map((s) => (
          <li key={s.key}>
            {s.done ? (
              <div className="flex min-h-12 items-center gap-3 px-2 text-muted">
                <CheckCircle size={22} weight="fill" className="shrink-0 text-brand" aria-hidden />
                <span className="line-through decoration-line-strong/60">{s.label}</span>
              </div>
            ) : (
              <StepLink href={s.href}>
                {s.pending ? <Hourglass size={22} className="shrink-0 text-warning" aria-hidden /> : <Circle size={22} className="shrink-0 text-line-strong" aria-hidden />}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{s.label}</span>
                  {s.hint ? <span className="block text-sm text-muted">{s.hint}</span> : null}
                </span>
                <ArrowRight size={18} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
              </StepLink>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

const STEP_CLASS = "group flex min-h-12 items-center gap-3 rounded-control px-2 py-2 no-underline transition-colors hover:bg-surface-2";
const QUICK_CLASS =
  "group flex min-h-24 flex-col justify-between gap-3 rounded-card border border-line bg-surface p-4 no-underline shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md";

/** A checklist step's link: a plain <a> for another site (/go/…), so Next never prefetches the cross-origin redirect. */
function StepLink({ href, children }: { href: string; children: ReactNode }) {
  return isExternal(href) ? (
    <a href={href} className={STEP_CLASS}>
      {children}
    </a>
  ) : (
    <Link href={href} className={STEP_CLASS}>
      {children}
    </Link>
  );
}

function QuickActions() {
  const t = useTranslations("account.quick");
  const items = [
    { href: "/venues", label: t("venues"), icon: <CalendarPlus /> },
    { href: esportsHref("/events"), label: t("events"), icon: <Trophy /> },
    { href: "/shop", label: t("shop"), icon: <ShoppingBag /> },
    { href: "/hiring", label: t("hire"), icon: <Handshake /> },
  ];
  return (
    <section aria-labelledby="quick-title">
      <h2 id="quick-title" className="mb-3 text-xl">
        {t("title")}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((it) => {
          const body = (
            <>
              <span className="flex size-10 items-center justify-center rounded-pill bg-brand-soft text-brand-text [&>svg]:size-5">{it.icon}</span>
              <span className="font-semibold">{it.label}</span>
            </>
          );
          return isExternal(it.href) ? (
            <a key={it.href} href={it.href} className={QUICK_CLASS}>
              {body}
            </a>
          ) : (
            <Link key={it.href} href={it.href} className={QUICK_CLASS}>
              {body}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
